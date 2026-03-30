"""
CRUD operations for Batting Analysis.
"""

import logging
from typing import Optional
from sqlalchemy.orm import Session

from database.models.batting import BattingAnalysis

logger = logging.getLogger(__name__)


def create_batting_analysis(
    db: Session,
    *,
    player_id: str,
    original_filename: Optional[str] = None,
    avg_head_alignment: Optional[float] = None,
    avg_stride_length: Optional[float] = None,
    avg_backlift_height: Optional[float] = None,
    avg_front_knee_angle: Optional[float] = None,
    avg_shoulder_rotation: Optional[float] = None,
    metrics_snapshot: Optional[dict] = None,
    phase_info: Optional[dict] = None,
    ai_feedback: Optional[str] = None,
    report_url: Optional[str] = None,
) -> BattingAnalysis:
    """Persist a new batting analysis result."""
    analysis = BattingAnalysis(
        player_id=player_id,
        original_filename=original_filename,
        avg_head_alignment=avg_head_alignment,
        avg_stride_length=avg_stride_length,
        avg_backlift_height=avg_backlift_height,
        avg_front_knee_angle=avg_front_knee_angle,
        avg_shoulder_rotation=avg_shoulder_rotation,
        metrics_snapshot=metrics_snapshot,
        phase_info=phase_info,
        ai_feedback=ai_feedback,
        report_url=report_url,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    logger.info("Created BattingAnalysis %s for player %s", analysis.id, player_id)
    return analysis


def get_batting_analysis_by_id(db: Session, analysis_id: str) -> Optional[BattingAnalysis]:
    """Fetch a single analysis by primary key."""
    return db.query(BattingAnalysis).filter(BattingAnalysis.id == analysis_id).first()


def list_batting_analyses_for_player(
    db: Session,
    player_id: str,
    *,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[BattingAnalysis], int]:
    """Return paginated analyses for a player, newest first."""
    query = (
        db.query(BattingAnalysis)
        .filter(BattingAnalysis.player_id == player_id)
        .order_by(BattingAnalysis.created_at.desc())
    )
    total = query.count()
    results = query.offset(offset).limit(limit).all()
    return results, total


def delete_batting_analysis(db: Session, analysis_id: str) -> bool:
    """Delete an analysis record. Returns True if deleted."""
    record = get_batting_analysis_by_id(db, analysis_id)
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True
