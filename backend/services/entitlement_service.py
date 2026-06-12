"""
Entitlement engine — the single runtime authority for "what can this user do?".

Resolves a user's active subscription → plan → plan_entitlements (joined with features) into a flat, cached dict.  All authorization gates and quota checks read through here, so plan/feature/quota edits made by an admin take effect live (within the cache TTL) with no redeploy.

Caching: an in-process cachetools.TTLCache keyed by user_id.
  - invalidate_user(user_id) — call after a user's subscription changes.
  - invalidate_all()         — call after any plan/feature/entitlement edit.
On multi-instance deployments, edits propagate to other instances within the TTL window (default 60s).

Resolved entitlement shape:
    { feature_key: {"type": "boolean"|"numeric", "value": bool|float} }
Numeric value: -1 == unlimited, 0 == none, N == monthly limit.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from cachetools import TTLCache
from sqlalchemy.orm import Session
from config.default_entitlements import FREE_PLAN_BY_ACCOUNT_TYPE
from database.models.feature import Feature
from database.models.plan import Plan
from database.models.plan_entitlement import PlanEntitlement
from database.models.subscription import Subscription
from database.models.user import User

# ── Cache ────────────────────────────────────────────────────────────────────
_CACHE_TTL_SECONDS = 60
_CACHE_MAXSIZE = 10_000
_entitlement_cache: "TTLCache[str, dict]" = TTLCache(maxsize=_CACHE_MAXSIZE, ttl=_CACHE_TTL_SECONDS)


def invalidate_user(user_id: str) -> None:
    """Drop one user's cached entitlements (call after their subscription changes)."""
    _entitlement_cache.pop(user_id, None)


def invalidate_all() -> None:
    """Clear the whole cache (call after any plan/feature/entitlement admin edit)."""
    _entitlement_cache.clear()


# ── Plan resolution ──────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _active_subscription(user_id: str, db: Session) -> Optional[Subscription]:
    """Most recent active, non-expired subscription row for the user, or None."""
    sub: Optional[Subscription] = (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.status == "active")
        .order_by(Subscription.started_at.desc())
        .first()
    )
    if sub is None:
        return None
    exp = sub.expires_at
    if exp is not None:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < _now():
            return None  # treated as expired → caller falls back to the free plan
    return sub


def resolve_plan(user: User, db: Session) -> Optional[Plan]:
    """
    Resolve the Plan that currently governs `user`:
      1. Active subscription's plan_id (authoritative).
      2. Active subscription's plan_key / role (legacy rows not yet backfilled).
      3. The free plan for the user's account type.
    Returns None only if even the free plan is missing (un-seeded DB).
    """
    sub = _active_subscription(user.id, db)
    if sub is not None:
        if sub.plan_id is not None:
            plan = db.query(Plan).filter(Plan.id == sub.plan_id, Plan.is_active.is_(True)).first()
            if plan is not None:
                return plan
        # Legacy fallback: resolve by the denormalized plan_key / role string.
        legacy_key = sub.plan_key or sub.role
        if legacy_key:
            plan = db.query(Plan).filter(Plan.key == legacy_key, Plan.is_active.is_(True)).first()
            if plan is not None:
                return plan

    free_key = FREE_PLAN_BY_ACCOUNT_TYPE.get(user.role, "bronze")
    return db.query(Plan).filter(Plan.key == free_key).first()


# ── Entitlement resolution (cached) ──────────────────────────────────────────

def _load_entitlements(user: User, db: Session) -> dict:
    plan = resolve_plan(user, db)
    if plan is None:
        return {}

    rows = (
        db.query(PlanEntitlement, Feature)
        .join(Feature, PlanEntitlement.feature_id == Feature.id)
        .filter(PlanEntitlement.plan_id == plan.id)
        .all()
    )

    resolved: dict[str, dict] = {}
    for ent, feature in rows:
        if feature.type == "numeric":
            resolved[feature.key] = {"type": "numeric", "value": ent.as_number()}
        else:
            resolved[feature.key] = {"type": "boolean", "value": ent.as_bool()}
    return resolved


def get_user_entitlements(user: User, db: Session) -> dict:
    """Cached resolved entitlements for `user`.  See module docstring for shape."""
    cached = _entitlement_cache.get(user.id)
    if cached is not None:
        return cached
    resolved = _load_entitlements(user, db)
    _entitlement_cache[user.id] = resolved
    return resolved


# ── Convenience accessors ────────────────────────────────────────────────────

def is_feature_enabled(user: User, feature_key: str, db: Session) -> bool:
    """
    True if the user's plan grants `feature_key`.
      - boolean feature → value is True
      - numeric feature → limit is unlimited (-1) or > 0
    """
    ent = get_user_entitlements(user, db).get(feature_key)
    if ent is None:
        return False
    if ent["type"] == "numeric":
        return ent["value"] == -1 or ent["value"] > 0
    return bool(ent["value"])


def get_limit(user: User, feature_key: str, db: Session) -> float:
    """
    Numeric monthly limit for `feature_key`: -1 unlimited · 0 none/absent · N otherwise.
    Returns 0.0 for boolean or unknown features.
    """
    ent = get_user_entitlements(user, db).get(feature_key)
    if ent is None or ent["type"] != "numeric":
        return 0.0
    return float(ent["value"])
