"""
Batting Analysis Model
Stores biomechanics analysis results for player batting sessions.
"""

import uuid
from sqlalchemy import (
    Column, String, Float, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class BattingAnalysis(Base):
    """
    Stores results from the batting biomechanics analysis pipeline.
    Each record represents one analyzed video session for a player.
    """
    __tablename__ = "batting_analyses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)

    # Ownership
    player_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Source video info
    original_filename = Column(String(255), nullable=True)

    # Core batting biomechanics
    avg_head_alignment = Column(Float, nullable=True)        # 0-1 ideal; <0 or >1 = out of base
    avg_stride_length = Column(Float, nullable=True)         # normalized ankle distance
    avg_backlift_height = Column(Float, nullable=True)       # avg wrist Y (lower = higher backlift)
    avg_front_knee_angle = Column(Float, nullable=True)      # degrees
    avg_shoulder_rotation = Column(Float, nullable=True)     # degrees

    # Full metrics snapshot (DataFrame .describe().to_dict())
    metrics_snapshot = Column(JSON, nullable=True)

    # Phase detection results
    phase_info = Column(JSON, nullable=True)

    # AI feedback
    ai_feedback = Column(Text, nullable=True)

    # Generated report
    report_url = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    player = relationship("User", backref="batting_analyses", lazy="selectin")

    def __repr__(self) -> str:
        return f"<BattingAnalysis {self.id} player={self.player_id}>"
