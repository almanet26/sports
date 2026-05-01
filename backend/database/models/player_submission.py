import uuid
from sqlalchemy import Column, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base

_STATUS_VALUES = ("pending", "reviewed", "dismissed")


class PlayerSubmission(Base):
    """Player-to-coach job submission (lightweight inbox model, distinct from VideoSubmission B2B2C pipeline)."""
    __tablename__ = "player_submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    player_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    coach_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # job_id references the OCR highlight job the player wants the coach to review.
    job_id = Column(String(36), ForeignKey("highlight_jobs.id", ondelete="SET NULL"), nullable=True, index=True)
    note = Column(Text, nullable=True)
    status = Column(
        Enum(*_STATUS_VALUES, name="player_submission_status_enum", native_enum=False),
        nullable=False,
        default="pending",
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    player = relationship("User", foreign_keys=[player_id], backref="inbox_submissions_sent")
    coach = relationship("User", foreign_keys=[coach_id], backref="inbox_submissions_received")
    job = relationship("HighlightJob", backref="inbox_submission")

    def __repr__(self) -> str:
        return f"<PlayerSubmission {self.id} player={self.player_id} coach={self.coach_id} status={self.status}>"