"""
Admin routes for coach verification.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import uuid

from database.config import get_db
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

# Ensure upload directory exists
UPLOAD_DIR = "storage/coach_documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/coaches/pending")
def get_pending_coaches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all coaches pending verification (Admin only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    coaches = db.query(User).filter(
        User.role == "COACH",
        User.coach_verification_status == "PENDING"
    ).all()
    
    return [{
        "id": coach.id,
        "name": coach.name,
        "email": coach.email,
        "created_at": coach.created_at.isoformat() if coach.created_at else None,
        "coach_document_path": coach.coach_document_path,
        "coach_verification_status": coach.coach_verification_status
    } for coach in coaches]


@router.post("/coaches/{coach_id}/verify")
def verify_coach(
    coach_id: str,
    status: str = Form(...),  # APPROVED or REJECTED
    notes: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve or reject a coach (Admin only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    coach = db.query(User).filter(User.id == coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    if coach.role != "COACH":
        raise HTTPException(status_code=400, detail="User is not a coach")
    
    coach.coach_verification_status = status
    coach.coach_verification_notes = notes
    coach.verified_by_admin_id = current_user.id
    coach.verified_at = datetime.utcnow()
    
    db.commit()
    db.refresh(coach)
    
    return {"message": f"Coach {status.lower()}", "coach": {
        "id": coach.id,
        "name": coach.name,
        "email": coach.email,
        "status": coach.coach_verification_status
    }}


@router.get("/coaches/all")
def get_all_coaches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all coaches (Admin only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    coaches = db.query(User).filter(User.role == "COACH").all()
    
    return [{
        "id": coach.id,
        "name": coach.name,
        "email": coach.email,
        "status": coach.coach_verification_status,
        "created_at": coach.created_at.isoformat() if coach.created_at else None
    } for coach in coaches]


@router.get("/coaches/{coach_id}/document")
def download_coach_document(
    coach_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download coach document (Admin only)."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    coach = db.query(User).filter(User.id == coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    if not coach.coach_document_path or not os.path.exists(coach.coach_document_path):
        raise HTTPException(status_code=404, detail="Document not found")
    
    return FileResponse(
        path=coach.coach_document_path,
        filename=f"{coach.name}_document{os.path.splitext(coach.coach_document_path)[1]}",
        media_type="application/octet-stream"
    )
