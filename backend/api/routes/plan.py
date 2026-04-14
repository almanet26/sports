from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database.config import get_db
from database.models.plan import Plan
from database.models.user import User
from schemas.plan_schema import PlanCreate
from utils.auth import get_current_user

router = APIRouter(prefix="/plans")


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("/")
def get_plans(db: Session = Depends(get_db)):
    """Public — players and coaches can fetch plans."""
    plans = db.query(Plan).order_by(Plan.id).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "monthly_price": p.monthly_price,
            "yearly_price": p.yearly_price,
            "features": p.features,
        }
        for p in plans
    ]


@router.post("/", dependencies=[Depends(require_admin)])
def create_plan(plan: PlanCreate, db: Session = Depends(get_db)):
    new_plan = Plan(**plan.model_dump())
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan


@router.put("/{plan_id}", dependencies=[Depends(require_admin)])
def update_plan(plan_id: int, plan: PlanCreate, db: Session = Depends(get_db)):
    existing = db.query(Plan).filter(Plan.id == plan_id).first()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    existing.name = plan.name
    existing.monthly_price = plan.monthly_price
    existing.yearly_price = plan.yearly_price
    existing.features = plan.features
    db.commit()
    db.refresh(existing)
    return existing


@router.delete("/{plan_id}", dependencies=[Depends(require_admin)])
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    db.delete(plan)
    db.commit()
    return {"message": "Plan deleted"}
