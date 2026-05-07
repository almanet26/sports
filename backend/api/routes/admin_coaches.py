"""
Admin API routes for coach approval.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, RedirectResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
import logging
import os
from datetime import datetime, timedelta

from database.config import get_db
from database.models.user import User
from database.models.submission import VideoSubmission, SubmissionStatus
from utils.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("/coaches/pending")
def get_pending_coaches(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    pending_coaches = db.query(User).filter(User.role == "COACH", User.coach_status == "pending").all()
    return {
        "coaches": [
            {
                "id": coach.id, "name": coach.name, "email": coach.email,
                "phone": coach.phone, "team": coach.team,
                "profile_bio": coach.profile_bio, "specialization": coach.specialization,
                "coach_category": coach.coach_category, "coach_status": coach.coach_status,
                "coach_document_url": coach.coach_document_url,
                "created_at": coach.created_at.isoformat() if coach.created_at else None,
            }
            for coach in pending_coaches
        ],
        "total": len(pending_coaches)
    }


@router.post("/coaches/{coach_id}/approve")
def approve_coach(coach_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    coach = db.query(User).filter(User.id == coach_id, User.role == "COACH").first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")
    if coach.coach_status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Coach status is {coach.coach_status}, not pending")
    coach.coach_status = "verified"
    db.commit()
    logger.info(f"Coach {coach.email} approved by admin {current_user.email}")
    return {"message": "Coach approved successfully", "coach_id": coach_id, "status": "verified"}


@router.post("/coaches/{coach_id}/reject")
def reject_coach(coach_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    coach = db.query(User).filter(User.id == coach_id, User.role == "COACH").first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")
    if coach.coach_status not in ("pending", "incomplete"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Coach status is {coach.coach_status}, cannot reject")
    coach.coach_status = "rejected"
    db.commit()
    logger.info(f"Coach {coach.email} rejected by admin {current_user.email}")
    return {"message": "Coach application rejected", "coach_id": coach_id, "status": "rejected"}


@router.get("/coaches/all")
def get_all_coaches(status_filter: str = None, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    query = db.query(User).filter(User.role == "COACH")
    if status_filter:
        query = query.filter(User.coach_status == status_filter)
    coaches = query.all()
    return {
        "coaches": [
            {
                "id": coach.id, "name": coach.name, "email": coach.email,
                "phone": coach.phone, "team": coach.team,
                "coach_status": coach.coach_status,
                "coach_document_url": coach.coach_document_url,
                "created_at": coach.created_at.isoformat() if coach.created_at else None,
            }
            for coach in coaches
        ],
        "total": len(coaches)
    }


@router.get("/coaches/{coach_id}/document")
def download_coach_document(coach_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    coach = db.query(User).filter(User.id == coach_id, User.role == "COACH").first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")
    if not coach.coach_document_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No document uploaded")

    stored = coach.coach_document_url

    # Base64 encoded document stored in DB
    if stored.startswith("data:"):
        import base64
        from fastapi.responses import Response
        try:
            header, b64data = stored.split(",", 1)
            mime = header.split(":")[1].split(";")[0]
            ext_map = {
                "application/pdf": ".pdf",
                "image/jpeg": ".jpg",
                "image/png": ".png",
                "application/msword": ".doc",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
            }
            ext = ext_map.get(mime, "")
            content = base64.b64decode(b64data)
            return Response(
                content=content,
                media_type=mime,
                headers={"Content-Disposition": f'attachment; filename="{coach.name}_document{ext}"'}
            )
        except Exception as e:
            logger.error("Failed to decode document for coach %s: %s", coach_id, e)
            raise HTTPException(status_code=500, detail="Failed to decode document")

    # GCS path
    if stored.startswith("gs://"):
        try:
            from google.cloud import storage as gcs
            from datetime import timedelta
            from fastapi.responses import RedirectResponse
            parts = stored[5:].split("/", 1)
            bucket_name, blob_name = parts[0], parts[1]
            gcs_client = gcs.Client()
            blob = gcs_client.bucket(bucket_name).blob(blob_name)
            signed_url = blob.generate_signed_url(version="v4", expiration=timedelta(minutes=15), method="GET")
            return RedirectResponse(url=signed_url)
        except Exception as e:
            logger.error("GCS signed URL failed: %s", e)
            raise HTTPException(status_code=500, detail="Failed to generate download URL")

    # Local fallback
    file_path = stored if stored.startswith("storage/") else f"storage/{stored}"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found")
    ext = os.path.splitext(file_path)[1]
    return FileResponse(path=file_path, filename=f"{coach.name}_document{ext}", media_type="application/octet-stream")


@router.get("/coach/dashboard-stats")
def get_coach_dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Coach dashboard — real stats: unique players, submission counts, recent players, monthly chart."""
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

    # Recent unique players
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
            recent_players.append({
                "id": sub.player_id,
                "name": sub.player.name,
                "email": sub.player.email,
                "analysis_type": sub.analysis_type,
                "last_submission": sub.created_at.isoformat() if sub.created_at else None,
                "status": sub.status.value if isinstance(sub.status, SubmissionStatus) else sub.status,
            })
            if len(recent_players) >= 10:
                break

    # Monthly submissions chart (last 6 months)
    monthly_data = []
    for i in range(5, -1, -1):
        month_start = (datetime.utcnow().replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        count = db.query(func.count(VideoSubmission.id)).filter(
            VideoSubmission.coach_id == coach_id,
            VideoSubmission.created_at >= month_start,
            VideoSubmission.created_at < month_end,
        ).scalar() or 0
        monthly_data.append({"month": month_start.strftime("%b"), "submissions": count})

    return {
        "total_submissions": total_submissions,
        "unique_players": unique_players,
        "pending": pending,
        "published": published,
        "draft_review": draft_review,
        "batting_count": batting_count,
        "bowling_count": bowling_count,
        "recent_players": recent_players,
        "monthly_data": monthly_data,
    }
