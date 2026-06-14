"""
Tests for the dynamic entitlement gates (feature_gate + quota_gate).

The dependency inner functions (_gate) are called directly with explicit `user` and `db` arguments, bypassing FastAPI's DI machinery, against an in-memory SQLite database seeded with the production entitlement catalog.

Baseline entitlements (see conftest / config.default_entitlements):
  bronze         → biomechanics_analysis=3,  player_submission=0
  silver         → biomechanics_analysis=15, player_submission=5,  ai_chat
  gold           → biomechanics_analysis=50, player_submission=15
  coach_basic    → ocr_highlights=10, player_submission=5,  player_roster=5
  coach_platinum → ocr_highlights=50, player_submission=100, video_annotation, ai_chat, ...
"""

import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dependencies.feature_gate import require_feature
from dependencies.quota_gate import quota_check, check_entitlement
from tests.conftest import seed_feature_usage


# ---------------------------------------------------------------------------
# require_feature — boolean access gate
# ---------------------------------------------------------------------------

class TestRequireFeature:
    def test_admin_bypasses_everything(self, admin_user, db):
        gate = require_feature("white_label_reports")
        assert gate(user=admin_user, db=db).id == admin_user.id

    def test_granted_boolean_feature_allows(self, silver_user, db):
        # Silver grants pdf_report
        gate = require_feature("pdf_report")
        assert gate(user=silver_user, db=db).id == silver_user.id

    def test_ungranted_boolean_feature_403(self, bronze_user, db):
        # Bronze does not grant pdf_report
        gate = require_feature("pdf_report")
        with pytest.raises(HTTPException) as exc:
            gate(user=bronze_user, db=db)
        assert exc.value.status_code == 403
        assert exc.value.detail["error"] == "feature_not_available"

    def test_numeric_feature_with_positive_limit_allows(self, bronze_user, db):
        # Bronze grants biomechanics_analysis=3 (>0 → access granted)
        gate = require_feature("biomechanics_analysis")
        assert gate(user=bronze_user, db=db).id == bronze_user.id

    def test_numeric_feature_with_zero_limit_403(self, bronze_user, db):
        # Bronze has player_submission=0 → not granted
        gate = require_feature("player_submission")
        with pytest.raises(HTTPException) as exc:
            gate(user=bronze_user, db=db)
        assert exc.value.status_code == 403

    def test_coach_feature_unavailable_to_player(self, gold_user, db):
        # video_annotation is only on coach_platinum → player never has it
        gate = require_feature("video_annotation")
        with pytest.raises(HTTPException) as exc:
            gate(user=gold_user, db=db)
        assert exc.value.status_code == 403

    def test_player_feature_unavailable_to_coach(self, coach_platinum_user, db):
        # scouting_visibility is a player feature; coach plans don't grant it
        gate = require_feature("scouting_visibility")
        with pytest.raises(HTTPException) as exc:
            gate(user=coach_platinum_user, db=db)
        assert exc.value.status_code == 403

    def test_ai_chat_silver_player_allowed(self, silver_user, db):
        gate = require_feature("ai_chat")
        assert gate(user=silver_user, db=db).id == silver_user.id

    def test_ai_chat_bronze_player_403(self, bronze_user, db):
        gate = require_feature("ai_chat")
        with pytest.raises(HTTPException) as exc:
            gate(user=bronze_user, db=db)
        assert exc.value.status_code == 403

    def test_ai_chat_coach_platinum_allowed(self, coach_platinum_user, db):
        gate = require_feature("ai_chat")
        assert gate(user=coach_platinum_user, db=db).id == coach_platinum_user.id


# ---------------------------------------------------------------------------
# quota_check / check_entitlement — numeric quota gate
# ---------------------------------------------------------------------------

class TestQuotaCheck:
    def test_admin_bypasses_quota(self, admin_user, db):
        gate = quota_check("biomechanics_analysis")
        user, usage = gate(user=admin_user, db=db)
        assert user.id == admin_user.id

    def test_under_limit_allows_and_creates_row(self, bronze_user, db):
        gate = quota_check("biomechanics_analysis")
        user, usage = gate(user=bronze_user, db=db)
        assert usage is not None
        assert usage.used == 0

    def test_at_limit_raises_429(self, bronze_user, db):
        # Bronze biomech limit is 3 — consume all 3
        seed_feature_usage(db, bronze_user.id, "biomechanics_analysis", 3)
        gate = quota_check("biomechanics_analysis")
        with pytest.raises(HTTPException) as exc:
            gate(user=bronze_user, db=db)
        assert exc.value.status_code == 429
        assert exc.value.detail["error"] == "quota_exceeded"
        assert exc.value.detail["limit"] == 3

    def test_just_under_limit_allows(self, bronze_user, db):
        seed_feature_usage(db, bronze_user.id, "biomechanics_analysis", 2)
        gate = quota_check("biomechanics_analysis")
        user, usage = gate(user=bronze_user, db=db)
        assert usage.used == 2

    def test_zero_limit_raises_403(self, bronze_user, db):
        # Bronze player_submission=0 → 403 (feature not available), not 429
        gate = quota_check("player_submission")
        with pytest.raises(HTTPException) as exc:
            gate(user=bronze_user, db=db)
        assert exc.value.status_code == 403

    def test_ocr_coach_basic_within_limit(self, coach_basic_user, db):
        # coach_basic ocr_highlights=10
        seed_feature_usage(db, coach_basic_user.id, "ocr_highlights", 9.5)
        gate = quota_check("ocr_highlights")
        user, usage = gate(user=coach_basic_user, db=db)
        assert usage.used == 9.5

    def test_ocr_coach_basic_at_limit_429(self, coach_basic_user, db):
        seed_feature_usage(db, coach_basic_user.id, "ocr_highlights", 10)
        gate = quota_check("ocr_highlights")
        with pytest.raises(HTTPException) as exc:
            gate(user=coach_basic_user, db=db)
        assert exc.value.status_code == 429


# ---------------------------------------------------------------------------
# Live plan edits take effect (no redeploy) — the core promise of the engine
# ---------------------------------------------------------------------------

class TestLiveEntitlementEdits:
    def test_raising_limit_takes_effect_after_invalidation(self, bronze_user, db):
        from database.models.plan import Plan
        from database.models.feature import Feature
        from database.models.plan_entitlement import PlanEntitlement
        from services import entitlement_service

        # Consume bronze's 3 biomech analyses → at limit
        seed_feature_usage(db, bronze_user.id, "biomechanics_analysis", 3)
        gate = quota_check("biomechanics_analysis")
        with pytest.raises(HTTPException):
            gate(user=bronze_user, db=db)

        # Admin raises bronze's biomech limit to 10 (simulating a PATCH)
        plan = db.query(Plan).filter(Plan.key == "bronze").first()
        feature = db.query(Feature).filter(Feature.key == "biomechanics_analysis").first()
        ent = (
            db.query(PlanEntitlement)
            .filter(PlanEntitlement.plan_id == plan.id, PlanEntitlement.feature_id == feature.id)
            .first()
        )
        original = ent.value
        try:
            ent.value = "10"
            db.commit()
            entitlement_service.invalidate_all()

            # Now the same user passes the gate with usage=3 < new limit 10
            user, usage = gate(user=bronze_user, db=db)
            assert usage.used == 3
        finally:
            # Restore the shared catalog so later tests see the baseline limit.
            ent.value = original
            db.commit()
            entitlement_service.invalidate_all()
