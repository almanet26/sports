import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class CoachAvailability(Base):
    __tablename__ = "coach_availability"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    coach_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(String(20), nullable=False)   # Monday, Tuesday, ...
    slot_time = Column(String(10), nullable=False)     # HH:MM
    is_available = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    coach = relationship("User", foreign_keys=[coach_id])
