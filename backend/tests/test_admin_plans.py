"""
Tests for the admin entitlement control panel (api/routes/admin_plans.py) and the entitlement engine's cache behaviour.

The endpoint handler functions are invoked directly with explicit args, the same pattern as test_gates.py, so no HTTP layer is needed.
"""

import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.models.feature import Feature
from database.models.plan import Plan
from database.models.subscription import Subscription
from services import entitlement_service
from api.routes import admin_plans as ap


def _admin(db):
    from tests.conftest import _make_user
    user = _make_user("ADMIN", "bronze")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Feature CRUD
# ---------------------------------------------------------------------------

class TestFeatureCrud:
    def test_create_and_list_feature(self, db):
        admin = _admin(db)
        created = ap.create_feature(
            ap.FeatureCreate(key="custom_widget", display_name="Custom Widget", type="boolean"),
            admin=admin, db=db,
        )
        assert created.key == "custom_widget"
        keys = {f.key for f in ap.list_features(_=admin, db=db)}
        assert "custom_widget" in keys

    def test_duplicate_feature_409(self, db):
        admin = _admin(db)
        with pytest.raises(HTTPException) as exc:
            ap.create_feature(
                ap.FeatureCreate(key="ai_chat", display_name="dupe", type="boolean"),
                admin=admin, db=db,
            )
        assert exc.value.status_code == 409

    def test_numeric_feature_validation_in_entitlement(self, db):
        admin = _admin(db)
        # Create a numeric feature, then a plan whose entitlement value is non-numeric → 422
        feat = ap.create_feature(
            ap.FeatureCreate(key="api_calls", display_name="API Calls", type="numeric"),
            admin=admin, db=db,
        )
        with pytest.raises(HTTPException) as exc:
            ap.create_plan(
                ap.PlanCreate(
                    key="devplan", display_name="Dev", user_type="player",
                    entitlements=[ap.EntitlementIn(feature_id=feat.id, value="lots")],
                ),
                admin=admin, db=db,
            )
        assert exc.value.status_code == 422


# ---------------------------------------------------------------------------
# Plan CRUD + entitlements
# ---------------------------------------------------------------------------

class TestPlanCrud:
    def test_create_plan_with_entitlements(self, db):
        admin = _admin(db)
        ai = db.query(Feature).filter(Feature.key == "ai_chat").first()
        biomech = db.query(Feature).filter(Feature.key == "biomechanics_analysis").first()
        plan = ap.create_plan(
            ap.PlanCreate(
                key="diamond", display_name="Diamond", user_type="player",
                price_inr=99900, billing_period="monthly", sort_order=9,
                entitlements=[
                    ap.EntitlementIn(feature_id=ai.id, value="true"),
                    ap.EntitlementIn(feature_id=biomech.id, value="500"),
                ],
            ),
            admin=admin, db=db,
        )
        assert plan.key == "diamond"
        assert plan.subscriber_count == 0
        vals = {e.feature_key: e.value for e in plan.entitlements}
        assert vals["ai_chat"] == "true"
        assert vals["biomechanics_analysis"] == "500"

    def test_negative_price_rejected(self, db):
        with pytest.raises(Exception):
            ap.PlanCreate(key="bad", display_name="Bad", user_type="player", price_inr=-1)

    def test_set_entitlements_replaces(self, db):
        admin = _admin(db)
        ai = db.query(Feature).filter(Feature.key == "ai_chat").first()
        pdf = db.query(Feature).filter(Feature.key == "pdf_report").first()
        # Use a throwaway plan so the shared baseline isn't mutated.
        plan = ap.create_plan(
            ap.PlanCreate(
                key="tmp_set_ent", display_name="Tmp", user_type="player",
                entitlements=[ap.EntitlementIn(feature_id=ai.id, value="true")],
            ),
            admin=admin, db=db,
        )
        out = ap.set_entitlements(
            plan.id, [ap.EntitlementIn(feature_id=pdf.id, value="false")], admin=admin, db=db,
        )
        vals = {e.feature_key: e.value for e in out.entitlements}
        assert vals == {"pdf_report": "false"}  # replace-all wiped ai_chat


