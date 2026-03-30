from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.config import get_db
from database.models.plan import Plan
from schemas.plan_schema import PlanCreate

router = APIRouter(prefix="/plans")

@router.post("/")
def create_plan(plan: PlanCreate, db: Session = Depends(get_db)):
    new_plan = Plan(**plan.dict())
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan


@router.get("/")
def get_plans(db: Session = Depends(get_db)):
    return db.query(Plan).all()


@router.put("/{plan_id}")
def update_plan(plan_id: int, plan: PlanCreate, db: Session = Depends(get_db)):
    existing_plan = db.query(Plan).filter(Plan.id == plan_id).first()

    if not existing_plan:
        return {"error": "Plan not found"}

    existing_plan.name = plan.name
    existing_plan.monthly_price = plan.monthly_price
    existing_plan.yearly_price = plan.yearly_price
    existing_plan.features = plan.features

    db.commit()
    db.refresh(existing_plan)

    return existing_plan


@router.delete("/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()

    if not plan:
        return {"error": "Plan not found"}

    db.delete(plan)
    db.commit()

    return {"message": "Plan deleted"}