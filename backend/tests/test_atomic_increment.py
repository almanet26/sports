"""
Tests for quota_gate.increment_usage_atomic — the race-safe check-and-increment used at job dispatch — and increment_usage — the unconditional worker reconciliation upsert. Both now operate on the normalized feature_usage table, resolving the live limit from plan_entitlements.

Legacy field names map to feature keys:
  biomech_count    → biomechanics_analysis
  ocr_hours_used   → ocr_highlights
  submission_count → player_submission

Relevant baseline limits:
  bronze         → biomechanics_analysis = 3
  coach_basic    → biomechanics_analysis (none → blocked), ocr_highlights = 10
  coach_platinum → ocr_highlights = 50
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dependencies.quota_gate import increment_usage, increment_usage_atomic
from tests.conftest import seed_feature_usage, get_feature_usage


# ---------------------------------------------------------------------------
# increment_usage_atomic — biomech (bronze limit = 3)
# ---------------------------------------------------------------------------

class TestIncrementUsageAtomic:
    def test_increment_under_limit_returns_true(self, bronze_user, db):
        seed_feature_usage(db, bronze_user.id, "biomechanics_analysis", 2)
        result = increment_usage_atomic(bronze_user.id, "biomech_count", "max_biomech_per_month", 1, db)
        assert result is True
        assert get_feature_usage(db, bronze_user.id, "biomechanics_analysis") == 3

    def test_increment_at_limit_returns_false(self, bronze_user, db):
        seed_feature_usage(db, bronze_user.id, "biomechanics_analysis", 3)
        result = increment_usage_atomic(bronze_user.id, "biomech_count", "max_biomech_per_month", 1, db)
        assert result is False
        assert get_feature_usage(db, bronze_user.id, "biomechanics_analysis") == 3

    def test_increment_would_exceed_limit_returns_false(self, bronze_user, db):
        seed_feature_usage(db, bronze_user.id, "biomechanics_analysis", 2)
        result = increment_usage_atomic(bronze_user.id, "biomech_count", "max_biomech_per_month", 2, db)
        assert result is False
        assert get_feature_usage(db, bronze_user.id, "biomechanics_analysis") == 2  # unchanged

    def test_increment_creates_row_if_missing(self, bronze_user, db):
        assert get_feature_usage(db, bronze_user.id, "biomechanics_analysis") == 0
        result = increment_usage_atomic(bronze_user.id, "biomech_count", "max_biomech_per_month", 1, db)
        assert result is True
        assert get_feature_usage(db, bronze_user.id, "biomechanics_analysis") == 1

    def test_increment_when_feature_not_entitled_fails(self, coach_basic_user, db):
        # coach_basic plans do not grant biomechanics_analysis at all → blocked.
        result = increment_usage_atomic(coach_basic_user.id, "biomech_count", "max_biomech_per_month", 1, db)
        assert result is False

    def test_increment_ocr_hours_under_limit(self, coach_platinum_user, db):
        seed_feature_usage(db, coach_platinum_user.id, "ocr_highlights", 20.0)
        result = increment_usage_atomic(coach_platinum_user.id, "ocr_hours_used", "max_ocr_hours_per_month", 10.0, db)
        assert result is True
        assert abs(get_feature_usage(db, coach_platinum_user.id, "ocr_highlights") - 30.0) < 0.001

    def test_increment_ocr_hours_exceeds_limit(self, coach_platinum_user, db):
        seed_feature_usage(db, coach_platinum_user.id, "ocr_highlights", 49.0)
        result = increment_usage_atomic(coach_platinum_user.id, "ocr_hours_used", "max_ocr_hours_per_month", 2.0, db)
        assert result is False

    def test_invalid_field_raises_value_error(self, bronze_user, db):
        with pytest.raises(ValueError):
            increment_usage_atomic(bronze_user.id, "nonexistent_field", "x", 1, db)


# ---------------------------------------------------------------------------
# increment_usage — unconditional worker reconciliation
# ---------------------------------------------------------------------------

class TestIncrementUsage:
    @pytest.mark.asyncio
    async def test_creates_row_and_increments(self, bronze_user, db):
        assert get_feature_usage(db, bronze_user.id, "biomechanics_analysis") == 0
        row = await increment_usage(bronze_user.id, "biomech_count", 1, db)
        assert row is not None
        assert row.used == 1

    @pytest.mark.asyncio
    async def test_increments_existing_row(self, bronze_user, db):
        seed_feature_usage(db, bronze_user.id, "biomechanics_analysis", 3)
        row = await increment_usage(bronze_user.id, "biomech_count", 2, db)
        assert row.used == 5

    @pytest.mark.asyncio
    async def test_exceeds_plan_limit_without_blocking(self, bronze_user, db):
        # Unconditional: must NOT enforce the bronze limit of 3.
        seed_feature_usage(db, bronze_user.id, "biomechanics_analysis", 3)
        row = await increment_usage(bronze_user.id, "biomech_count", 10, db)
        assert row.used == 13

    @pytest.mark.asyncio
    async def test_increments_ocr_hours(self, coach_platinum_user, db):
        seed_feature_usage(db, coach_platinum_user.id, "ocr_highlights", 2.5)
        row = await increment_usage(coach_platinum_user.id, "ocr_hours_used", 1.25, db)
        assert abs(row.used - 3.75) < 0.001

    @pytest.mark.asyncio
    async def test_invalid_field_raises_value_error(self, bronze_user, db):
        with pytest.raises(ValueError):
            await increment_usage(bronze_user.id, "bad_field", 1, db)
