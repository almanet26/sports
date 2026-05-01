"""
Admin API routes for user management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional, List, Any
from datetime import datetime, timezone
import logging
import uuid

from database.config import get_db
from database.models.user import User
from database.models.subscription import Subscription
from database.models.admin_audit_log import AdminAuditLog
from utils.auth import get_current_user, create_access_token
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


class SubscriptionOverrideRequest(BaseModel):
    plan_key: str
    role: str
    days: int = 365


class AuditLogEntry(BaseModel):
    id: str
    admin_id: Optional[str] = None
    admin_email: str
    action: str
    target_type: str
    target_id: Optional[str] = None
    before_value: Optional[Any] = None
    after_value: Optional[Any] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogPageResponse(BaseModel):
    entries: List[AuditLogEntry]
    total: int
    page: int
    per_page: int
    total_pages: int


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


@router.get("/users/{user_id}")
def get_user_details(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    base = UserDetailResponse.model_validate(user).model_dump()

    # Player: submissions
    if user.role == 'PLAYER':
        from database.models.submission import VideoSubmission
        subs = db.query(VideoSubmission).filter(VideoSubmission.player_id == user_id).order_by(VideoSubmission.created_at.desc()).all()
        base['submissions'] = [
            {
                'id': s.id,
                'analysis_type': s.analysis_type,
                'status': s.status.value if hasattr(s.status, 'value') else s.status,
                'coach_name': s.coach.name if s.coach else None,
                'created_at': s.created_at.isoformat() if s.created_at else None,
                'pdf_report_url': s.pdf_report_url,
            }
            for s in subs
        ]

    # Coach: submissions received + reviews
    if user.role == 'COACH':
        from database.models.submission import VideoSubmission
        from database.models.coach_review import CoachReview
        subs = db.query(VideoSubmission).filter(VideoSubmission.coach_id == user_id).order_by(VideoSubmission.created_at.desc()).all()
        base['submissions_received'] = [
            {
                'id': s.id,
                'analysis_type': s.analysis_type,
                'status': s.status.value if hasattr(s.status, 'value') else s.status,
                'player_name': s.player.name if s.player else None,
                'created_at': s.created_at.isoformat() if s.created_at else None,
            }
            for s in subs
        ]
        reviews = db.query(CoachReview).filter(CoachReview.coach_id == user_id).all()
        base['reviews'] = [
            {
                'player_name': db.query(User).filter(User.id == r.player_id).first().name if db.query(User).filter(User.id == r.player_id).first() else 'Unknown',
                'rating': r.rating,
                'comment': r.comment,
                'created_at': r.created_at.isoformat() if r.created_at else None,
            }
            for r in reviews
        ]
        avg = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0
        base['average_rating'] = avg
        base['total_reviews'] = len(reviews)

    return base


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


@router.get("/password-reset-requests")
def get_password_reset_requests(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from database.models.password_reset_request import PasswordResetRequest
    requests = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.is_resolved == False
    ).order_by(PasswordResetRequest.created_at.desc()).all()
    return {
        "requests": [
            {
                "id": r.id,
                "user_id": r.user_id,
                "email": r.email,
                "name": r.name,
                "message": r.message,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in requests
        ]
    }


@router.post("/password-reset-requests/{request_id}/resolve")
def resolve_password_reset(
    request_id: str,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from database.models.password_reset_request import PasswordResetRequest
    from database.models.notification import Notification
    from utils.auth import get_password_hash
    from datetime import datetime, timezone

    req = db.query(PasswordResetRequest).filter(PasswordResetRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    new_password = data.get("new_password", "").strip()
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = get_password_hash(new_password)
    req.is_resolved = True
    req.resolved_at = datetime.now(timezone.utc)

    # Notify the user with their new password
    notif = Notification(
        user_id=user.id,
        title="Password Reset by Admin",
        message=f"Your password has been reset. Your new password is: {new_password} — Please log in and change it immediately.",
        type="info",
    )
    db.add(notif)
    db.commit()
    return {"ok": True, "message": f"Password reset for {user.email}. User has been notified."}


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

    # Extended platform stats for dashboard health panel
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_this_month = db.query(func.count(User.id)).filter(User.created_at >= month_start).scalar()

    active_subs = db.query(func.count(Subscription.id)).filter(
        Subscription.status == 'active', Subscription.expires_at > now
    ).scalar()
    expired_subs = db.query(func.count(Subscription.id)).filter(
        Subscription.status == 'active', Subscription.expires_at <= now
    ).scalar()
    past_due_subs = db.query(func.count(Subscription.id)).filter(
        Subscription.status == 'past_due'
    ).scalar()

    by_plan_rows = db.query(Subscription.plan_key, func.count(Subscription.id)).filter(
        Subscription.status == 'active', Subscription.expires_at > now
    ).group_by(Subscription.plan_key).all()
    by_plan = {row[0]: row[1] for row in by_plan_rows}

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
        # Extended fields for platform health panel
        "users": {
            "total": total_users,
            "players": total_players,
            "coaches": total_coaches,
            "new_this_month": new_this_month,
        },
        "subscriptions": {
            "active": active_subs,
            "expired": expired_subs,
            "past_due": past_due_subs,
            "by_plan": by_plan,
        },
        "usage": {
            "biomech_jobs_this_month": 0,
            "ocr_jobs_this_month": 0,
            "total_videos_stored": 0,
            "pdf_reports_generated": 0,
        },
        "revenue": {"total_payments_captured": 0, "this_month": monthly_revenue, "last_month": 0},
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


@router.patch("/users/{user_id}/subscription")
def override_subscription(
    user_id: str,
    data: SubscriptionOverrideRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    now = datetime.now(timezone.utc)
    before = {"plan_key": user.subscription_plan, "role": user.role}

    # Expire any existing active subscription
    db.query(Subscription).filter(
        Subscription.user_id == user_id, Subscription.status == 'active'
    ).update({"status": "inactive"})

    new_sub = Subscription(
        user_id=user_id,
        plan_key=data.plan_key,
        role=data.role,
        status="active",
        started_at=now,
        expires_at=now.replace(year=now.year + 1) if data.days >= 365 else now,
    )
    # Use timedelta for days
    from datetime import timedelta
    new_sub.expires_at = now + timedelta(days=data.days)
    db.add(new_sub)

    user.subscription_plan = data.plan_key

    audit = AdminAuditLog(
        admin_id=current_user.id,
        action="override_subscription",
        target_type="user_subscription",
        target_id=user_id,
        before_value=before,
        after_value={"plan_key": data.plan_key, "role": data.role, "days": data.days},
    )
    db.add(audit)
    db.commit()
    logger.info(f"Subscription overridden for {user.email} to {data.plan_key} by {current_user.email}")
    return {"ok": True, "plan_key": data.plan_key, "expires_at": new_sub.expires_at.isoformat()}


@router.post("/users/{user_id}/impersonate")
def impersonate_user(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot impersonate yourself")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    token = create_access_token({"sub": target.email, "role": target.role, "impersonated_by": current_user.id})

    audit = AdminAuditLog(
        admin_id=current_user.id,
        action="impersonate",
        target_type="impersonation",
        target_id=user_id,
        before_value=None,
        after_value={"target_email": target.email, "target_role": target.role},
    )
    db.add(audit)
    db.commit()
    logger.info(f"Admin {current_user.email} impersonating {target.email}")
    return {"access_token": token, "token_type": "bearer", "user": UserDetailResponse.model_validate(target)}


@router.get("/audit-log", response_model=AuditLogPageResponse)
def get_audit_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())
    total = query.count()
    entries = query.offset((page - 1) * per_page).limit(per_page).all()

    result = []
    for e in entries:
        admin_email = e.admin.email if e.admin else "unknown"
        result.append(AuditLogEntry(
            id=e.id,
            admin_id=e.admin_id,
            admin_email=admin_email,
            action=e.action,
            target_type=e.target_type,
            target_id=e.target_id,
            before_value=e.before_value,
            after_value=e.after_value,
            created_at=e.created_at,
        ))

    return AuditLogPageResponse(
        entries=result,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=(total + per_page - 1) // per_page,
    )
