"""
Admin API routes — plan management, user management, impersonation, stats, audit log.

All routes require role == "ADMIN".  Any other role receives 403 immediately.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.admin_audit_log import AdminAuditLog
from database.models.monthly_usage import MonthlyUsage
from database.models.plan_config import PlanConfig
from database.models.subscription import Subscription
from database.models.user import User
from utils.auth import create_access_token, get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Admin guard dependency
# ---------------------------------------------------------------------------

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_audit(
    db: Session,
    admin_id: str,
    action: str,
    target_type: str,
    target_id: str,
    before: Any | None = None,
    after: Any | None = None,
) -> None:
    entry = AdminAuditLog(
        admin_id=admin_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        before_value=before,
        after_value=after,
    )
    db.add(entry)


def _sub_for_user(user_id: str, db: Session) -> Optional[Subscription]:
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id)
        .order_by(Subscription.started_at.desc())
        .first()
    )


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PlanUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    price_inr: Optional[int] = None
    duration_days: Optional[int] = None
    max_biomech_per_month: Optional[int] = None
    max_ocr_hours_per_month: Optional[float] = None
    max_submissions_per_month: Optional[int] = None
    max_players_in_dashboard: Optional[int] = None

    @field_validator("price_inr")
    @classmethod
    def price_non_negative(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("price_inr must be >= 0")
        return v

    @field_validator(
        "duration_days",
        "max_biomech_per_month",
        "max_submissions_per_month",
        "max_players_in_dashboard",
        mode="before",
    )
    @classmethod
    def limits_non_negative(cls, v: int | None) -> int | None:
        if v is not None and v < -1:
            raise ValueError("limit must be >= -1 (-1 means unlimited)")
        return v

    @field_validator("max_ocr_hours_per_month", mode="before")
    @classmethod
    def ocr_non_negative(cls, v: float | None) -> float | None:
        if v is not None and v < -1:
            raise ValueError("max_ocr_hours_per_month must be >= -1")
        return v


class SubscriptionOverrideRequest(BaseModel):
    plan_key: str
    status: str
    expires_at: Optional[str] = None   # ISO datetime string

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in ("active", "expired", "past_due"):
            raise ValueError("status must be active | expired | past_due")
        return v


class UserUpdateRequest(BaseModel):
    is_active: Optional[bool] = None


# ---------------------------------------------------------------------------
# GET /admin/plans
# ---------------------------------------------------------------------------

@router.get("/plans")
def list_plans(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    plans = db.query(PlanConfig).all()
    return [
        {
            "plan_key": p.plan_key,
            "role": p.role,
            "display_name": p.display_name,
            "price_inr": p.price_inr,
            "duration_days": p.duration_days,
            "max_biomech_per_month": p.max_biomech_per_month,
            "max_ocr_hours_per_month": p.max_ocr_hours_per_month,
            "max_submissions_per_month": p.max_submissions_per_month,
            "max_players_in_dashboard": p.max_players_in_dashboard,
        }
        for p in plans
    ]


# ---------------------------------------------------------------------------
# PATCH /admin/plans/{plan_key}
# ---------------------------------------------------------------------------

@router.patch("/plans/{plan_key}")
def update_plan(
    plan_key: str,
    body: PlanUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    plan = db.query(PlanConfig).filter(PlanConfig.plan_key == plan_key).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    before: dict = {
        "display_name": plan.display_name,
        "price_inr": plan.price_inr,
        "duration_days": plan.duration_days,
        "max_biomech_per_month": plan.max_biomech_per_month,
        "max_ocr_hours_per_month": plan.max_ocr_hours_per_month,
        "max_submissions_per_month": plan.max_submissions_per_month,
        "max_players_in_dashboard": plan.max_players_in_dashboard,
    }

    payload = body.model_dump(exclude_unset=True)
    for field, value in payload.items():
        setattr(plan, field, value)

    after: dict = {
        "display_name": plan.display_name,
        "price_inr": plan.price_inr,
        "duration_days": plan.duration_days,
        "max_biomech_per_month": plan.max_biomech_per_month,
        "max_ocr_hours_per_month": plan.max_ocr_hours_per_month,
        "max_submissions_per_month": plan.max_submissions_per_month,
        "max_players_in_dashboard": plan.max_players_in_dashboard,
    }

    _write_audit(db, current_user.id, "update_plan", "plan", plan_key, before, after)
    db.commit()

    logger.info("Plan %s updated by admin %s", plan_key, current_user.email)

    return {
        "plan_key": plan.plan_key,
        "role": plan.role,
        "display_name": plan.display_name,
        "price_inr": plan.price_inr,
        "duration_days": plan.duration_days,
        "max_biomech_per_month": plan.max_biomech_per_month,
        "max_ocr_hours_per_month": plan.max_ocr_hours_per_month,
        "max_submissions_per_month": plan.max_submissions_per_month,
        "max_players_in_dashboard": plan.max_players_in_dashboard,
    }


# ---------------------------------------------------------------------------
# GET /admin/users  (extended with subscription data)
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    subscription_status: Optional[str] = None,
    plan: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(User)

    if search:
        query = query.filter(
            or_(User.name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%"))
        )
    if role:
        query = query.filter(User.role == role.upper())
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    users = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    rows = []
    for u in users:
        sub = _sub_for_user(u.id, db)
        if subscription_status and (sub is None or sub.status != subscription_status):
            continue
        if plan and (sub is None or sub.role != plan):
            continue
        rows.append(
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login": u.last_login.isoformat() if u.last_login else None,
                "subscription_tier": sub.role if sub else "free",
                "subscription_status": sub.status if sub else "inactive",
                "subscription_plan_key": sub.plan_key if sub else None,
                "subscription_expires_at": sub.expires_at.isoformat() if sub and sub.expires_at else None,
            }
        )

    return {
        "users": rows,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


# ---------------------------------------------------------------------------
# GET /admin/users/{user_id}
# ---------------------------------------------------------------------------

@router.get("/users/{user_id}")
def get_user_details(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    sub = _sub_for_user(user_id, db)
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "phone": user.phone,
        "team": user.team,
        "profile_bio": user.profile_bio,
        "gender": user.gender,
        "jersey_number": user.jersey_number,
        "subscription_plan": user.subscription_plan,
        "coach_status": user.coach_status,
        "coach_category": user.coach_category,
        "specialization": user.specialization,
        "certifications": user.certifications,
        "intro_video_url": user.intro_video_url,
        "profile_image_url": user.profile_image_url,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "subscription_tier": sub.role if sub else "free",
        "subscription_status": sub.status if sub else "inactive",
        "subscription_plan_key": sub.plan_key if sub else None,
        "subscription_expires_at": sub.expires_at.isoformat() if sub and sub.expires_at else None,
    }


# ---------------------------------------------------------------------------
# PATCH /admin/users/{user_id}  (activate / suspend)
# ---------------------------------------------------------------------------

@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    update_data: UserUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id and update_data.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    if update_data.is_active is not None:
        user.is_active = update_data.is_active
        action = "activated" if update_data.is_active else "suspended"
        logger.info("User %s %s by admin %s", user.email, action, current_user.email)

    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "is_active": user.is_active}


# ---------------------------------------------------------------------------
# PATCH /admin/users/{user_id}/subscription
# ---------------------------------------------------------------------------

@router.patch("/users/{user_id}/subscription")
def override_subscription(
    user_id: str,
    body: SubscriptionOverrideRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    plan = db.query(PlanConfig).filter(PlanConfig.plan_key == body.plan_key).first()
    if not plan:
        raise HTTPException(status_code=422, detail=f"Unknown plan_key: {body.plan_key!r}")

    sub = _sub_for_user(user_id, db)
    before = (
        {"plan_key": sub.plan_key, "status": sub.status, "expires_at": sub.expires_at.isoformat() if sub.expires_at else None}
        if sub
        else None
    )

    expires_at: datetime
    if body.expires_at:
        try:
            expires_at = datetime.fromisoformat(body.expires_at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail="expires_at must be an ISO datetime string")
    else:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=plan.duration_days if plan.duration_days > 0 else 36500)

    if sub:
        sub.plan_key = body.plan_key
        sub.role = plan.role
        sub.status = body.status
        sub.expires_at = expires_at
    else:
        sub = Subscription(
            user_id=user_id,
            plan_key=body.plan_key,
            role=plan.role,
            status=body.status,
            started_at=datetime.now(timezone.utc),
            expires_at=expires_at,
        )
        db.add(sub)

    after = {"plan_key": body.plan_key, "status": body.status, "expires_at": expires_at.isoformat()}
    _write_audit(db, current_user.id, "override_subscription", "user_subscription", user_id, before, after)
    db.commit()

    logger.info(
        "Subscription overridden for user %s to %s by admin %s",
        user.email, body.plan_key, current_user.email,
    )

    return {
        "user_id": user_id,
        "plan_key": sub.plan_key,
        "role": sub.role,
        "status": sub.status,
        "expires_at": sub.expires_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# POST /admin/users/{user_id}/impersonate
# ---------------------------------------------------------------------------

@router.post("/users/{user_id}/impersonate")
def impersonate_user(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.role == "ADMIN":
        raise HTTPException(status_code=403, detail="Cannot impersonate another admin")

    sub = _sub_for_user(user_id, db)
    sub_role = sub.role if sub else "free"
    sub_status = sub.status if sub else "inactive"

    token = create_access_token(
        data={
            "sub": target.email,
            "user_id": target.id,
            "role": target.role,
            "subscription_role": sub_role,
            "subscription_status": sub_status,
            "is_impersonation": True,
            "impersonated_by": current_user.id,
        },
        expires_delta=timedelta(minutes=15),
    )

    _write_audit(
        db,
        current_user.id,
        "impersonate",
        "impersonation",
        user_id,
        None,
        {"target_email": target.email, "target_role": target.role},
    )
    db.commit()

    logger.warning(
        "Admin %s is impersonating user %s (%s)",
        current_user.email, target.email, target.id,
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 900,
        "target_user": {
            "id": target.id,
            "name": target.name,
            "email": target.email,
            "role": target.role,
        },
    }


# ---------------------------------------------------------------------------
# GET /admin/stats
# ---------------------------------------------------------------------------

@router.get("/stats")
def get_admin_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_users = db.query(func.count(User.id)).scalar() or 0
    players = db.query(func.count(User.id)).filter(User.role == "PLAYER").scalar() or 0
    coaches = db.query(func.count(User.id)).filter(User.role == "COACH").scalar() or 0
    new_this_month = (
        db.query(func.count(User.id)).filter(User.created_at >= month_start).scalar() or 0
    )

    def _sub_count(status: str) -> int:
        return db.query(func.count(Subscription.id)).filter(Subscription.status == status).scalar() or 0

    def _plan_count(tier: str) -> int:
        return (
            db.query(func.count(Subscription.id))
            .filter(Subscription.role == tier, Subscription.status == "active")
            .scalar()
            or 0
        )

    active_subs = _sub_count("active")
    expired_subs = _sub_count("expired")
    past_due_subs = _sub_count("past_due")

    by_plan = {
        "free": _plan_count("free"),
        "basic": _plan_count("basic"),
        "platinum": _plan_count("platinum"),
        "coach_starter": _plan_count("coach_starter"),
        "coach_pro": _plan_count("coach_pro"),
        "academy": _plan_count("academy"),
    }

    # Usage this month — sum across all monthly_usage rows for current month
    usage_row = (
        db.query(
            func.coalesce(func.sum(MonthlyUsage.biomech_count), 0).label("biomech"),
            func.coalesce(func.sum(MonthlyUsage.ocr_hours_used), 0).label("ocr"),
            func.coalesce(func.sum(MonthlyUsage.submission_count), 0).label("submissions"),
        )
        .filter(MonthlyUsage.year == now.year, MonthlyUsage.month == now.month)
        .first()
    )

    return {
        "users": {
            "total": total_users,
            "players": players,
            "coaches": coaches,
            "new_this_month": new_this_month,
        },
        "subscriptions": {
            "active": active_subs,
            "expired": expired_subs,
            "past_due": past_due_subs,
            "by_plan": by_plan,
        },
        "usage": {
            "biomech_jobs_this_month": int(usage_row.biomech) if usage_row else 0,
            "ocr_jobs_this_month": round(float(usage_row.ocr), 2) if usage_row else 0.0,
            "total_videos_stored": 0,
            "pdf_reports_generated": 0,
        },
        "revenue": {
            "total_payments_captured": 0,
            "this_month": 0,
            "last_month": 0,
        },
        # Legacy fields kept for backward compat with existing AdminDashboard
        "total_users": total_users,
        "total_players": players,
        "total_coaches": coaches,
        "total_admins": db.query(func.count(User.id)).filter(User.role == "ADMIN").scalar() or 0,
        "active_users": db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0,
        "pending_coaches": (
            db.query(func.count(User.id))
            .filter(User.role == "COACH", User.coach_status == "pending")
            .scalar()
            or 0
        ),
        "subscription_breakdown": by_plan,
    }


# ---------------------------------------------------------------------------
# GET /admin/audit-log
# ---------------------------------------------------------------------------

@router.get("/audit-log")
def get_audit_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    query = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())
    total = query.count()
    entries = query.offset((page - 1) * per_page).limit(per_page).all()

    rows = []
    for e in entries:
        admin_email = e.admin.email if e.admin else "unknown"
        rows.append(
            {
                "id": e.id,
                "admin_id": e.admin_id,
                "admin_email": admin_email,
                "action": e.action,
                "target_type": e.target_type,
                "target_id": e.target_id,
                "before_value": e.before_value,
                "after_value": e.after_value,
                "created_at": e.created_at.isoformat(),
            }
        )

    return {
        "entries": rows,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


# ---------------------------------------------------------------------------
# GET /admin/coaches/pending  (kept for backward compat)
# ---------------------------------------------------------------------------

@router.get("/coaches/pending")
def get_pending_coaches(
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    coaches = (
        db.query(User)
        .filter(User.role == "COACH", User.coach_status == "pending")
        .order_by(User.created_at.asc())
        .limit(limit)
        .all()
    )
    return {
        "coaches": [
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "team": c.team,
                "specialization": c.specialization,
                "certifications": c.certifications,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in coaches
        ]
    }


# ---------------------------------------------------------------------------
# PATCH /admin/coaches/{coach_id}/verify  (kept for backward compat)
# ---------------------------------------------------------------------------

@router.patch("/coaches/{coach_id}/verify")
def verify_coach(
    coach_id: str,
    action: str = Query(..., pattern="^(verified|rejected)$"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    coach = db.query(User).filter(User.id == coach_id, User.role == "COACH").first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    coach.coach_status = action
    db.commit()
    db.refresh(coach)
    logger.info("Coach %s %s by admin %s", coach.email, action, current_user.email)
    return {"id": coach.id, "email": coach.email, "coach_status": coach.coach_status}


# ---------------------------------------------------------------------------
# GET /admin/activity  (kept for backward compat)
# ---------------------------------------------------------------------------

@router.get("/activity")
def get_activity_feed(
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    activities = []

    recent_users = db.query(User).order_by(User.created_at.desc()).limit(10).all()
    for user in recent_users:
        activities.append(
            {
                "id": f"user_{user.id}",
                "type": "registration",
                "title": f"New {user.role.lower()} registered",
                "description": f"{user.name} ({user.email})",
                "timestamp": user.created_at.isoformat() if user.created_at else None,
                "icon": "user-plus",
                "color": "blue",
            }
        )

    pending_coaches = (
        db.query(User)
        .filter(User.role == "COACH", User.coach_status == "pending")
        .order_by(User.created_at.desc())
        .limit(5)
        .all()
    )
    for coach in pending_coaches:
        activities.append(
            {
                "id": f"coach_{coach.id}",
                "type": "coach_application",
                "title": "New coach application",
                "description": f"{coach.name} applied for verification",
                "timestamp": coach.created_at.isoformat() if coach.created_at else None,
                "icon": "user-check",
                "color": "green",
            }
        )

    activities.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    return {"activities": activities[:limit], "total": len(activities[:limit])}
