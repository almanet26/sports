from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.plan_config import PlanConfig
from database.models.subscription import Subscription
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

_PLAYER_TIERS = frozenset({"free", "basic", "platinum"})
_COACH_TIERS = frozenset({"coach_free", "coach_starter", "coach_pro", "academy"})


class SubscribeRequest(BaseModel):
    plan_key: str


def _eligible_tiers_for_account(account_type: str) -> frozenset[str]:
    if account_type == "PLAYER":
        return _PLAYER_TIERS
    if account_type == "COACH":
        return _COACH_TIERS
    return frozenset(set(_PLAYER_TIERS) | set(_COACH_TIERS))


def _active_subscription(user_id: str, db: Session) -> Subscription | None:
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.status == "active")
        .order_by(Subscription.started_at.desc())
        .first()
    )


@router.get("/plans")
def list_available_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    account_type = current_user.role
    eligible_tiers = _eligible_tiers_for_account(account_type)

    query = db.query(PlanConfig)
    if account_type != "ADMIN":
        query = query.filter(PlanConfig.role.in_(eligible_tiers))

    plans = query.order_by(PlanConfig.price_inr.asc()).all()
    active_sub = _active_subscription(current_user.id, db)
    active_plan_key = active_sub.plan_key if active_sub else None

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
            "is_current": p.plan_key == active_plan_key,
        }
        for p in plans
    ]


@router.get("/me")
def get_my_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    sub = _active_subscription(current_user.id, db)
    if sub is None:
        default_role = "coach_free" if current_user.role == "COACH" else "free"
        return {
            "plan_key": default_role,
            "role": default_role,
            "status": "inactive",
            "started_at": None,
            "expires_at": None,
        }

    return {
        "plan_key": sub.plan_key,
        "role": sub.role,
        "status": sub.status,
        "started_at": sub.started_at.isoformat() if sub.started_at else None,
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
    }


@router.post("/subscribe")
def subscribe(
    body: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    plan = db.query(PlanConfig).filter(PlanConfig.plan_key == body.plan_key).first()
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")

    if current_user.role != "ADMIN":
        eligible_tiers = _eligible_tiers_for_account(current_user.role)
        if plan.role not in eligible_tiers:
            raise HTTPException(status_code=403, detail="This plan is not available for your account type")

    # Close any existing active subscription rows for this user.
    existing_active = (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.id, Subscription.status == "active")
        .all()
    )
    for row in existing_active:
        row.status = "expired"

    now = datetime.now(timezone.utc)
    duration_days = plan.duration_days if plan.duration_days > 0 else 36500
    sub = Subscription(
        user_id=current_user.id,
        plan_key=plan.plan_key,
        role=plan.role,
        status="active",
        started_at=now,
        expires_at=now + timedelta(days=duration_days),
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    return {
        "plan_key": sub.plan_key,
        "role": sub.role,
        "status": sub.status,
        "started_at": sub.started_at.isoformat(),
        "expires_at": sub.expires_at.isoformat(),
    }