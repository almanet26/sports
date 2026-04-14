import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class CoachTrainingSession(Base):
    __tablename__ = "coach_training_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    coach_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    topic = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    prerequisites = Column(Text, nullable=True)

    session_date = Column(String(20), nullable=False)   # YYYY-MM-DD
    session_time = Column(String(10), nullable=False)   # HH:MM
    duration_minutes = Column(String(10), nullable=False)  # e.g. "60"

    session_type = Column(String(20), nullable=False, default="virtual")  # virtual | in_person

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    coach = relationship("User", foreign_keys=[coach_id])