# ---------------------------------------------------------------------------
# Delete guard + migration
# ---------------------------------------------------------------------------

class TestPlanDeletion:
    """All deletion tests use throwaway plans so the shared baseline is never removed."""

    def _temp_plan(self, db, admin, key, user_type="player"):
        return ap.create_plan(
            ap.PlanCreate(key=key, display_name=key, user_type=user_type),
            admin=admin, db=db,
        )

    def test_delete_empty_plan_ok(self, db):
        admin = _admin(db)
        plan = self._temp_plan(db, admin, "ephemeral")
        ap.delete_plan(plan.id, migrate_to=None, admin=admin, db=db)
        assert db.query(Plan).filter(Plan.key == "ephemeral").first() is None

    def test_delete_plan_with_subscribers_blocked(self, db):
        from tests.conftest import _persist_user_with_sub
        admin = _admin(db)
        self._temp_plan(db, admin, "delblock")
        _persist_user_with_sub(db, "PLAYER", "delblock")
        plan = db.query(Plan).filter(Plan.key == "delblock").first()
        with pytest.raises(HTTPException) as exc:
            ap.delete_plan(plan.id, migrate_to=None, admin=admin, db=db)
        assert exc.value.status_code == 409
        assert exc.value.detail["error"] == "plan_has_active_subscribers"

    def test_delete_plan_with_migration_reassigns(self, db):
        from tests.conftest import _persist_user_with_sub
        admin = _admin(db)
        self._temp_plan(db, admin, "delmig")
        user = _persist_user_with_sub(db, "PLAYER", "delmig")
        plan = db.query(Plan).filter(Plan.key == "delmig").first()
        silver = db.query(Plan).filter(Plan.key == "silver").first()

        ap.delete_plan(plan.id, migrate_to=silver.id, admin=admin, db=db)

        assert db.query(Plan).filter(Plan.key == "delmig").first() is None
        sub = (
            db.query(Subscription)
            .filter(Subscription.user_id == user.id, Subscription.status == "active")
            .first()
        )
        assert sub.plan_id == silver.id
        assert sub.plan_key == "silver"

    def test_migration_across_user_types_rejected(self, db):
        from tests.conftest import _persist_user_with_sub
        admin = _admin(db)
        self._temp_plan(db, admin, "delxtype")
        _persist_user_with_sub(db, "PLAYER", "delxtype")
        plan = db.query(Plan).filter(Plan.key == "delxtype").first()
        coach = db.query(Plan).filter(Plan.key == "coach_platinum").first()
        with pytest.raises(HTTPException) as exc:
            ap.delete_plan(plan.id, migrate_to=coach.id, admin=admin, db=db)
        assert exc.value.status_code == 422


# ---------------------------------------------------------------------------
# Cache invalidation on admin edits
# ---------------------------------------------------------------------------

class TestCacheInvalidation:
    def test_entitlement_edit_visible_after_admin_write(self, db):
        from tests.conftest import _persist_user_with_sub
        admin = _admin(db)
        user = _persist_user_with_sub(db, "PLAYER", "bronze")

        # Prime the cache: bronze does NOT grant ai_chat.
        assert entitlement_service.is_feature_enabled(user, "ai_chat", db) is False

        # Admin grants ai_chat to bronze via set_entitlements.
        bronze = db.query(Plan).filter(Plan.key == "bronze").first()
        ai = db.query(Feature).filter(Feature.key == "ai_chat").first()
        biomech = db.query(Feature).filter(Feature.key == "biomechanics_analysis").first()
        ap.set_entitlements(
            bronze.id,
            [
                ap.EntitlementIn(feature_id=biomech.id, value="3"),
                ap.EntitlementIn(feature_id=ai.id, value="true"),
            ],
            admin=admin, db=db,
        )

        # The admin write invalidated the cache → the new grant is visible.
        assert entitlement_service.is_feature_enabled(user, "ai_chat", db) is True

        # Restore baseline so later tests are unaffected.
        ap.set_entitlements(
            bronze.id, [ap.EntitlementIn(feature_id=biomech.id, value="3")], admin=admin, db=db,
        )
