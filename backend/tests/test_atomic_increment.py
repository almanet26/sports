"""
Tests for quota_gate.increment_usage_atomic — the race-safe check-and-increment
used at OCR job dispatch time.

The function uses a single UPDATE with a correlated subquery so that the
increment only applies when usage + amount <= plan limit. rowcount > 0 means
the increment was applied; rowcount == 0 means it was blocked.

Plan config seeded in conftest (relevant rows):
  free          → max_biomech_per_month=3
  coach_free    → max_biomech_per_month=0, max_ocr_hours_per_month=0
  coach_starter → max_biomech_per_month=999, max_ocr_hours_per_month=50.0
"""

import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.models.monthly_usage import MonthlyUsage
from dependencies.quota_gate import increment_usage, increment_usage_atomic


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_usage(db, user, *, biomech=0, ocr=0.0, submissions=0) -> MonthlyUsage:
    today = date.today()
    row = MonthlyUsage(
        user_id=user.id,
        year=today.year,
        month=today.month,
        biomech_count=biomech,
        ocr_hours_used=ocr,
        submission_count=submissions,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _get_usage(db, user_id: str) -> MonthlyUsage | None:
    today = date.today()
    return (
        db.query(MonthlyUsage)
        .filter_by(user_id=user_id, year=today.year, month=today.month)
        .first()
    )


# ---------------------------------------------------------------------------
# biomech_count tests (free plan: limit = 3)
# ---------------------------------------------------------------------------

class TestIncrementUsageAtomic:
    def test_increment_under_limit_returns_true(self, free_user, db):
        """
        biomech_count=2, increment by 1 → 3 <= 3 limit → True.
        The row must reflect the new count.
        """
        _seed_usage(db, free_user, biomech=2)
        result = increment_usage_atomic(
            user_id=free_user.id,
            field="biomech_count",
            limit_col="max_biomech_per_month",
            amount=1,
            db=db,
        )
        assert result is True
        row = _get_usage(db, free_user.id)
        assert row.biomech_count == 3

    def test_increment_at_limit_returns_false(self, free_user, db):
        """
        biomech_count=3 (at limit=3), increment by 1 → 4 > 3 → False.
        The row must remain unchanged.
        """
        _seed_usage(db, free_user, biomech=3)
        result = increment_usage_atomic(
            user_id=free_user.id,
            field="biomech_count",
            limit_col="max_biomech_per_month",
            amount=1,
            db=db,
        )
        assert result is False
        row = _get_usage(db, free_user.id)
        assert row.biomech_count == 3

    def test_increment_would_exceed_limit_returns_false(self, free_user, db):
        """
        biomech_count=2, increment by 2 → 4 > 3 limit → False.
        Partial increments that would overshoot the cap must be rejected atomically.
        """
        _seed_usage(db, free_user, biomech=2)
        result = increment_usage_atomic(
            user_id=free_user.id,
            field="biomech_count",
            limit_col="max_biomech_per_month",
            amount=2,
            db=db,
        )
        assert result is False
        row = _get_usage(db, free_user.id)
        assert row.biomech_count == 2  # unchanged

    def test_increment_creates_row_if_missing(self, free_user, db):
        """
        When no monthly_usage row exists, increment_usage_atomic must create
        one via INSERT OR IGNORE and then apply the increment.
        free plan limit = 3, so +1 from 0 must succeed.
        """
        assert _get_usage(db, free_user.id) is None

        result = increment_usage_atomic(
            user_id=free_user.id,
            field="biomech_count",
            limit_col="max_biomech_per_month",
            amount=1,
            db=db,
        )
        assert result is True
        row = _get_usage(db, free_user.id)
        assert row is not None
        assert row.biomech_count == 1

    def test_increment_at_zero_limit_always_fails(self, coach_free_user, db):
        """
        coach_free plan has max_biomech_per_month=0.
        Any increment must be rejected because nothing + amount <= 0 is false.
        """
        _seed_usage(db, coach_free_user, biomech=0)
        result = increment_usage_atomic(
            user_id=coach_free_user.id,
            field="biomech_count",
            limit_col="max_biomech_per_month",
            amount=1,
            db=db,
        )
        assert result is False

    def test_increment_ocr_hours_under_limit(self, coach_starter_user, db):
        """
        coach_starter plan has max_ocr_hours_per_month=50.0.
        ocr_hours_used=20.0, increment by 10.0 → 30.0 <= 50.0 → True.
        """
        _seed_usage(db, coach_starter_user, ocr=20.0)
        result = increment_usage_atomic(
            user_id=coach_starter_user.id,
            field="ocr_hours_used",
            limit_col="max_ocr_hours_per_month",
            amount=10.0,
            db=db,
        )
        assert result is True
        row = _get_usage(db, coach_starter_user.id)
        assert abs(row.ocr_hours_used - 30.0) < 0.001

    def test_increment_ocr_hours_exceeds_limit(self, coach_starter_user, db):
        """
        coach_starter plan: max_ocr=50.0, used=49.0, increment 2.0 → 51.0 > 50.0 → False.
        """
        _seed_usage(db, coach_starter_user, ocr=49.0)
        result = increment_usage_atomic(
            user_id=coach_starter_user.id,
            field="ocr_hours_used",
            limit_col="max_ocr_hours_per_month",
            amount=2.0,
            db=db,
        )
        assert result is False

    def test_invalid_field_raises_value_error(self, free_user, db):
        """Passing an unrecognised field name must raise ValueError immediately."""
        with pytest.raises(ValueError, match="invalid field"):
            increment_usage_atomic(
                user_id=free_user.id,
                field="nonexistent_field",
                limit_col="max_biomech_per_month",
                amount=1,
                db=db,
            )


# ---------------------------------------------------------------------------
# increment_usage — async worker reconciliation (unconditional upsert)
# ---------------------------------------------------------------------------

class TestIncrementUsage:
    """
    increment_usage is called by the Cloud Run worker after a job completes to
    record actual consumption. It is unconditional: no quota check, no plan
    lookup. It must create the row if absent and always apply the delta.
    """

    @pytest.mark.asyncio
    async def test_creates_row_and_increments(self, free_user, db):
        """When no usage row exists, the function must create one and apply the delta."""
        assert _get_usage(db, free_user.id) is None

        row = await increment_usage(free_user.id, "biomech_count", 1, db)

        assert row is not None
        assert row.biomech_count == 1

    @pytest.mark.asyncio
    async def test_increments_existing_row(self, free_user, db):
        """When a usage row exists, increment_usage must add to it unconditionally."""
        _seed_usage(db, free_user, biomech=3)

        row = await increment_usage(free_user.id, "biomech_count", 2, db)

        assert row.biomech_count == 5

    @pytest.mark.asyncio
    async def test_exceeds_plan_limit_without_blocking(self, free_user, db):
        """
        Unlike increment_usage_atomic, this function must NOT enforce quota.
        The worker reconciles real consumption after the fact — blocking here
        would silently discard billed work.
        Free plan limit = 3; writing 10 must succeed.
        """
        _seed_usage(db, free_user, biomech=3)

        row = await increment_usage(free_user.id, "biomech_count", 10, db)

        assert row.biomech_count == 13  # 3 existing + 10 delta, no cap applied

    @pytest.mark.asyncio
    async def test_increments_ocr_hours(self, coach_starter_user, db):
        """Float delta must apply correctly to ocr_hours_used."""
        _seed_usage(db, coach_starter_user, ocr=2.5)

        row = await increment_usage(coach_starter_user.id, "ocr_hours_used", 1.25, db)

        assert abs(row.ocr_hours_used - 3.75) < 0.001

    @pytest.mark.asyncio
    async def test_invalid_field_raises_value_error(self, free_user, db):
        """Passing an unrecognised field name must raise ValueError immediately."""
        with pytest.raises(ValueError):
            await increment_usage(free_user.id, "bad_field", 1, db)
