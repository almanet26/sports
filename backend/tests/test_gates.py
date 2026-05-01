"""
Tests for feature_gate and quota_gate dependencies.

The dependency inner functions (_gate) are called directly with explicit
`user` and `db` arguments, bypassing FastAPI's DI machinery entirely.
This keeps tests fast (no HTTP layer) while still exercising the real
database queries against an in-memory SQLite database.

Plan config seeded in conftest:
  free     → max_biomech_per_month=3
  platinum → max_biomech_per_month=50
"""

import sys
from datetime import date
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.models.monthly_usage import MonthlyUsage
from dependencies.feature_gate import require_feature
from dependencies.quota_gate import quota_check


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_biomech_usage(db, user, count: int) -> MonthlyUsage:
    """Insert (or return existing) a monthly_usage row with biomech_count=count."""
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
        A free-tier user with an active subscription must be rejected with 403
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
        A platinum-tier user with an active subscription must pass through the
        gate and receive their User object back.
        """
        gate = require_feature("pdf_report")

        result = gate(user=platinum_user, db=db)

        assert result.id == platinum_user.id
        assert result.role == "platinum"

    def test_inactive_subscription_raises_402(self, db):
        """
        Any user whose subscription status is not 'active' must get 402,
        regardless of their tier.
        """
        import uuid
        from datetime import datetime, timedelta
        from database.models.user import User
        from database.models.subscription import Subscription

        user = User(
            id=str(uuid.uuid4()),
            name="Expired Platinum",
            email=f"expired_{uuid.uuid4().hex[:6]}@test.invalid",
            password_hash="$2b$12$placeholder",
            role="platinum",
            subscription_plan="BASIC",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.flush()

        now = datetime.utcnow()
        db.add(Subscription(
            user_id=user.id,
            plan_key="platinum",
            role="platinum",
            status="expired",          # <— not active
            started_at=now - timedelta(days=100),
            expires_at=now - timedelta(days=10),
        ))
        db.commit()
        db.refresh(user)

        gate = require_feature("pdf_report")
        with pytest.raises(HTTPException) as exc_info:
            gate(user=user, db=db)

        assert exc_info.value.status_code == 402
        assert exc_info.value.detail == "Subscription inactive"

    def test_platinum_can_access_basic_feature(self, platinum_user, db):
        """Higher tiers must pass gates for lower-tier features."""
        gate = require_feature("ai_chat")   # requires basic
        result = gate(user=platinum_user, db=db)
        assert result.id == platinum_user.id


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
        _seed_biomech_usage(db, free_user, count=3)  # at the limit
        gate = quota_check("biomechanics_analysis")

        with pytest.raises(HTTPException) as exc_info:
            gate(user=free_user, db=db)

        exc = exc_info.value
        assert exc.status_code == 429
        assert exc.detail["error"] == "quota_exceeded"
        assert exc.detail["used"] == 3
        assert exc.detail["limit"] == 3
        # resets field must be ISO date string for the 1st of next month
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
        _seed_biomech_usage(db, free_user, count=5)  # over the limit of 3
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
