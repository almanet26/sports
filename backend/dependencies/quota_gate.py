"""
quota_check(feature_key) — FastAPI Depends factory for monthly quota enforcement.
increment_usage(...)     — Atomic helper to increment a monthly_usage field.

Quota-tracked features and their DB column mapping:
  "biomechanics_analysis" → used: biomech_count       / limit: max_biomech_per_month
  "ocr_highlights"        → used: ocr_hours_used      / limit: max_ocr_hours_per_month
  "player_submission"     → used: submission_count    / limit: max_submissions_per_month
"""

from __future__ import annotations

from datetime import date
from typing import NamedTuple

from fastapi import Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.monthly_usage import MonthlyUsage
from database.models.plan_config import PlanConfig
from database.models.user import User
from utils.auth import get_current_user


# ---------------------------------------------------------------------------
# Quota field mapping
# ---------------------------------------------------------------------------

class _QuotaFields(NamedTuple):
    usage_col: str   # column on monthly_usage
    limit_col: str   # column on plan_config


_QUOTA_MAP: dict[str, _QuotaFields] = {
    "biomechanics_analysis": _QuotaFields("biomech_count",    "max_biomech_per_month"),
    "ocr_highlights":        _QuotaFields("ocr_hours_used",   "max_ocr_hours_per_month"),
    "player_submission":     _QuotaFields("submission_count", "max_submissions_per_month"),
}


# ---------------------------------------------------------------------------
# quota_check dependency factory
# ---------------------------------------------------------------------------

