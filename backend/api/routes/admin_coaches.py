"""
Admin API routes for coach approval.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel, ConfigDict
import logging
import os

from database.config import get_db
from database.models.user import User
from database.models.submission import VideoSubmission, SubmissionStatus
from utils.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class CoachSummaryResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    team: Optional[str] = None
    profile_bio: Optional[str] = None
    specialization: Optional[list] = None
    coach_category: Optional[str] = None
    coach_status: Optional[str] = None
    coach_document_url: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CoachListResponse(BaseModel):
    coaches: List[CoachSummaryResponse]
    total: int


class CoachActionResponse(BaseModel):
    message: str
    coach_id: str
    status: str


class RecentPlayerResponse(BaseModel):
    id: str
    name: str
    email: str
    analysis_type: str
    last_submission: Optional[str] = None
    status: str


class MonthlyDataPoint(BaseModel):
    month: str
    submissions: int


class CoachDashboardStatsResponse(BaseModel):
    total_submissions: int
    unique_players: int
    pending: int
    published: int
    draft_review: int
    batting_count: int
    bowling_count: int
    recent_players: List[RecentPlayerResponse]
    monthly_data: List[MonthlyDataPoint]


# ── Dependency ────────────────────────────────────────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/coaches/pending", response_model=CoachListResponse)
def get_pending_coaches(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    coaches = db.query(User).filter(User.role == "COACH", User.coach_status == "pending").all()
    return CoachListResponse(
        coaches=[CoachSummaryResponse.model_validate(c) for c in coaches],
        total=len(coaches),
    )


@router.post("/coaches/{coach_id}/approve", response_model=CoachActionResponse)
def approve_coach(
    coach_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    coach = db.query(User).filter(User.id == coach_id, User.role == "COACH").first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")
    if coach.coach_status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Coach status is {coach.coach_status}, not pending")

    coach.coach_status = "verified"
    db.commit()
    logger.info(f"Coach {coach.email} approved by admin {current_user.email}")
    return CoachActionResponse(message="Coach approved successfully", coach_id=coach_id, status="verified")


@router.post("/coaches/{coach_id}/reject", response_model=CoachActionResponse)
def reject_coach(
    coach_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    coach = db.query(User).filter(User.id == coach_id, User.role == "COACH").first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")
    if coach.coach_status not in ("pending", "incomplete"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Coach status is {coach.coach_status}, cannot reject")

    coach.coach_status = "rejected"
    db.commit()
    logger.info(f"Coach {coach.email} rejected by admin {current_user.email}")
    return CoachActionResponse(message="Coach application rejected", coach_id=coach_id, status="rejected")


@router.get("/coaches/all", response_model=CoachListResponse)
def get_all_coaches(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(User).filter(User.role == "COACH")
    if status_filter:
        query = query.filter(User.coach_status == status_filter)
    coaches = query.all()
    return CoachListResponse(
        coaches=[CoachSummaryResponse.model_validate(c) for c in coaches],
        total=len(coaches),
    )


@router.get("/coaches/{coach_id}/document")
def download_coach_document(
    coach_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    coach = db.query(User).filter(User.id == coach_id, User.role == "COACH").first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")
    if not coach.coach_document_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No document uploaded")

    file_path = coach.coach_document_url
    if file_path.startswith('/static/'):
        file_path = file_path.replace('/static/', 'storage/', 1)
    elif not file_path.startswith('storage/'):
        file_path = f"storage/{file_path}"

    if not os.path.exists(file_path):
        logger.error(f"Document not found at path: '{file_path}' (stored url: '{coach.coach_document_url}')")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found on server")

    return FileResponse(
        path=file_path,
        filename=f"{coach.name}_document{os.path.splitext(file_path)[1]}",
        media_type="application/octet-stream",
    )


@router.get("/coach/dashboard-stats", response_model=CoachDashboardStatsResponse)
def get_coach_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("COACH", "ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coach access required")

    coach_id = current_user.id

    total_submissions = db.query(func.count(VideoSubmission.id)).filter(VideoSubmission.coach_id == coach_id).scalar() or 0
    unique_players = db.query(func.count(distinct(VideoSubmission.player_id))).filter(VideoSubmission.coach_id == coach_id).scalar() or 0
    pending = db.query(func.count(VideoSubmission.id)).filter(VideoSubmission.coach_id == coach_id, VideoSubmission.status == SubmissionStatus.PENDING).scalar() or 0
    published = db.query(func.count(VideoSubmission.id)).filter(VideoSubmission.coach_id == coach_id, VideoSubmission.status == SubmissionStatus.PUBLISHED).scalar() or 0
    draft_review = db.query(func.count(VideoSubmission.id)).filter(VideoSubmission.coach_id == coach_id, VideoSubmission.status == SubmissionStatus.DRAFT_REVIEW).scalar() or 0
    batting_count = db.query(func.count(VideoSubmission.id)).filter(VideoSubmission.coach_id == coach_id, VideoSubmission.analysis_type == "BATTING").scalar() or 0
    bowling_count = db.query(func.count(VideoSubmission.id)).filter(VideoSubmission.coach_id == coach_id, VideoSubmission.analysis_type == "BOWLING").scalar() or 0

    recent_subs = (
        db.query(VideoSubmission)
        .filter(VideoSubmission.coach_id == coach_id)
        .order_by(VideoSubmission.created_at.desc())
        .limit(50).all()
    )
    seen: set = set()
    recent_players = []
    for sub in recent_subs:
        if sub.player_id not in seen and sub.player:
            seen.add(sub.player_id)
            recent_players.append(RecentPlayerResponse(
                id=sub.player_id,
                name=sub.player.name,
                email=sub.player.email,
                analysis_type=sub.analysis_type,
                last_submission=sub.created_at.isoformat() if sub.created_at else None,
                status=sub.status.value if isinstance(sub.status, SubmissionStatus) else sub.status,
            ))
            if len(recent_players) >= 10:
                break

    monthly_data = []
    for i in range(5, -1, -1):
        month_start = (datetime.utcnow().replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        count = db.query(func.count(VideoSubmission.id)).filter(
            VideoSubmission.coach_id == coach_id,
            VideoSubmission.created_at >= month_start,
            VideoSubmission.created_at < month_end,
        ).scalar() or 0
        monthly_data.append(MonthlyDataPoint(month=month_start.strftime("%b"), submissions=count))

    return CoachDashboardStatsResponse(
        total_submissions=total_submissions,
        unique_players=unique_players,
        pending=pending,
        published=published,
        draft_review=draft_review,
        batting_count=batting_count,
        bowling_count=bowling_count,
        recent_players=recent_players,
        monthly_data=monthly_data,
    )
