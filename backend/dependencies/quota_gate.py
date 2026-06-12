"""
Numeric quota enforcement + consumption tracking for the dynamic entitlement engine.  All limits are resolved live from plan_entitlements (no hardcoded columns); all consumption is tracked in the normalized feature_usage table.

Public surface (signatures preserved for existing call sites):
  - check_entitlement(feature_key)  — unified FastAPI dependency: boolean→403, numeric→ensures usage row, 429 if monthly limit reached. Returns (user, usage|None).
  - quota_check(feature_key)        — alias of check_entitlement (numeric features).
  - increment_usage_atomic(user_id, field, limit_col, amount, db) -> bool
        — race-safe check-and-increment against the live limit (legacy `field` name is translated to a feature key; `limit_col` is ignored).
  - increment_usage(user_id, field, amount, db) -> FeatureUsage
        — unconditional upsert (worker reconciliation, no quota check).
"""

from __future__ import annotations

from datetime import date
from typing import Optional, Tuple

from fastapi import Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from config.default_entitlements import LEGACY_FIELD_TO_FEATURE
from database.config import get_db, IS_SQLITE
from database.models.feature import Feature
from database.models.feature_usage import FeatureUsage
from database.models.user import User
from services import entitlement_service
from utils.auth import get_current_user


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _period_start(today: Optional[date] = None) -> date:
    d = today or date.today()
    return date(d.year, d.month, 1)


def _next_reset(today: Optional[date] = None) -> str:
    d = today or date.today()
    if d.month == 12:
        return f"{d.year + 1}-01-01"
    return f"{d.year}-{d.month + 1:02d}-01"


def _feature_id(db: Session, feature_key: str) -> Optional[int]:
    row = db.query(Feature.id).filter(Feature.key == feature_key).first()
    return row[0] if row else None


def _ensure_usage_row(db: Session, user_id: str, feature_id: int, period: date) -> FeatureUsage:
    """Fetch-or-create the feature_usage row for (user, feature, month), race-safe."""
    if IS_SQLITE:
        db.execute(
            text(
                "INSERT OR IGNORE INTO feature_usage (user_id, feature_id, period_start, used) "
                "VALUES (:uid, :fid, :ps, 0)"
            ),
            {"uid": user_id, "fid": feature_id, "ps": period},
        )
    else:
        db.execute(
            text(
                "INSERT INTO feature_usage (user_id, feature_id, period_start, used) "
                "VALUES (:uid, :fid, :ps, 0) "
                "ON CONFLICT (user_id, feature_id, period_start) DO NOTHING"
            ),
            {"uid": user_id, "fid": feature_id, "ps": period},
        )
    db.commit()
    return (
        db.query(FeatureUsage)
        .filter(
            FeatureUsage.user_id == user_id,
            FeatureUsage.feature_id == feature_id,
            FeatureUsage.period_start == period,
        )
        .first()
    )


def _resolve_limit_sql(db: Session, user_id: str, feature_key: str) -> Optional[float]:
    """
    Resolve the live numeric limit for (user, feature) straight from the DB, independent of the entitlement cache, so atomic increments are always checked against ground truth.  Returns None if the feature is not entitled at all.
    """
    row = db.execute(
        text(
            "SELECT CAST(pe.value AS REAL) "
            "FROM subscriptions s "
            "JOIN plans p ON p.id = s.plan_id "
            "JOIN plan_entitlements pe ON pe.plan_id = p.id "
            "JOIN features f ON f.id = pe.feature_id "
            "WHERE s.user_id = :uid AND s.status = 'active' AND f.key = :fkey "
            "ORDER BY s.started_at DESC "
            "LIMIT 1"
        ),
        {"uid": user_id, "fkey": feature_key},
    ).first()
    return float(row[0]) if row and row[0] is not None else None


# ---------------------------------------------------------------------------
# check_entitlement — unified dependency (boolean gate + numeric quota)
# ---------------------------------------------------------------------------

