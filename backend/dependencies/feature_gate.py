"""
require_feature(feature_key) — FastAPI Depends factory.

Also exports get_active_subscription() — the single canonical function for
fetching a user's current subscription.  All route code must use this instead
of querying subscriptions directly, so the lazy-expiry logic runs everywhere.

Usage:
    @router.get("/pdf")
    def download_pdf(user: User = Depends(require_feature("pdf_report")), ...):
        ...
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from config.feature_map import FEATURE_MAP, TIER_HIERARCHY
from database.config import get_db
from database.models.subscription import Subscription
from database.models.user import User
from utils.auth import get_current_user


# ---------------------------------------------------------------------------
# Shared helper — single source of truth for subscription state
# ---------------------------------------------------------------------------

def get_active_subscription(user: User, db: Session) -> Optional[Subscription]:
    """
    Return the most recent subscription for `user`, applying lazy expiry:

    • If the subscription's expires_at has passed but status is still "active",
      this function atomically flips status → "expired" and user.role → "free"
      before returning, so the caller sees a consistent, already-expired record.

    • Returns None if the user has no subscription at all.
    
    """
    sub: Optional[Subscription] = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(Subscription.started_at.desc())
        .first()
    )

    if sub is not None and sub.status == "active":
        # Normalise to UTC for comparison regardless of whether the DB driver returns a tz-aware or a naive datetime.
        exp = sub.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)

        if exp < datetime.now(timezone.utc):
            # Lazy expiry — write it now so every subsequent check sees the correct state without waiting for a background sweep.
            sub.status = "expired"
            if user.role != "free":
                user.role = "free"
            db.commit()

    return sub


# ---------------------------------------------------------------------------
# require_feature factory
# ---------------------------------------------------------------------------

def require_feature(feature_key: str):
    """
    Returns a FastAPI dependency that:
      1. Fetches the user's current subscription via get_active_subscription()(which includes lazy expiry handling).
      2. Raises 402 if there is no active subscription.
      3. Raises 403 if the user's tier is below the feature's minimum.
      4. Returns the authenticated User on success.
    """
    if feature_key not in FEATURE_MAP:
        raise ValueError(f"Unknown feature key: '{feature_key}'. Add it to config/feature_map.py.")

    required_role: str = FEATURE_MAP[feature_key]

    def _gate(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        sub = get_active_subscription(user, db)

        if sub is None or sub.status != "active":
            raise HTTPException(
                status_code=402,
                detail="Subscription inactive",
            )

        user_tier = TIER_HIERARCHY.get(user.role, -1)
        required_tier = TIER_HIERARCHY[required_role]

        if user_tier < required_tier:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "tier_required",
                    "required": required_role,
                    "current": user.role,
                },
            )

        return user

    return _gate