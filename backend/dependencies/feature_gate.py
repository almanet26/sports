"""
require_feature(feature_key) — FastAPI dependency factory (boolean access gate).

Authorization is resolved live from the database through the entitlement engine (services/entitlement_service), so plan/feature edits made by an admin take effect within the cache TTL with no redeploy.

Gate order:
  1. ADMIN bypass — admins pass unconditionally.
  2. Entitlement check — the user's active plan must grant the feature:
       - boolean feature → value is true
       - numeric feature → limit is unlimited (-1) or > 0
     Otherwise 403.

Account-type restriction is implicit: a user only ever holds a plan of their own user_type, and entitlements come from that plan — so a coach-only feature simply won't appear in a player's entitlements (→ 403) and vice-versa.

get_active_subscription() remains the canonical accessor for the raw subscription row (with lazy expiry) used by billing/usage/dashboard code.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.subscription import Subscription
from database.models.user import User
from services import entitlement_service
from utils.auth import get_current_user


# ---------------------------------------------------------------------------
# Shared helper — canonical subscription accessor with lazy expiry
# ---------------------------------------------------------------------------

def get_active_subscription(user: User, db: Session) -> Optional[Subscription]:
    """
    Return the most recent subscription for `user`, applying lazy expiry:

    - If expires_at has passed but status is still "active", atomically flip status → "expired" so callers see a consistent record.
    - Returns None if the user has no subscription row at all.
    """
    sub: Optional[Subscription] = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(Subscription.started_at.desc())
        .first()
    )

    if sub is not None and sub.status == "active":
        exp = sub.expires_at
        if exp is not None:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                sub.status = "expired"
                db.commit()
                entitlement_service.invalidate_user(user.id)

    return sub


# ---------------------------------------------------------------------------
# require_feature factory
# ---------------------------------------------------------------------------

def require_feature(feature_key: str):
    """
    Returns a FastAPI dependency that allows the request only if the user's active plan grants `feature_key`.  Returns the authenticated User on success.
    """

    def _gate(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if user.role == "ADMIN":
            return user

        if not entitlement_service.is_feature_enabled(user, feature_key, db):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "feature_not_available",
                    "feature": feature_key,
                    "message": "Your current plan does not include this feature.",
                },
            )
        return user

    return _gate
