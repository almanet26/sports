"""
Video Submission Model — B2B2C Pipeline State Machine
=====================================================
Tracks the full lifecycle: Player upload → Coach review → AI analysis → Coach edit → Published PDF.

States:
  PENDING       → Player uploaded, sitting in Coach's inbox.
  PROCESSING    → Coach triggered AI analysis (MediaPipe + Gemini running).
  DRAFT_REVIEW  → AI finished. Coach viewing editable dashboard. Player sees "Pending".
  PUBLISHED     → Coach approved & published. Player can download the PDF.
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    Enum,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.config import Base


class SubmissionStatus(str, PyEnum):
    """State machine for video submissions."""
    UPLOADING = "UPLOADING"
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    DRAFT_REVIEW = "DRAFT_REVIEW"
    PUBLISHED = "PUBLISHED"


class VideoSubmission(Base):
    __tablename__ = "video_submissions"

    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    # Actors 
    player_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    coach_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Video
    original_filename = Column(String(255), nullable=False)
    video_url = Column(String(512), nullable=False)            # path to raw upload
    analysis_type = Column(String(20), nullable=False, default="BATTING")  # BATTING | BOWLING

    # State Machine 
    status = Column(
        Enum(SubmissionStatus),
        nullable=False,
        default=SubmissionStatus.PENDING,
        index=True,
    )

    # AI / MediaPipe Data 
    raw_biometrics = Column(JSON, nullable=True)               # MediaPipe coords/angles
    phase_info = Column(JSON, nullable=True)                   # Phase detection results
    annotated_video_url = Column(String(512), nullable=True)   # Annotated video path
    key_frame_url = Column(String(512), nullable=True)         # Impact/release frame image

    # Text: AI draft vs Coach final 
    ai_draft_text = Column(Text, nullable=True)                # Raw Gemini output
    coach_final_text = Column(Text, nullable=True)             # Coach-edited & approved text

    # Published Report 
    pdf_report_url = Column(String(512), nullable=True)        # Final published PDF

    # Timestamps 
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    analyzed_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships 
    player = relationship(
        "User",
        foreign_keys=[player_id],
        backref="submissions_as_player",
    )
    coach = relationship(
        "User",
        foreign_keys=[coach_id],
        backref="submissions_as_coach",
    )

    def __repr__(self) -> str:
        return (
            f"<VideoSubmission id={self.id} player={self.player_id} "
            f"coach={self.coach_id} status={self.status}>"
        )
