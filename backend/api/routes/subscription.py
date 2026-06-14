from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.plan import Plan
from database.models.plan_entitlement import PlanEntitlement
from database.models.feature import Feature
from database.models.subscription import Subscription
from database.models.user import User
from services import entitlement_service
from utils.auth import get_current_user

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# Account type (users.role) → plan.user_type.
_ACCOUNT_TO_USER_TYPE = {"PLAYER": "player", "COACH": "coach"}


class SubscribeRequest(BaseModel):
    plan_key: str


def _active_subscription(user_id: str, db: Session) -> Subscription | None:
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.status == "active")
        .order_by(Subscription.started_at.desc())
        .first()
    )


def _plan_entitlements(plan_id: int, db: Session) -> dict:
    rows = (
        db.query(PlanEntitlement, Feature)
        .join(Feature, PlanEntitlement.feature_id == Feature.id)
        .filter(PlanEntitlement.plan_id == plan_id)
        .all()
    )
    return {f.key: (ent.as_number() if f.type == "numeric" else ent.as_bool()) for ent, f in rows}


@router.get("/plans")
def list_available_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """List active plans available to the current user's account type."""
    query = db.query(Plan).filter(Plan.is_active.is_(True))
    expected = _ACCOUNT_TO_USER_TYPE.get(current_user.role)
    if expected is not None:  # ADMIN sees all
        query = query.filter(Plan.user_type == expected)

    plans = query.order_by(Plan.sort_order.asc(), Plan.price_inr.asc()).all()
    active_sub = _active_subscription(current_user.id, db)
    active_plan_id = active_sub.plan_id if active_sub else None

    return [
        {
            "id": p.id,
            "key": p.key,
            "plan_key": p.key,  # back-compat alias
            "display_name": p.display_name,
            "user_type": p.user_type,
            "price_inr": p.price_inr,
            "billing_period": p.billing_period,
            "is_active": p.is_active,
            "is_current": p.id == active_plan_id,
            "entitlements": _plan_entitlements(p.id, db),
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
        default_role = "coach_basic" if current_user.role == "COACH" else "bronze"
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
    """
    Activate a FREE plan directly.  Paid plans must go through the Razorpay flow
    (POST /billing/create-order → /billing/verify-payment).
    """
    plan = db.query(Plan).filter(Plan.key == body.plan_key, Plan.is_active.is_(True)).first()
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")

    if current_user.role != "ADMIN":
        expected = _ACCOUNT_TO_USER_TYPE.get(current_user.role)
        if expected is not None and plan.user_type != expected:
            raise HTTPException(status_code=403, detail="This plan is not available for your account type")

    if plan.price_inr > 0:
        raise HTTPException(
            status_code=402,
            detail="This is a paid plan. Use POST /billing/create-order to pay and activate.",
        )

    # Close existing active subscriptions.
    db.query(Subscription).filter(
        Subscription.user_id == current_user.id,
        Subscription.status == "active",
    ).update({"status": "expired"})

    now = datetime.now(timezone.utc)
    duration_days = 36500 if plan.price_inr == 0 else (365 if plan.billing_period == "annual" else 30)
    sub = Subscription(
        user_id=current_user.id,
        plan_id=plan.id,
        plan_key=plan.key,
        role=plan.key,
        status="active",
        started_at=now,
        expires_at=now + timedelta(days=duration_days),
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    entitlement_service.invalidate_user(current_user.id)

    return {
        "plan_key": sub.plan_key,
        "role": sub.role,
        "status": sub.status,
        "started_at": sub.started_at.isoformat(),
        "expires_at": sub.expires_at.isoformat(),
    }
