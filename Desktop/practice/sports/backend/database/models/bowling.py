"""
Bowling Analysis Model
Stores biomechanics analysis results for player bowling sessions.
"""

import uuid
from sqlalchemy import (
    Column, String, Float, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class BowlingAnalysis(Base):
    """
    Stores results from the bowling biomechanics analysis pipeline.
    Each record represents one analyzed video session for a player.
    """
    __tablename__ = "bowling_analyses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)

    # Ownership
    player_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Source video info
    original_filename = Column(String(255), nullable=True)

    # Biomechanics summary
    avg_elbow_angle = Column(Float, nullable=True)
    release_consistency = Column(Float, nullable=True)

    # Full metrics snapshot (DataFrame .describe().to_dict())
    metrics_snapshot = Column(JSON, nullable=True)

    # AI feedback
    ai_feedback = Column(Text, nullable=True)

    # Generated report
    report_url = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    player = relationship("User", backref="bowling_analyses", lazy="selectin")

    def __repr__(self) -> str:
        return f"<BowlingAnalysis {self.id} player={self.player_id}>"
