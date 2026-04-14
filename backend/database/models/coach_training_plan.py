import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class CoachTrainingPlan(Base):
    __tablename__ = "coach_training_plans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    coach_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    analysis_type = Column(String(50), nullable=False, default="BATTING")  # BATTING, BOWLING, FIELDING, FITNESS
    plan_type = Column(String(50), nullable=False, default="group_all")    # group_all, individual, age_group
    is_public = Column(Boolean, default=True, nullable=False)
    drills = Column(JSON, nullable=True)  # list of strings

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    coach = relationship("User", foreign_keys=[coach_id])
