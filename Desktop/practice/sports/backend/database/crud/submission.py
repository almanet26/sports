"""
CRUD operations for VideoSubmission (B2B2C pipeline).
"""

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from database.models.submission import VideoSubmission, SubmissionStatus


# Create 
def create_submission(
    db: Session,
    *,
    player_id: str,
    coach_id: str,
    original_filename: str,
    video_url: str,
    analysis_type: str = "BATTING",
) -> VideoSubmission:
    """Create a new submission in PENDING state."""
    sub = VideoSubmission(
        player_id=player_id,
        coach_id=coach_id,
        original_filename=original_filename,
        video_url=video_url,
        analysis_type=analysis_type,
        status=SubmissionStatus.PENDING,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


# Read
def get_submission_by_id(db: Session, submission_id: str) -> Optional[VideoSubmission]:
    return db.query(VideoSubmission).filter(VideoSubmission.id == submission_id).first()


def list_submissions_for_player(
    db: Session,
    player_id: str,
    *,
    status_filter: Optional[SubmissionStatus] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[VideoSubmission], int]:
    """Return submissions visible to a player.
    By default only PUBLISHED ones (player shouldn't see drafts).
    Pass status_filter=None to get PUBLISHED only, or a specific status."""
    q = db.query(VideoSubmission).filter(VideoSubmission.player_id == player_id)
    if status_filter:
        q = q.filter(VideoSubmission.status == status_filter)
    else:
        q = q.filter(VideoSubmission.status == SubmissionStatus.PUBLISHED)
    total = q.count()
    items = q.order_by(VideoSubmission.created_at.desc()).offset(offset).limit(limit).all()
    return items, total


def list_submissions_for_coach(
    db: Session,
    coach_id: str,
    *,
    status_filter: Optional[SubmissionStatus] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[VideoSubmission], int]:
    """Return coach's inbox: PENDING + DRAFT_REVIEW by default."""
    q = db.query(VideoSubmission).filter(VideoSubmission.coach_id == coach_id)
    if status_filter:
        q = q.filter(VideoSubmission.status == status_filter)
    else:
        q = q.filter(
            VideoSubmission.status.in_([
                SubmissionStatus.PENDING,
                SubmissionStatus.DRAFT_REVIEW,
            ])
        )
    total = q.count()
    items = q.order_by(VideoSubmission.created_at.desc()).offset(offset).limit(limit).all()
    return items, total


# Update: State transitions
def mark_processing(db: Session, submission: VideoSubmission) -> VideoSubmission:
    """PENDING → PROCESSING"""
    submission.status = SubmissionStatus.PROCESSING
    db.commit()
    db.refresh(submission)
    return submission


def save_analysis_results(
    db: Session,
    submission: VideoSubmission,
    *,
    raw_biometrics: dict,
    phase_info: dict,
    ai_draft_text: str,
    annotated_video_url: Optional[str] = None,
    key_frame_url: Optional[str] = None,
) -> VideoSubmission:
    """PROCESSING → DRAFT_REVIEW — save AI results."""
    submission.raw_biometrics = raw_biometrics
    submission.phase_info = phase_info
    submission.ai_draft_text = ai_draft_text
    submission.annotated_video_url = annotated_video_url
    submission.key_frame_url = key_frame_url
    submission.analyzed_at = datetime.utcnow()
    submission.status = SubmissionStatus.DRAFT_REVIEW
    db.commit()
    db.refresh(submission)
    return submission


def publish_submission(
    db: Session,
    submission: VideoSubmission,
    *,
    coach_final_text: str,
    pdf_report_url: str,
) -> VideoSubmission:
    """DRAFT_REVIEW → PUBLISHED — coach approved."""
    submission.coach_final_text = coach_final_text
    submission.pdf_report_url = pdf_report_url
    submission.published_at = datetime.utcnow()
    submission.status = SubmissionStatus.PUBLISHED
    db.commit()
    db.refresh(submission)
    return submission


# Delete 
def delete_submission(db: Session, submission_id: str) -> bool:
    sub = get_submission_by_id(db, submission_id)
    if not sub:
        return False
    db.delete(sub)
    db.commit()
    return True
