"""
Admin API routes for coach approval.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import logging
import os

from database.config import get_db
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


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
        "coaches": [
            {
                "id": coach.id,
                "name": coach.name,
                "email": coach.email,
                "phone": coach.phone,
                "team": coach.team,
                "coach_status": coach.coach_status,
                "coach_document_url": coach.coach_document_url,
                "created_at": coach.created_at.isoformat() if coach.created_at else None,
            }
            for coach in pending_coaches
        ],
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
        "coaches": [
            {
                "id": coach.id,
                "name": coach.name,
                "email": coach.email,
                "phone": coach.phone,
                "team": coach.team,
                "coach_status": coach.coach_status,
                "coach_document_url": coach.coach_document_url,
                "created_at": coach.created_at.isoformat() if coach.created_at else None,
            }
            for coach in coaches
        ],
        "total": len(coaches)
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
