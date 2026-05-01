"""
CoachShortlist model — coaches bookmark players they want to follow up with.
"""

import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class CoachShortlist(Base):
    """
    Stores a coach's saved / shortlisted players.
    Composite PK (coach_id, player_id) ensures each player appears once per coach.
    """
    __tablename__ = "coach_shortlist"

    coach_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    player_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    # Coach-private note — only visible to the coach who wrote it
    note = Column(Text, nullable=True)

    added_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    coach = relationship("User", foreign_keys=[coach_id], backref="shortlisted_players")
    player = relationship("User", foreign_keys=[player_id], backref="shortlisted_by_coaches")

    def __repr__(self) -> str:
        return f"<CoachShortlist coach={self.coach_id} player={self.player_id}>"