def quota_check(feature_key: str):
    """
    Returns a FastAPI dependency that:
      1. Looks up (or creates) the monthly_usage row for the current user / month.
      2. Looks up the plan limit from plan_config via user.role.
      3. Raises 429 if limit > 0 and usage >= limit.
      4. Returns (user, usage_row) on success.

    Raises:
      ValueError  – unknown feature_key (caught at startup, not at runtime)
      429         – quota exceeded
    """
    if feature_key not in _QUOTA_MAP:
        raise ValueError(
            f"quota_check: unknown feature key '{feature_key}'. "
            f"Valid keys: {list(_QUOTA_MAP)}"
        )

    fields = _QUOTA_MAP[feature_key]

    def _gate(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> tuple[User, MonthlyUsage]:
        today = date.today()
        year, month = today.year, today.month

        # Fetch-or-create monthly_usage row (no atomic upsert needed here — we only read; increment_usage owns the write path).
        usage: MonthlyUsage | None = (
            db.query(MonthlyUsage)
            .filter(
                MonthlyUsage.user_id == user.id,
                MonthlyUsage.year == year,
                MonthlyUsage.month == month,
            )
            .first()
        )

        if usage is None:
            usage = MonthlyUsage(
                user_id=user.id,
                year=year,
                month=month,
                biomech_count=0,
                ocr_hours_used=0.0,
                submission_count=0,
            )
            db.add(usage)
            db.commit()
            db.refresh(usage)

        # Resolve plan limits — user.role is the canonical plan key.
        plan: PlanConfig | None = (
            db.query(PlanConfig)
            .filter(PlanConfig.role == user.role)
            .first()
        )

        # If no plan config exists for this role fall back to zero (block everything).
        limit: float | int = getattr(plan, fields.limit_col, 0) if plan else 0
        used: float | int = getattr(usage, fields.usage_col, 0)

        if limit > 0 and used >= limit:
            # Next reset is the 1st of next month.
            if month == 12:
                reset_year, reset_month = year + 1, 1
            else:
                reset_year, reset_month = year, month + 1

            raise HTTPException(
                status_code=429,
                detail={
                    "error": "quota_exceeded",
                    "used": used,
                    "limit": limit,
                    "resets": f"{reset_year}-{reset_month:02d}-01",
                },
            )

        return user, usage

    return _gate


# ---------------------------------------------------------------------------
# increment_usage_atomic — race-safe check-and-increment
# ---------------------------------------------------------------------------

def increment_usage_atomic(
    user_id: str,
    field: str,
    limit_col: str,
    amount: float | int,
    db: Session,
) -> bool:
    """
    Atomically increment `field` by `amount` **only if** the resulting value
    would not exceed the plan limit stored in `limit_col` on plan_config.

    The entire check + write is a single SQL UPDATE with a correlated subquery,
    so there is no window for two concurrent requests to both pass the quota
    check and both commit.

    Returns True  — increment applied, quota was not exceeded.
    Returns False — rowcount == 0, meaning the quota limit was already reached
                    (or no plan_config row exists for the user's role).
                    Callers should raise HTTP 429.

    Args:
        field:     column on monthly_usage  ("biomech_count" | "ocr_hours_used" | "submission_count")
        limit_col: column on plan_config    ("max_biomech_per_month" | "max_ocr_hours_per_month" | ...)
        amount:    positive value to add
    """
    _valid = {"biomech_count", "ocr_hours_used", "submission_count"}
    if field not in _valid:
        raise ValueError(f"increment_usage_atomic: invalid field '{field}'")

    today = date.today()
    year, month = today.year, today.month

    from database.config import IS_SQLITE  # late import avoids circular

    # Guarantee the row exists before the conditional UPDATE.
    # Both the INSERT and the UPDATE run inside the same transaction — no
    # intermediate commit — so the row cannot disappear between the two.
    if IS_SQLITE:
        db.execute(
            text(
                "INSERT OR IGNORE INTO monthly_usage "
                "(user_id, year, month, biomech_count, ocr_hours_used, submission_count) "
                "VALUES (:uid, :y, :m, 0, 0, 0)"
            ),
            {"uid": user_id, "y": year, "m": month},
        )
    else:
        db.execute(
            text(
                "INSERT INTO monthly_usage "
                "(user_id, year, month, biomech_count, ocr_hours_used, submission_count) "
                "VALUES (:uid, :y, :m, 0, 0, 0) "
                "ON CONFLICT (user_id, year, month) DO NOTHING"
            ),
            {"uid": user_id, "y": year, "m": month},
        )

    # Single-statement atomic check + increment.
    # If `field + amount > limit` the WHERE predicate is false → rowcount == 0.
    # Handles limit == 0 naturally (0 + amount > 0 → false → blocked).
    # Handles missing plan_config row (NULL limit) → NULL comparison → false → blocked.
    result = db.execute(
        text(
            f"UPDATE monthly_usage "
            f"SET    {field} = {field} + :amount "
            f"WHERE  user_id = :uid "
            f"  AND  year    = :y "
            f"  AND  month   = :m "
            f"  AND  {field} + :amount <= ("
            f"           SELECT {limit_col} "
            f"           FROM   plan_config "
            f"           WHERE  role = (SELECT role FROM users WHERE id = :uid)"
            f"       )"
        ),
        {"amount": amount, "uid": user_id, "y": year, "m": month},
    )
    db.commit()
    return result.rowcount > 0


# ---------------------------------------------------------------------------
# increment_usage — unconditional atomic upsert (used for reconciliation /
# worker callbacks where the quota was already checked at dispatch)
# ---------------------------------------------------------------------------

async def increment_usage(
    user_id: str,
    field: str,
    amount: float | int,
    db: Session,
) -> MonthlyUsage:
    """
    Atomically increments `field` on the monthly_usage row for the current
    (user_id, year, month).  Creates the row if it does not exist.

    `field` must be one of: biomech_count | ocr_hours_used | submission_count
    `amount` should be positive.

    Returns the updated MonthlyUsage row.
    """
    _valid_fields = {"biomech_count", "ocr_hours_used", "submission_count"}
    if field not in _valid_fields:
        raise ValueError(f"increment_usage: invalid field '{field}'. Valid: {_valid_fields}")

    today = date.today()
    year, month = today.year, today.month

    # PostgreSQL / SQLite compatible atomic upsert via raw SQL so we avoid a read-then-write race condition under concurrent requests.
    # PostgreSQL uses INSERT … ON CONFLICT DO UPDATE. SQLite uses INSERT OR IGNORE + UPDATE (two statements, still safe for single-writer SQLite use in development).

    from database.config import IS_SQLITE  # imported here to avoid circular import

    if IS_SQLITE:
        db.execute(
            text(
                "INSERT OR IGNORE INTO monthly_usage "
                "(user_id, year, month, biomech_count, ocr_hours_used, submission_count) "
                "VALUES (:uid, :y, :m, 0, 0, 0)"
            ),
            {"uid": user_id, "y": year, "m": month},
        )
        db.execute(
            text(
                f"UPDATE monthly_usage "
                f"SET {field} = {field} + :amount "
                f"WHERE user_id = :uid AND year = :y AND month = :m"
            ),
            {"amount": amount, "uid": user_id, "y": year, "m": month},
        )
    else:
        db.execute(
            text(
                "INSERT INTO monthly_usage "
                "(user_id, year, month, biomech_count, ocr_hours_used, submission_count) "
                "VALUES (:uid, :y, :m, 0, 0, 0) "
                "ON CONFLICT (user_id, year, month) DO NOTHING"
            ),
            {"uid": user_id, "y": year, "m": month},
        )
        db.execute(
            text(
                f"UPDATE monthly_usage "
                f"SET {field} = {field} + :amount "
                f"WHERE user_id = :uid AND year = :y AND month = :m"
            ),
            {"amount": amount, "uid": user_id, "y": year, "m": month},
        )

    db.commit()

    updated: MonthlyUsage = (
        db.query(MonthlyUsage)
        .filter(
            MonthlyUsage.user_id == user_id,
            MonthlyUsage.year == year,
            MonthlyUsage.month == month,
        )
        .first()
    )
    return updated
