import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from database.config import Base


class CoachReview(Base):
    __tablename__ = "coach_reviews"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    coach_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    player_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("coach_id", "player_id", name="uq_coach_player_review"),
    )
