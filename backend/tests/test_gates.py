"""
Tests for feature_gate and quota_gate dependencies.

The dependency inner functions (_gate) are called directly with explicit
`user` and `db` arguments, bypassing FastAPI's DI machinery entirely.
This keeps tests fast (no HTTP layer) while still exercising the real
database queries against an in-memory SQLite database.

Plan config seeded in conftest:
  free          → max_biomech=3
  basic         → max_biomech=10
  platinum      → max_biomech=50
  coach_free    → max_biomech=0, max_ocr=0
  coach_starter → max_biomech=5, max_ocr=5.0, max_submissions=50
"""

import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.models.monthly_usage import MonthlyUsage
from database.models.subscription import Subscription
from database.models.user import User
from dependencies.feature_gate import require_feature
from dependencies.quota_gate import quota_check


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_biomech_usage(db, user, count: int) -> MonthlyUsage:
    from datetime import date
    today = date.today()
    usage = MonthlyUsage(
        user_id=user.id,
        year=today.year,
        month=today.month,
        biomech_count=count,
        ocr_hours_used=0.0,
        submission_count=0,
    )
    db.add(usage)
    db.commit()
    db.refresh(usage)
    return usage


# ---------------------------------------------------------------------------
# require_feature tests
# ---------------------------------------------------------------------------

