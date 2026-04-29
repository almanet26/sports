"""
require_feature(feature_key) — FastAPI Depends factory.

Gate evaluation order (matches Step 3A spec):
  1. ADMIN bypass — admins pass every gate unconditionally.
  2. Account-type check — coach-only features reject PLAYER accounts regardless of tier.
  3. Subscription active check — raises 402 when no active subscription exists.
  4. Tier check — raises 403 when the user's current tier is below the feature minimum.
     For ai_chat specifically: player minimum is "basic", coach minimum is "coach_starter".

get_active_subscription() is the single canonical function for fetching the active
subscription.  All route code must call this instead of querying subscriptions directly.
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


# Features that require a COACH account type regardless of subscription tier.
# A PLAYER with a coach_starter subscription (should never exist after Step 3C enforcement, but defended here anyway) must still be rejected.
ACCOUNT_TYPE_FOR_FEATURE: dict[str, Optional[str]] = {
    "ocr_highlights":        "COACH",
    "video_annotation":      "COACH",
    "player_dashboard":      "COACH",
    "player_submission":     "PLAYER",
    "coach_submission_inbox": "COACH",
    "csv_export":            "COACH",
    "white_label_reports":   "COACH",
    "multi_seat_roles":      "COACH",
    "recruitment_desk":      "COACH",
    # Player-accessible features — no account-type restriction
    "biomechanics_analysis": None,
    "pdf_report":            None,
    "ai_chat":               None,  # accessible to both; tier checked per account type below
    "pro_benchmarking":      None,
    "injury_risk_alerts":    None,
    "priority_processing":   None,
}

# Coach subscription tiers (used for account-type check fallback).
_COACH_TIERS = frozenset({"coach_free", "coach_starter", "coach_pro", "academy"})


# ---------------------------------------------------------------------------
# Shared helper — single source of truth for subscription state
# ---------------------------------------------------------------------------

def get_active_subscription(user: User, db: Session) -> Optional[Subscription]:
    """
    Return the most recent subscription for `user`, applying lazy expiry:

    • If expires_at has passed but status is still "active", this function
      atomically flips status → "expired" before returning so callers always
      see a consistent, already-expired record.

    • Returns None if the user has no subscription row at all.
    """
    sub: Optional[Subscription] = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(Subscription.started_at.desc())
        .first()
    )

    if sub is not None and sub.status == "active":
        exp = sub.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            sub.status = "expired"
            db.commit()

    return sub


# ---------------------------------------------------------------------------
# require_feature factory
# ---------------------------------------------------------------------------

def require_feature(feature_key: str):
    """
    Returns a FastAPI dependency that enforces the four-gate sequence above.
    Returns the authenticated User on success.
    """
    if feature_key not in FEATURE_MAP:
        raise ValueError(
            f"Unknown feature key: '{feature_key}'. Add it to config/feature_map.py."
        )

    required_tier: str = FEATURE_MAP[feature_key]
    required_account_type: Optional[str] = ACCOUNT_TYPE_FOR_FEATURE.get(feature_key)

    def _gate(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        # ── Gate 1: ADMIN bypass ─────────────────────────────────────────────
        if user.role == "ADMIN":
            return user

        # ── Gate 2: account-type check ───────────────────────────────────────
        if required_account_type is not None and user.role != required_account_type:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "wrong_account_type",
                    "detail": f"This feature requires a {required_account_type} account",
                },
            )

        # ── Gate 3: active subscription ──────────────────────────────────────
        sub = get_active_subscription(user, db)
        if sub is None or sub.status != "active":
            raise HTTPException(
                status_code=402,
                detail={"error": "subscription_inactive"},
            )

        # ── Gate 4: tier check ───────────────────────────────────────────────
        # Special case: ai_chat has different minimum tiers per account type.
        # coach_free (level 0) must be blocked; coach_starter (level 3) is the minimum.
        # free (level 0) must be blocked; basic (level 1) is the player minimum.
        if feature_key == "ai_chat":
            if user.role == "COACH":
                # Coach minimum for AI Chat is coach_starter
                if TIER_HIERARCHY.get(sub.role, -1) < TIER_HIERARCHY["coach_starter"]:
                    raise HTTPException(
                        status_code=403,
                        detail={
                            "error": "tier_required",
                            "required": "coach_starter",
                            "current": sub.role,
                            "message": "AI Chat requires Coach Starter plan or above",
                        },
                    )
            else:
                # Player minimum for AI Chat is basic
                if TIER_HIERARCHY.get(sub.role, -1) < TIER_HIERARCHY["basic"]:
                    raise HTTPException(
                        status_code=403,
                        detail={
                            "error": "tier_required",
                            "required": "basic",
                            "current": sub.role,
                            "message": "AI Chat requires Basic plan or above",
                        },
                    )
        else:
            # Generic tier check for all other features
            user_tier = TIER_HIERARCHY.get(sub.role, -1)
            required_tier_level = TIER_HIERARCHY[required_tier]

            if user_tier < required_tier_level:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "tier_required",
                        "required": required_tier,
                        "current": sub.role,
                    },
                )

        return user

    return _gate
