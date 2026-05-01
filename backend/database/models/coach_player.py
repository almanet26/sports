from sqlalchemy import Column, String, DateTime, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class CoachPlayer(Base):
    __tablename__ = "coach_players"

    coach_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    player_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    added_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        PrimaryKeyConstraint("coach_id", "player_id"),
    )

    coach = relationship("User", foreign_keys=[coach_id], backref="roster_entries")
    player = relationship("User", foreign_keys=[player_id], backref="coached_by_entries")

    def __repr__(self) -> str:
        return f"<CoachPlayer coach={self.coach_id} player={self.player_id}>"