from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database.config import get_db
from database.models.coach_session import CoachTrainingSession
from database.models.coach_availability import CoachAvailability
from database.models.coach_training_plan import CoachTrainingPlan
from utils.auth import get_current_coach

router = APIRouter(prefix="/sessions", tags=["sessions"])


class SessionCreate(BaseModel):
    topic: str
    description: Optional[str] = None
    prerequisites: Optional[str] = None
    session_date: str        # YYYY-MM-DD
    session_time: str        # HH:MM
    duration_minutes: str    # e.g. "60"
    session_type: str = "virtual"  # virtual | in_person


class SessionUpdate(BaseModel):
    topic: Optional[str] = None
    description: Optional[str] = None
    prerequisites: Optional[str] = None
    session_date: Optional[str] = None
    session_time: Optional[str] = None
    duration_minutes: Optional[str] = None
    session_type: Optional[str] = None


def _serialize(s: CoachTrainingSession) -> dict:
    return {
        "id": s.id,
        "coach_id": s.coach_id,
        "topic": s.topic,
        "description": s.description,
        "prerequisites": s.prerequisites,
        "session_date": s.session_date,
        "session_time": s.session_time,
        "duration_minutes": s.duration_minutes,
        "session_type": s.session_type,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.post("/", status_code=201)
def create_session(
    body: SessionCreate,
    db: Session = Depends(get_db),
    coach=Depends(get_current_coach),
):
    session = CoachTrainingSession(
        coach_id=coach.id,
        topic=body.topic,
        description=body.description,
        prerequisites=body.prerequisites,
        session_date=body.session_date,
        session_time=body.session_time,
        duration_minutes=body.duration_minutes,
        session_type=body.session_type,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _serialize(session)


@router.get("/")
def list_sessions(
    db: Session = Depends(get_db),
    coach=Depends(get_current_coach),
):
    sessions = (
        db.query(CoachTrainingSession)
        .filter(CoachTrainingSession.coach_id == coach.id)
        .order_by(CoachTrainingSession.session_date.desc(), CoachTrainingSession.session_time.desc())
        .all()
    )
    return {"sessions": [_serialize(s) for s in sessions]}


@router.put("/{session_id}")
def update_session(
    session_id: str,
    body: SessionUpdate,
    db: Session = Depends(get_db),
    coach=Depends(get_current_coach),
):
    session = db.query(CoachTrainingSession).filter(
        CoachTrainingSession.id == session_id,
        CoachTrainingSession.coach_id == coach.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    for field, value in body.dict(exclude_none=True).items():
        setattr(session, field, value)
    db.commit()
    db.refresh(session)
    return _serialize(session)


@router.delete("/{session_id}", status_code=204)
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    coach=Depends(get_current_coach),
):
    session = db.query(CoachTrainingSession).filter(
        CoachTrainingSession.id == session_id,
        CoachTrainingSession.coach_id == coach.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()


# ── Availability ──────────────────────────────────────────────────────────────

class AvailabilitySlotIn(BaseModel):
    day_of_week: str
    slot_time: str
    is_available: bool = True


class AvailabilitySaveBody(BaseModel):
    slots: List[AvailabilitySlotIn]


@router.get("/availability")
def get_availability(
    db: Session = Depends(get_db),
    coach=Depends(get_current_coach),
):
    rows = db.query(CoachAvailability).filter(CoachAvailability.coach_id == coach.id).all()
    return {
        "slots": [
            {"id": r.id, "day_of_week": r.day_of_week, "slot_time": r.slot_time, "is_available": r.is_available}
            for r in rows
        ]
    }


@router.post("/availability", status_code=200)
def save_availability(
    body: AvailabilitySaveBody,
    db: Session = Depends(get_db),
    coach=Depends(get_current_coach),
):
    # Delete existing and replace with new set
    db.query(CoachAvailability).filter(CoachAvailability.coach_id == coach.id).delete()
    for slot in body.slots:
        db.add(CoachAvailability(
            coach_id=coach.id,
            day_of_week=slot.day_of_week,
            slot_time=slot.slot_time,
            is_available=slot.is_available,
        ))
    db.commit()
    return {"message": "Availability saved", "count": len(body.slots)}


# ── Training Plans ────────────────────────────────────────────────────────────

class TrainingPlanCreate(BaseModel):
    title: str
    description: Optional[str] = None
    analysis_type: str = "BATTING"
    plan_type: str = "group_all"
    is_public: bool = True
    drills: Optional[List[str]] = []


class TrainingPlanUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    analysis_type: Optional[str] = None
    plan_type: Optional[str] = None
    is_public: Optional[bool] = None
    drills: Optional[List[str]] = None


def _serialize_plan(p: CoachTrainingPlan) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "description": p.description,
        "analysis_type": p.analysis_type,
        "plan_type": p.plan_type,
        "is_public": p.is_public,
        "drills": p.drills or [],
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/training-plans")
def list_training_plans(
    db: Session = Depends(get_db),
    coach=Depends(get_current_coach),
):
    plans = (
        db.query(CoachTrainingPlan)
        .filter(CoachTrainingPlan.coach_id == coach.id)
        .order_by(CoachTrainingPlan.created_at.desc())
        .all()
    )
    return {"plans": [_serialize_plan(p) for p in plans]}


@router.post("/training-plans", status_code=201)
def create_training_plan(
    body: TrainingPlanCreate,
    db: Session = Depends(get_db),
    coach=Depends(get_current_coach),
):
    plan = CoachTrainingPlan(
        coach_id=coach.id,
        title=body.title,
        description=body.description,
        analysis_type=body.analysis_type,
        plan_type=body.plan_type,
        is_public=body.is_public,
        drills=body.drills,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _serialize_plan(plan)


@router.put("/training-plans/{plan_id}")
def update_training_plan(
    plan_id: str,
    body: TrainingPlanUpdate,
    db: Session = Depends(get_db),
    coach=Depends(get_current_coach),
):
    plan = db.query(CoachTrainingPlan).filter(
        CoachTrainingPlan.id == plan_id,
        CoachTrainingPlan.coach_id == coach.id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    for field, value in body.dict(exclude_none=True).items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return _serialize_plan(plan)


@router.delete("/training-plans/{plan_id}", status_code=204)
def delete_training_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    coach=Depends(get_current_coach),
):
    plan = db.query(CoachTrainingPlan).filter(
        CoachTrainingPlan.id == plan_id,
        CoachTrainingPlan.coach_id == coach.id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    db.delete(plan)
    db.commit()
