"""
Monthly usage helpers used by both the API layer and the internal worker callback.

All functions are synchronous to match the rest of the codebase's sync
SQLAlchemy session usage (SessionLocal, not AsyncSession).
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

from database.config import IS_SQLITE
from database.models.monthly_usage import MonthlyUsage


def get_or_create_monthly_usage(user_id: str, db: Session) -> MonthlyUsage:
    """
    Fetch the monthly_usage row for (user_id, current year, current month).
    Creates it atomically if it doesn't exist.

    Uses INSERT … ON CONFLICT DO NOTHING so concurrent requests racing on the
    same (user_id, year, month) don't trip the unique constraint.
    """
    today = date.today()
    year, month = today.year, today.month

    if IS_SQLITE:
        db.execute(
            text(
                "INSERT OR IGNORE INTO monthly_usage "
                "(user_id, year, month, biomech_count, ocr_hours_used, submission_count) "
                "VALUES (:uid, :y, :m, 0, 0, 0)"
            ),
            {"uid": user_id, "y": year, "m": month},
        )
    else:
        db.execute(
            text(
                "INSERT INTO monthly_usage "
                "(user_id, year, month, biomech_count, ocr_hours_used, submission_count) "
                "VALUES (:uid, :y, :m, 0, 0, 0) "
                "ON CONFLICT (user_id, year, month) DO NOTHING"
            ),
            {"uid": user_id, "y": year, "m": month},
        )
    db.commit()

    return (
        db.query(MonthlyUsage)
        .filter(
            MonthlyUsage.user_id == user_id,
            MonthlyUsage.year == year,
            MonthlyUsage.month == month,
        )
        .first()
    )


def report_ocr_usage(user_id: str, actual_hours: float, db: Session) -> MonthlyUsage:
    """
    Reconciliation step called by the Cloud Tasks worker after an OCR job
    completes.  Increments ocr_hours_used by actual_hours.

    We reserved an estimated amount at dispatch time; this writes the ground
    truth, so the delta can be positive (job ran long) or negative (job was
    fast).  Negative deltas are intentionally allowed — the UPDATE uses
    addition, so passing a negative value decrements the counter.

    The row is guaranteed to exist by the time this is called (created at
    dispatch), but we upsert defensively anyway.
    """
    if actual_hours == 0:
        return get_or_create_monthly_usage(user_id, db)

    get_or_create_monthly_usage(user_id, db)

    today = date.today()
    year, month = today.year, today.month

    db.execute(
        text(
            "UPDATE monthly_usage "
            "SET ocr_hours_used = GREATEST(0, ocr_hours_used + :hours) "
            "WHERE user_id = :uid AND year = :y AND month = :m"
        )
        if not IS_SQLITE
        else text(
            "UPDATE monthly_usage "
            "SET ocr_hours_used = MAX(0, ocr_hours_used + :hours) "
            "WHERE user_id = :uid AND year = :y AND month = :m"
        ),
        {"hours": actual_hours, "uid": user_id, "y": year, "m": month},
    )
    db.commit()

    return (
        db.query(MonthlyUsage)
        .filter(
            MonthlyUsage.user_id == user_id,
            MonthlyUsage.year == year,
            MonthlyUsage.month == month,
        )
        .first()
    )
