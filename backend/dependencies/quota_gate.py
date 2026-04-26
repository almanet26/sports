"""
quota_check(feature_key) — FastAPI Depends factory for monthly quota enforcement.
increment_usage(...)     — Atomic helper to increment a monthly_usage field.
increment_usage_atomic() — Race-safe check-and-increment (used at job dispatch).

Quota-tracked features:
  "biomechanics_analysis" → biomech_count       / max_biomech_per_month
  "ocr_highlights"        → ocr_hours_used      / max_ocr_hours_per_month
  "player_submission"     → submission_count    / max_submissions_per_month

Plan limits are read from plan_config.role which maps to the active
subscription's tier (subscriptions.role), NOT to users.role (which is the
account type PLAYER|COACH|ADMIN after the schema consolidation).
"""

from __future__ import annotations

from datetime import date
from typing import NamedTuple, Optional

from fastapi import Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.monthly_usage import MonthlyUsage
from database.models.plan_config import PlanConfig
from database.models.subscription import Subscription
from database.models.user import User
from utils.auth import get_current_user


# ---------------------------------------------------------------------------
# Quota field mapping
# ---------------------------------------------------------------------------

class _QuotaFields(NamedTuple):
    usage_col: str
    limit_col: str


_QUOTA_MAP: dict[str, _QuotaFields] = {
    "biomechanics_analysis": _QuotaFields("biomech_count",    "max_biomech_per_month"),
    "ocr_highlights":        _QuotaFields("ocr_hours_used",   "max_ocr_hours_per_month"),
    "player_submission":     _QuotaFields("submission_count", "max_submissions_per_month"),
}


def _get_active_sub_role(user_id: str, db: Session) -> str:
    """Return the subscription tier for user_id, defaulting to 'free'."""
    sub: Optional[Subscription] = (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.status == "active")
        .order_by(Subscription.started_at.desc())
        .first()
    )
    return sub.role if sub else "free"


# ---------------------------------------------------------------------------
# quota_check dependency factory
# ---------------------------------------------------------------------------

def quota_check(feature_key: str):
    """
    Returns a FastAPI dependency that:
      1. ADMIN accounts skip quota checks entirely.
      2. Fetches (or creates) the monthly_usage row.
      3. Looks up the plan limit from plan_config via the active subscription tier.
      4. Raises 429 if limit > 0 and usage >= limit.
      5. Returns (user, usage_row) on success.
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
        # ── ADMIN bypass ─────────────────────────────────────────────────────
        if user.role == "ADMIN":
            today = date.today()
            dummy = MonthlyUsage(
                user_id=user.id,
                year=today.year,
                month=today.month,
                biomech_count=0,
                ocr_hours_used=0.0,
                submission_count=0,
            )
            return user, dummy

        today = date.today()
        year, month = today.year, today.month

        usage: Optional[MonthlyUsage] = (
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

        # Plan limits come from subscriptions.role, not users.role
        sub_role = _get_active_sub_role(user.id, db)
        plan: Optional[PlanConfig] = (
            db.query(PlanConfig).filter(PlanConfig.role == sub_role).first()
        )

        limit: float = getattr(plan, fields.limit_col, 0) if plan else 0
        used: float = getattr(usage, fields.usage_col, 0)

        if limit > 0 and used >= limit:
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
# increment_usage_atomic — race-safe check-and-increment at job dispatch
# ---------------------------------------------------------------------------

def increment_usage_atomic(
    user_id: str,
    field: str,
    limit_col: str,
    amount: float | int,
    db: Session,
) -> bool:
    """
    Atomically increment `field` by `amount` only if usage + amount <= plan limit.

    Plan limit is looked up from plan_config via the active subscription tier
    (subscriptions.role), NOT from users.role.

    Returns True  — increment applied.
    Returns False — quota limit already reached or no plan_config row exists.
    """
    _valid = {"biomech_count", "ocr_hours_used", "submission_count"}
    if field not in _valid:
        raise ValueError(f"increment_usage_atomic: invalid field '{field}'")

    today = date.today()
    year, month = today.year, today.month

    from database.config import IS_SQLITE  # late import avoids circular

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

    # Lookup plan limit via active subscription tier, not users.role
    result = db.execute(
        text(
            f"UPDATE monthly_usage "
            f"SET    {field} = {field} + :amount "
            f"WHERE  user_id = :uid "
            f"  AND  year    = :y "
            f"  AND  month   = :m "
            f"  AND  {field} + :amount <= ("
            f"    SELECT pc.{limit_col} "
            f"    FROM   plan_config pc "
            f"    JOIN   subscriptions s ON s.role = pc.role "
            f"    WHERE  s.user_id = :uid "
            f"      AND  s.status  = 'active' "
            f"    ORDER  BY s.started_at DESC "
            f"    LIMIT  1"
            f"  )"
        ),
        {"amount": amount, "uid": user_id, "y": year, "m": month},
    )
    db.commit()
    return result.rowcount > 0


# ---------------------------------------------------------------------------
# increment_usage — unconditional atomic upsert (worker reconciliation)
# ---------------------------------------------------------------------------

async def increment_usage(
    user_id: str,
    field: str,
    amount: float | int,
    db: Session,
) -> MonthlyUsage:
    """
    Atomically increment `field` on the monthly_usage row for the current month.
    Creates the row if it does not exist.  No quota check — caller is the worker
    reconciling actual consumption after job completion.
    """
    _valid_fields = {"biomech_count", "ocr_hours_used", "submission_count"}
    if field not in _valid_fields:
        raise ValueError(f"increment_usage: invalid field '{field}'. Valid: {_valid_fields}")

    today = date.today()
    year, month = today.year, today.month

    from database.config import IS_SQLITE

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
