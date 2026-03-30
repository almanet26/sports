"""
CRUD operations for Bowling Analysis.
"""

import logging
from typing import Optional
from sqlalchemy.orm import Session

from database.models.bowling import BowlingAnalysis

logger = logging.getLogger(__name__)


def create_bowling_analysis(
    db: Session,
    *,
    player_id: str,
    original_filename: Optional[str] = None,
    avg_elbow_angle: Optional[float] = None,
    release_consistency: Optional[float] = None,
    metrics_snapshot: Optional[dict] = None,
    ai_feedback: Optional[str] = None,
    report_url: Optional[str] = None,
) -> BowlingAnalysis:
    """Persist a new bowling analysis result."""
    analysis = BowlingAnalysis(
        player_id=player_id,
        original_filename=original_filename,
        avg_elbow_angle=avg_elbow_angle,
        release_consistency=release_consistency,
        metrics_snapshot=metrics_snapshot,
        ai_feedback=ai_feedback,
        report_url=report_url,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    logger.info("Created BowlingAnalysis %s for player %s", analysis.id, player_id)
    return analysis


def get_analysis_by_id(db: Session, analysis_id: str) -> Optional[BowlingAnalysis]:
    """Fetch a single analysis by primary key."""
    return db.query(BowlingAnalysis).filter(BowlingAnalysis.id == analysis_id).first()


def list_analyses_for_player(
    db: Session,
    player_id: str,
    *,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[BowlingAnalysis], int]:
    """Return paginated analyses for a player, newest first."""
    query = (
        db.query(BowlingAnalysis)
        .filter(BowlingAnalysis.player_id == player_id)
        .order_by(BowlingAnalysis.created_at.desc())
    )
    total = query.count()
    results = query.offset(offset).limit(limit).all()
    return results, total


def delete_analysis(db: Session, analysis_id: str) -> bool:
    """Delete an analysis record. Returns True if deleted."""
    record = get_analysis_by_id(db, analysis_id)
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True
