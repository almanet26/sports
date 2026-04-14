from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database.config import get_db
from database.models.coach_session import CoachTrainingSession
from database.models.coach_availability import CoachAvailability
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
