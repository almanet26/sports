"""
Seed / re-sync the dynamic entitlement catalog (plans, features, entitlements) from config/default_entitlements.py.

Idempotent: safe to run repeatedly.  Used both as a standalone script and by main._ensure_plans_and_features() at startup.

Usage:
    cd backend
    python scripts/seed_entitlements.py
"""

from __future__ import annotations

import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from config.default_entitlements import DEFAULT_FEATURES, DEFAULT_PLANS
from database.models.feature import Feature
from database.models.plan import Plan
from database.models.plan_entitlement import PlanEntitlement

logger = logging.getLogger(__name__)


def sync_entitlement_catalog(db: Session) -> None:
    """
    Upsert the baseline features, plans, and their entitlements.

    - Features: created if missing; display_name/type/description refreshed.
    - Plans: created if missing; metadata refreshed.  Existing admin edits to
      price/display are overwritten back to the baseline on each call, so this is
      a "reset to baseline" for the seeded plans only — admin-created plans and
      admin-created features are never touched.
    - Entitlements: each baseline plan's entitlements are upserted (not deleted),
      so admin-added entitlements on a baseline plan are preserved.
    """
    # ── Features ─────────────────────────────────────────────────────────────
    feature_by_key: dict[str, Feature] = {f.key: f for f in db.query(Feature).all()}
    for spec in DEFAULT_FEATURES:
        feature = feature_by_key.get(spec["key"])
        if feature is None:
            feature = Feature(key=spec["key"])
            db.add(feature)
            feature_by_key[spec["key"]] = feature
        feature.display_name = spec["display_name"]
        feature.type = spec["type"]
        feature.description = spec.get("description")
    db.flush()

    # ── Plans + entitlements ────────────────────────────────────────────────
    plan_by_key: dict[str, Plan] = {p.key: p for p in db.query(Plan).all()}
    for spec in DEFAULT_PLANS:
        plan = plan_by_key.get(spec["key"])
        if plan is None:
            plan = Plan(key=spec["key"])
            db.add(plan)
            plan_by_key[spec["key"]] = plan
        plan.display_name = spec["display_name"]
        plan.user_type = spec["user_type"]
        plan.price_inr = spec["price_inr"]
        plan.billing_period = spec["billing_period"]
        plan.sort_order = spec["sort_order"]
        if plan.is_active is None:
            plan.is_active = True
        db.flush()  # ensure plan.id

        existing = {
            e.feature_id: e
            for e in db.query(PlanEntitlement).filter(PlanEntitlement.plan_id == plan.id).all()
        }
        for feature_key, value in spec["entitlements"].items():
            feature = feature_by_key.get(feature_key)
            if feature is None:
                continue
            ent = existing.get(feature.id)
            if ent is None:
                db.add(PlanEntitlement(plan_id=plan.id, feature_id=feature.id, value=str(value)))
            else:
                ent.value = str(value)

    db.commit()
    logger.info("Entitlement catalog synced: %d features, %d plans.", len(DEFAULT_FEATURES), len(DEFAULT_PLANS))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    from database.config import SessionLocal

    db = SessionLocal()
    try:
        sync_entitlement_catalog(db)
        print("✓ Entitlement catalog seeded successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
