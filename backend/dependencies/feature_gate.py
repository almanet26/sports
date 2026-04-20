"""
require_feature(feature_key) — FastAPI Depends factory.

Usage:
    @router.get("/pdf")
    def download_pdf(user: User = Depends(require_feature("pdf_report")), ...):
        ...
"""

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from config.feature_map import FEATURE_MAP, TIER_HIERARCHY
from database.config import get_db
from database.models.subscription import Subscription
from database.models.user import User
from utils.auth import get_current_user


def require_feature(feature_key: str):
    """
    Returns a FastAPI dependency that:
      1. Verifies the user has an active subscription.
      2. Verifies the user's tier meets the minimum for `feature_key`.
      3. Returns the authenticated User on success.

    Raises:
      400  – unknown feature_key (programming error, not a client error)
      402  – subscription not active
      403  – tier too low
    """
    if feature_key not in FEATURE_MAP:
        raise ValueError(f"Unknown feature key: '{feature_key}'. Add it to config/feature_map.py.")

    required_role: str = FEATURE_MAP[feature_key]

    def _gate(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        # Fetch the subscription row (one-to-one with user).
        sub: Subscription | None = (
            db.query(Subscription)
            .filter(Subscription.user_id == user.id)
            .first()
        )

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