def check_entitlement(feature_key: str):
    """
    FastAPI dependency. For a boolean feature: 403 unless granted. For a numeric feature: 403 if the limit is 0/absent, 429 if the monthly limit is reached, otherwise allows and returns the live usage row.

    Returns (User, FeatureUsage | None).
    """

    def _gate(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> Tuple[User, Optional[FeatureUsage]]:
        if user.role == "ADMIN":
            return user, None

        ent = entitlement_service.get_user_entitlements(user, db).get(feature_key)
        if ent is None:
            raise HTTPException(
                status_code=403,
                detail={"error": "feature_not_available", "feature": feature_key},
            )

        # Boolean feature → simple grant check.
        if ent["type"] != "numeric":
            if not ent["value"]:
                raise HTTPException(
                    status_code=403,
                    detail={"error": "feature_not_available", "feature": feature_key},
                )
            return user, None

        # Numeric feature → quota enforcement.
        limit = float(ent["value"])
        if limit == 0:
            raise HTTPException(
                status_code=403,
                detail={"error": "feature_not_available", "feature": feature_key},
            )

        feature_id = _feature_id(db, feature_key)
        if feature_id is None:
            raise HTTPException(
                status_code=403,
                detail={"error": "feature_not_available", "feature": feature_key},
            )

        usage = _ensure_usage_row(db, user.id, feature_id, _period_start())

        if limit > 0 and usage.used >= limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "quota_exceeded",
                    "feature": feature_key,
                    "used": usage.used,
                    "limit": limit,
                    "resets": _next_reset(),
                },
            )

        return user, usage

    return _gate


# quota_check is the historical name for the numeric gate; keep it as an alias.
quota_check = check_entitlement


# ---------------------------------------------------------------------------
# increment_usage_atomic — race-safe check-and-increment at job dispatch
# ---------------------------------------------------------------------------

def increment_usage_atomic(
    user_id: str,
    field: str,
    limit_col: str,  # retained for signature compatibility; no longer used
    amount: float | int,
    db: Session,
) -> bool:
    """
    Atomically increment usage of the feature mapped from the legacy `field`
    name, only if it stays within the live monthly limit.

    Returns True if the increment was applied, False if the limit is already
    reached (or the feature/limit cannot be resolved).
    """
    feature_key = LEGACY_FIELD_TO_FEATURE.get(field)
    if feature_key is None:
        raise ValueError(f"increment_usage_atomic: unknown field '{field}'")

    feature_id = _feature_id(db, feature_key)
    if feature_id is None:
        return False

    limit = _resolve_limit_sql(db, user_id, feature_key)
    if limit is None or limit == 0:
        return False

    period = _period_start()
    _ensure_usage_row(db, user_id, feature_id, period)

    # Single atomic UPDATE: apply only if unlimited (-1) or staying within limit.
    result = db.execute(
        text(
            "UPDATE feature_usage "
            "SET used = used + :amount "
            "WHERE user_id = :uid AND feature_id = :fid AND period_start = :ps "
            "  AND (:limit < 0 OR used + :amount <= :limit)"
        ),
        {"amount": amount, "uid": user_id, "fid": feature_id, "ps": period, "limit": limit},
    )
    db.commit()

    applied = result.rowcount > 0
    if applied:
        entitlement_service.invalidate_user(user_id)  # keep cached usage views fresh-ish
    return applied


# ---------------------------------------------------------------------------
# increment_usage — unconditional atomic upsert (worker reconciliation)
# ---------------------------------------------------------------------------

async def increment_usage(
    user_id: str,
    field: str,
    amount: float | int,
    db: Session,
) -> FeatureUsage:
    """
    Atomically add `amount` to the feature mapped from the legacy `field`, for
    the current month, creating the row if needed.  No quota check — the worker
    reconciles actual consumption after a job completes.
    """
    feature_key = LEGACY_FIELD_TO_FEATURE.get(field)
    if feature_key is None:
        raise ValueError(f"increment_usage: unknown field '{field}'")

    feature_id = _feature_id(db, feature_key)
    if feature_id is None:
        raise ValueError(f"increment_usage: feature '{feature_key}' not found")

    period = _period_start()
    _ensure_usage_row(db, user_id, feature_id, period)

    db.execute(
        text(
            "UPDATE feature_usage SET used = used + :amount "
            "WHERE user_id = :uid AND feature_id = :fid AND period_start = :ps"
        ),
        {"amount": amount, "uid": user_id, "fid": feature_id, "ps": period},
    )
    db.commit()

    return (
        db.query(FeatureUsage)
        .filter(
            FeatureUsage.user_id == user_id,
            FeatureUsage.feature_id == feature_id,
            FeatureUsage.period_start == period,
        )
        .first()
    )
