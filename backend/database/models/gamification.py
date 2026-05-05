import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from database.config import Base


class PlayerBadge(Base):
    __tablename__ = "player_badges"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    player_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    badge_key = Column(String(64), nullable=False)   # e.g. "first_match", "century_scorer"
    earned_at = Column(DateTime(timezone=True), server_default=func.now())


class PlayerStreak(Base):
    __tablename__ = "player_streaks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    player_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    current_streak = Column(String(8), default="0")   # days
    longest_streak = Column(String(8), default="0")
    last_activity_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