class TestRequireFeature:
    def test_free_user_blocked_from_pdf_report(self, free_user, db):
        """
        A free-tier PLAYER with an active subscription must be rejected with 403
        when requesting a feature that requires platinum or above.
        """
        gate = require_feature("pdf_report")

        with pytest.raises(HTTPException) as exc_info:
            gate(user=free_user, db=db)

        exc = exc_info.value
        assert exc.status_code == 403
        assert exc.detail["error"] == "tier_required"
        assert exc.detail["required"] == "platinum"
        assert exc.detail["current"] == "free"

    def test_platinum_user_allowed_pdf_report(self, platinum_user, db):
        """
        A platinum-tier PLAYER with an active subscription must pass through the
        gate and receive their User object back.
        """
        gate = require_feature("pdf_report")

        result = gate(user=platinum_user, db=db)

        assert result.id == platinum_user.id
        assert result.role == "PLAYER"

    def test_inactive_subscription_raises_402(self, db):
        """
        Any user whose subscription status is not 'active' must get 402,
        regardless of their tier.
        """
        user = User(
            id=str(uuid.uuid4()),
            name="Expired Platinum",
            email=f"expired_{uuid.uuid4().hex[:6]}@test.invalid",
            password_hash="$2b$12$placeholder",
            role="PLAYER",
            subscription_plan="BASIC",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.flush()

        now = datetime.now(timezone.utc)
        db.add(Subscription(
            user_id=user.id,
            plan_key="platinum",
            role="platinum",
            status="expired",
            started_at=now - timedelta(days=100),
            expires_at=now - timedelta(days=10),
        ))
        db.commit()
        db.refresh(user)

        gate = require_feature("pdf_report")
        with pytest.raises(HTTPException) as exc_info:
            gate(user=user, db=db)

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["error"] == "subscription_inactive"

    def test_no_subscription_raises_402(self, db):
        """
        A user with no subscription row at all must get 402.
        """
        user = User(
            id=str(uuid.uuid4()),
            name="No Sub User",
            email=f"nosub_{uuid.uuid4().hex[:6]}@test.invalid",
            password_hash="$2b$12$placeholder",
            role="PLAYER",
            subscription_plan="BASIC",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()

        gate = require_feature("biomechanics_analysis")
        with pytest.raises(HTTPException) as exc_info:
            gate(user=user, db=db)

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail["error"] == "subscription_inactive"

    def test_lazy_expiry_flips_active_to_expired(self, db):
        """
        get_active_subscription must atomically flip status "active" → "expired"
        when expires_at has already passed, and the gate must then return 402.
        This tests the lazy-expiry side-effect, not just a pre-expired record.
        """
        from dependencies.feature_gate import get_active_subscription

        user = User(
            id=str(uuid.uuid4()),
            name="Lazy Expiry User",
            email=f"lazyexp_{uuid.uuid4().hex[:6]}@test.invalid",
            password_hash="$2b$12$placeholder",
            role="PLAYER",
            subscription_plan="BASIC",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.flush()

        # Subscription is still marked "active" but expires_at is in the past.
        stale_sub = Subscription(
            user_id=user.id,
            plan_key="platinum",
            role="platinum",
            status="active",                           # ← not yet flipped
            started_at=datetime.now(timezone.utc) - timedelta(days=100),
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),  # ← past
        )
        db.add(stale_sub)
        db.commit()

        returned_sub = get_active_subscription(user, db)

        # The helper must have flipped the status in-place.
        assert returned_sub.status == "expired"

        # A fresh query must confirm the flip was persisted.
        db.expire(stale_sub)
        db.refresh(stale_sub)
        assert stale_sub.status == "expired"

        # The gate must now return 402.
        gate = require_feature("pdf_report")
        with pytest.raises(HTTPException) as exc_info:
            gate(user=user, db=db)
        assert exc_info.value.status_code == 402

    def test_platinum_can_access_basic_feature(self, platinum_user, db):
        """Higher tiers must pass gates for lower-tier features."""
        gate = require_feature("biomechanics_analysis")
        result = gate(user=platinum_user, db=db)
        assert result.id == platinum_user.id

    def test_admin_bypasses_all_gates(self, admin_user, db):
        """
        An ADMIN user must pass every gate unconditionally — no subscription
        row is required and tier restrictions do not apply.
        """
        gate = require_feature("pdf_report")
        result = gate(user=admin_user, db=db)
        assert result.id == admin_user.id

    def test_player_blocked_from_coach_only_feature(self, basic_player_user, db):
        """
        A PLAYER account must be rejected with 403 wrong_account_type when
        requesting a feature that requires a COACH account (e.g. ocr_highlights).
        The rejection happens at Gate 2, before the tier check.
        """
        gate = require_feature("ocr_highlights")

        with pytest.raises(HTTPException) as exc_info:
            gate(user=basic_player_user, db=db)

        exc = exc_info.value
        assert exc.status_code == 403
        assert exc.detail["error"] == "wrong_account_type"

    def test_coach_blocked_from_player_only_feature(self, coach_starter_user, db):
        """
        A COACH account must be rejected with 403 wrong_account_type when
        requesting a feature restricted to PLAYER accounts (e.g. player_submission).
        """
        gate = require_feature("player_submission")

        with pytest.raises(HTTPException) as exc_info:
            gate(user=coach_starter_user, db=db)

        exc = exc_info.value
        assert exc.status_code == 403
        assert exc.detail["error"] == "wrong_account_type"

    # -- ai_chat special-case: different minimum tiers per account type ----------

    def test_ai_chat_blocks_free_player(self, free_user, db):
        """
        A PLAYER on the free tier must be blocked from ai_chat.
        Player minimum is 'basic' (level 1); free is level 0.
        """
        gate = require_feature("ai_chat")

        with pytest.raises(HTTPException) as exc_info:
            gate(user=free_user, db=db)

        exc = exc_info.value
        assert exc.status_code == 403
        assert exc.detail["error"] == "tier_required"
        assert exc.detail["required"] == "basic"
        assert exc.detail["current"] == "free"

    def test_ai_chat_allows_basic_player(self, basic_player_user, db):
        """A PLAYER on the basic tier (level 1) meets the ai_chat minimum."""
        gate = require_feature("ai_chat")
        result = gate(user=basic_player_user, db=db)
        assert result.id == basic_player_user.id

    def test_ai_chat_blocks_coach_free(self, coach_free_user, db):
        """
        A COACH on the coach_free tier must be blocked from ai_chat.
        Coach minimum is 'coach_starter' (level 3); coach_free is level 0.
        """
        gate = require_feature("ai_chat")

        with pytest.raises(HTTPException) as exc_info:
            gate(user=coach_free_user, db=db)

        exc = exc_info.value
        assert exc.status_code == 403
        assert exc.detail["error"] == "tier_required"
        assert exc.detail["required"] == "coach_starter"
        assert exc.detail["current"] == "coach_free"

    def test_ai_chat_allows_coach_starter(self, coach_starter_user, db):
        """A COACH on the coach_starter tier (level 3) meets the ai_chat minimum."""
        gate = require_feature("ai_chat")
        result = gate(user=coach_starter_user, db=db)
        assert result.id == coach_starter_user.id


# ---------------------------------------------------------------------------
# quota_check tests
# ---------------------------------------------------------------------------

class TestQuotaCheck:
    def test_quota_exceeded_raises_429(self, free_user, db):
        """
        When a user has consumed their full monthly quota (used == limit),
        quota_check must raise 429 with structured detail.
        Free plan: max_biomech_per_month = 3.
        """
        _seed_biomech_usage(db, free_user, count=3)
        gate = quota_check("biomechanics_analysis")

        with pytest.raises(HTTPException) as exc_info:
            gate(user=free_user, db=db)

        exc = exc_info.value
        assert exc.status_code == 429
        assert exc.detail["error"] == "quota_exceeded"
        assert exc.detail["used"] == 3
        assert exc.detail["limit"] == 3
        assert exc.detail["resets"].endswith("-01")

    def test_quota_under_limit_passes(self, free_user, db):
        """
        When usage is below the plan limit, quota_check must return
        (user, usage_row) without raising.
        Free plan: max_biomech_per_month = 3; seed 2 uses.
        """
        usage_row = _seed_biomech_usage(db, free_user, count=2)
        gate = quota_check("biomechanics_analysis")

        result_user, result_usage = gate(user=free_user, db=db)

        assert result_user.id == free_user.id
        assert result_usage.biomech_count == 2

    def test_quota_no_usage_row_creates_and_passes(self, free_user, db):
        """
        When no monthly_usage row exists yet, quota_check must create one
        (with zero counts) and allow the request through.
        """
        gate = quota_check("biomechanics_analysis")
        result_user, result_usage = gate(user=free_user, db=db)

        assert result_user.id == free_user.id
        assert result_usage.biomech_count == 0

    def test_quota_exceeded_over_limit_also_blocked(self, free_user, db):
        """
        Usage that somehow exceeds the limit (e.g. concurrent writes) must
        still be blocked (used > limit, not just ==).
        """
        _seed_biomech_usage(db, free_user, count=5)
        gate = quota_check("biomechanics_analysis")

        with pytest.raises(HTTPException) as exc_info:
            gate(user=free_user, db=db)

        assert exc_info.value.status_code == 429
        assert exc_info.value.detail["used"] == 5

    def test_platinum_higher_quota_passes(self, platinum_user, db):
        """
        Platinum plan has max_biomech_per_month=50.
        A usage of 3 (which blocks free) must pass for platinum.
        """
        _seed_biomech_usage(db, platinum_user, count=3)
        gate = quota_check("biomechanics_analysis")

        result_user, result_usage = gate(user=platinum_user, db=db)

        assert result_user.id == platinum_user.id
        assert result_usage.biomech_count == 3

    def test_admin_bypasses_quota(self, admin_user, db):
        """
        ADMIN accounts skip quota checks entirely and receive a zeroed
        dummy usage row without touching the database.
        """
        gate = quota_check("biomechanics_analysis")
        result_user, result_usage = gate(user=admin_user, db=db)

        assert result_user.id == admin_user.id
        assert result_usage.biomech_count == 0
        # No real row should have been persisted for the admin.
        from datetime import date
        today = date.today()
        persisted = (
            db.query(MonthlyUsage)
            .filter_by(user_id=admin_user.id, year=today.year, month=today.month)
            .first()
        )
        assert persisted is None
