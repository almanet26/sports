"""
Monthly feature-usage helpers shared by the API layer and the worker callback.

Backed by the normalized feature_usage table (one row per user x feature x calendar month).  Synchronous to match the rest of the codebase's sync SQLAlchemy session usage.
"""

from __future__ import annotations
from datetime import date
from sqlalchemy import text
from sqlalchemy.orm import Session
from database.config import IS_SQLITE
from database.models.feature import Feature


def _period_start() -> date:
    today = date.today()
    return date(today.year, today.month, 1)


def _feature_id(db: Session, feature_key: str) -> int | None:
    row = db.query(Feature.id).filter(Feature.key == feature_key).first()
    return row[0] if row else None


def _ensure_row(db: Session, user_id: str, feature_id: int, period: date) -> None:
    if IS_SQLITE:
        db.execute(
            text(
                "INSERT OR IGNORE INTO feature_usage (user_id, feature_id, period_start, used) "
                "VALUES (:uid, :fid, :ps, 0)"
            ),
            {"uid": user_id, "fid": feature_id, "ps": period},
        )
    else:
        db.execute(
            text(
                "INSERT INTO feature_usage (user_id, feature_id, period_start, used) "
                "VALUES (:uid, :fid, :ps, 0) "
                "ON CONFLICT (user_id, feature_id, period_start) DO NOTHING"
            ),
            {"uid": user_id, "fid": feature_id, "ps": period},
        )
    db.commit()


def report_ocr_usage(user_id: str, actual_hours: float, db: Session) -> None:
    """
    Reconcile OCR consumption after a job completes (or refund a reservation).

    Adds `actual_hours` (which may be negative for a refund) to the user's ocr_highlights usage for the current month, clamped at zero so refunds never drive the counter below 0.  No-op if the feature is not seeded.
    """
    if actual_hours == 0:
        return

    feature_id = _feature_id(db, "ocr_highlights")
    if feature_id is None:
        return

    period = _period_start()
    _ensure_row(db, user_id, feature_id, period)

    clamp = "MAX(0, used + :hours)" if IS_SQLITE else "GREATEST(0, used + :hours)"
    db.execute(
        text(
            f"UPDATE feature_usage SET used = {clamp} "
            f"WHERE user_id = :uid AND feature_id = :fid AND period_start = :ps"
        ),
        {"hours": actual_hours, "uid": user_id, "fid": feature_id, "ps": period},
    )
    db.commit()


def get_feature_used_since(user_id: str, feature_key: str, since: date, db: Session) -> float:
    """
    Total consumption of `feature_key` for `user_id` across all monthly periods on or after `since` (first-of-month).  Returns 0.0 if none / not seeded.
    """
    feature_id = _feature_id(db, feature_key)
    if feature_id is None:
        return 0.0
    row = db.execute(
        text(
            "SELECT COALESCE(SUM(used), 0) FROM feature_usage "
            "WHERE user_id = :uid AND feature_id = :fid AND period_start >= :since"
        ),
        {"uid": user_id, "fid": feature_id, "since": date(since.year, since.month, 1)},
    ).first()
    return float(row[0]) if row and row[0] is not None else 0.0


def get_monthly_usage_map(user_id: str, db: Session) -> dict[str, float]:
    """
    Return {feature_key: used} for the user's current-month feature_usage rows. Used to assemble billing/usage snapshots.
    """
    period = _period_start()
    rows = db.execute(
        text(
            "SELECT f.key, fu.used "
            "FROM feature_usage fu JOIN features f ON f.id = fu.feature_id "
            "WHERE fu.user_id = :uid AND fu.period_start = :ps"
        ),
        {"uid": user_id, "ps": period},
    ).fetchall()
    return {key: used for key, used in rows}
