"""
Admin API routes for coach approval.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
import logging
import os

from database.config import get_db
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


def get_public_document_url(file_path: str | None):
    if not file_path:
        return None
    if file_path.startswith("http://") or file_path.startswith("https://") or file_path.startswith("/static/"):
        return file_path
    filename = os.path.basename(file_path)
    return f"/static/coach_documents/{filename}"


def serialize_coach(coach: User):
    return {
        "id": coach.id,
        "name": coach.name,
        "email": coach.email,
        "phone": coach.phone,
        "team": coach.team,
        "coach_status": coach.coach_status,
        "coach_document_url": coach.coach_document_url,
        "document_url": get_public_document_url(coach.coach_document_url),
        "verification_document_type": coach.verification_document_type,
        "verification_approved_at": coach.verification_approved_at.isoformat() if coach.verification_approved_at else None,
        "created_at": coach.created_at.isoformat() if coach.created_at else None,
    }


def require_admin(current_user: User = Depends(get_current_user)):
    """Dependency to ensure user is an admin."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.get("/coaches/pending")
def get_pending_coaches(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all coaches with pending status."""
    pending_coaches = db.query(User).filter(
        User.role == "COACH",
        User.coach_status == "pending"
    ).all()
    
    return {
        "coaches": [serialize_coach(coach) for coach in pending_coaches],
        "total": len(pending_coaches)
    }


@router.post("/coaches/{coach_id}/approve")
def approve_coach(
    coach_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Approve a pending coach."""
    coach = db.query(User).filter(
        User.id == coach_id,
        User.role == "COACH"
    ).first()
    
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach not found"
        )
    
    if coach.coach_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Coach status is {coach.coach_status}, not pending"
        )
    
    coach.coach_status = "verified"
    coach.verification_approved_at = datetime.utcnow()
    db.commit()
    
    logger.info(f"Coach {coach.email} approved by admin {current_user.email}")
    
    return {
        "message": "Coach approved successfully",
        "coach_id": coach_id,
        "status": "verified"
    }


@router.post("/coaches/{coach_id}/reject")
def reject_coach(
    coach_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Reject a pending coach."""
    coach = db.query(User).filter(
        User.id == coach_id,
        User.role == "COACH"
    ).first()
    
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach not found"
        )
    
    if coach.coach_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Coach status is {coach.coach_status}, not pending"
        )
    
    coach.coach_status = "rejected"
    coach.verification_approved_at = None
    db.commit()
    
    logger.info(f"Coach {coach.email} rejected by admin {current_user.email}")
    
    return {
        "message": "Coach application rejected",
        "coach_id": coach_id,
        "status": "rejected"
    }


@router.get("/coaches/all")
def get_all_coaches(
    status_filter: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all coaches with optional status filter."""
    query = db.query(User).filter(User.role == "COACH")
    
    if status_filter:
        query = query.filter(User.coach_status == status_filter)
    
    coaches = query.all()
    
    return {
        "coaches": [serialize_coach(coach) for coach in coaches],
        "total": len(coaches)
    }


@router.get("/coaches/verified")
def get_verified_coaches(
    search: str | None = Query(None, description="Search by coach name or email"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get verified coaches with search and pagination."""
    query = db.query(User).filter(
        User.role == "COACH",
        User.coach_status == "verified"
    )

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(User.name.ilike(pattern), User.email.ilike(pattern))
        )

    total = query.count()
    coaches = (
        query.order_by(User.verification_approved_at.desc().nullslast(), User.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return {
        "coaches": [serialize_coach(coach) for coach in coaches],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }


@router.post("/coaches/{coach_id}/remove-verification")
def remove_coach_verification(
    coach_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Revert a verified coach back to pending review."""
    coach = db.query(User).filter(
        User.id == coach_id,
        User.role == "COACH"
    ).first()

    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach not found"
        )

    coach.coach_status = "pending"
    coach.verification_approved_at = None
    db.commit()

    logger.info(f"Coach {coach.email} verification removed by admin {current_user.email}")

    return {
        "message": "Coach verification removed",
        "coach_id": coach_id,
        "status": "pending"
    }


@router.get("/coaches/{coach_id}/document")
def download_coach_document(
    coach_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Download coach document."""
    coach = db.query(User).filter(
        User.id == coach_id,
        User.role == "COACH"
    ).first()
    
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach not found"
        )
    
    if not coach.coach_document_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No document uploaded"
        )
    
    # Handle both old format (/static/...) and new format (storage/...)
    file_path = coach.coach_document_url
    if file_path.startswith('/static/'):
        file_path = file_path.replace('/static/', 'storage/')
    
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document file not found: {file_path}"
        )
    
    return FileResponse(
        path=file_path,
        filename=f"{coach.name}_document{os.path.splitext(file_path)[1]}",
        media_type="application/octet-stream"
    )
