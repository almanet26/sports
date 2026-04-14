"""
Admin API routes for user management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional, List
from datetime import datetime
import logging
import uuid

from database.config import get_db
from database.models.user import User
from utils.auth import get_current_user
from pydantic import BaseModel, ConfigDict

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class UserSummaryResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: Optional[datetime]
    last_login: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class UserDetailResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    phone: Optional[str] = None
    team: Optional[str] = None
    profile_bio: Optional[str] = None
    gender: Optional[str] = None
    jersey_number: Optional[int] = None
    subscription_plan: Optional[str] = None
    coach_status: Optional[str] = None
    coach_category: Optional[str] = None
    specialization: Optional[list] = None
    certifications: Optional[list] = None
    intro_video_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UserListPageResponse(BaseModel):
    users: List[UserSummaryResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class UserUpdateRequest(BaseModel):
    is_active: Optional[bool] = None


# ── Dependency ────────────────────────────────────────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != 'ADMIN':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/users", response_model=UserListPageResponse)
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(User)

    if search:
        query = query.filter(
            or_(User.name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%"))
        )
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return UserListPageResponse(
        users=[UserSummaryResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=(total + per_page - 1) // per_page,
    )


@router.get("/users/{user_id}", response_model=UserDetailResponse)
def get_user_details(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserDetailResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserSummaryResponse)
def update_user(
    user_id: str,
    update_data: UserUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_user.id and update_data.is_active is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own account")

    if update_data.is_active is not None:
        user.is_active = update_data.is_active
        action = "activated" if update_data.is_active else "suspended"
        logger.info(f"User {user.email} {action} by admin {current_user.email}")

    db.commit()
    db.refresh(user)
    return UserSummaryResponse.model_validate(user)


@router.get("/stats")
def get_admin_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_users = db.query(func.count(User.id)).scalar()
    total_players = db.query(func.count(User.id)).filter(User.role == 'PLAYER').scalar()
    total_coaches = db.query(func.count(User.id)).filter(User.role == 'COACH').scalar()
    total_admins = db.query(func.count(User.id)).filter(User.role == 'ADMIN').scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    pending_coaches = db.query(func.count(User.id)).filter(
        User.role == 'COACH', User.coach_status == 'pending'
    ).scalar()

    basic_users = db.query(func.count(User.id)).filter(User.subscription_plan == 'BASIC').scalar()
    silver_users = db.query(func.count(User.id)).filter(User.subscription_plan == 'SILVER').scalar()
    gold_users = db.query(func.count(User.id)).filter(User.subscription_plan == 'GOLD').scalar()
    monthly_revenue = (silver_users * 29) + (gold_users * 99)

    return {
        "total_users": total_users,
        "total_players": total_players,
        "total_coaches": total_coaches,
        "total_admins": total_admins,
        "active_users": active_users,
        "inactive_users": total_users - active_users,
        "pending_coaches": pending_coaches,
        "subscription_breakdown": {"basic": basic_users, "silver": silver_users, "gold": gold_users},
        "revenue": {"monthly": monthly_revenue, "yearly": monthly_revenue * 12},
    }


@router.get("/coaches/pending")
def get_pending_coaches(
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    coaches = db.query(User).filter(
        User.role == 'COACH', User.coach_status == 'pending'
    ).order_by(User.created_at.asc()).limit(limit).all()
    return {"coaches": [UserDetailResponse.model_validate(c) for c in coaches]}


@router.get("/activity")
def get_activity_feed(
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    activities = []

    recent_users = db.query(User).order_by(User.created_at.desc()).limit(10).all()
    for user in recent_users:
        activities.append({
            "id": f"user_{user.id}",
            "type": "registration",
            "title": f"New {user.role.lower()} registered",
            "description": f"{user.name} ({user.email})",
            "timestamp": user.created_at.isoformat() if user.created_at else None,
            "icon": "user-plus",
            "color": "blue",
        })

    pending_coaches = db.query(User).filter(
        User.role == 'COACH', User.coach_status == 'pending'
    ).order_by(User.created_at.desc()).limit(5).all()
    for coach in pending_coaches:
        activities.append({
            "id": f"coach_{coach.id}",
            "type": "coach_application",
            "title": "New coach application",
            "description": f"{coach.name} applied for verification",
            "timestamp": coach.created_at.isoformat() if coach.created_at else None,
            "icon": "user-check",
            "color": "green",
        })

    activities.sort(key=lambda x: x['timestamp'] or '', reverse=True)
    return {"activities": activities[:limit], "total": len(activities[:limit])}


@router.patch("/coaches/{coach_id}/verify")
def verify_coach(
    coach_id: str,
    action: str = Query(..., pattern="^(verified|rejected)$"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    coach = db.query(User).filter(User.id == coach_id, User.role == 'COACH').first()
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

    coach.coach_status = action
    db.commit()
    db.refresh(coach)
    logger.info(f"Coach {coach.email} {action} by admin {current_user.email}")
    return UserDetailResponse.model_validate(coach)
