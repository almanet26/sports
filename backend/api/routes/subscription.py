from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, ConfigDict

from database.config import get_db
from database.models.subscription import Subscription
from database.models.plan import Plan
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/subscriptions")


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class SubscriptionResponse(BaseModel):
    id: int
    user_id: str
    plan_id: int
    plan_name: str
    plan_features: str
    monthly_price: int
    yearly_price: int
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_response(sub: Subscription, plan: Plan) -> SubscriptionResponse:
    return SubscriptionResponse(
        id=sub.id,
        user_id=sub.user_id,
        plan_id=sub.plan_id,
        plan_name=plan.name,
        plan_features=plan.features,
        monthly_price=plan.monthly_price,
        yearly_price=plan.yearly_price,
        start_date=sub.start_date,
        end_date=sub.end_date,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/subscribe", response_model=SubscriptionResponse)
def subscribe(
    user_id: str,
    plan_id: int,
    billing_cycle: str = "monthly",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "ADMIN" and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot subscribe on behalf of another user")

    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    start = datetime.utcnow()
    end = start + (timedelta(days=365) if billing_cycle == "yearly" else timedelta(days=30))

    existing = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if existing:
        existing.plan_id = plan_id
        existing.start_date = start
        existing.end_date = end
        db.commit()
        db.refresh(existing)
        return _build_response(existing, plan)

    sub = Subscription(user_id=user_id, plan_id=plan_id, start_date=start, end_date=end)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return _build_response(sub, plan)


@router.get("/user/{user_id}", response_model=Optional[SubscriptionResponse])
def get_user_subscription(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "ADMIN" and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if not sub:
        return None

    plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
    if not plan:
        return None

    return _build_response(sub, plan)
