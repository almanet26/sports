from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.config import get_db
from database.models.subscription import Subscription
from database.models.plan import Plan
from datetime import datetime, timedelta

router = APIRouter(prefix="/subscriptions")


@router.post("/subscribe")
def subscribe(user_id: str, plan_id: int, db: Session = Depends(get_db)):

    plan = db.query(Plan).filter(Plan.id == plan_id).first()

    if not plan:
        return {"error": "Plan not found"}

    start = datetime.utcnow()

    if plan.monthly_price:
        end = start + timedelta(days=30)
    else:
        end = start + timedelta(days=365)

    sub = Subscription(
        user_id=user_id,
        plan_id=plan_id,
        start_date=start,
        end_date=end
    )

    db.add(sub)
    db.commit()
    db.refresh(sub)

    return sub


@router.get("/user/{user_id}")
def get_user_subscription(user_id: str, db: Session = Depends(get_db)):

    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()

    return sub