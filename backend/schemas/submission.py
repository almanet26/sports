"""
Pydantic schemas for the Video Submission (B2B2C) pipeline.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


# Request Bodies 
class SubmissionUploadRequest(BaseModel):
    """Body for player upload (file sent as multipart, coach_id as form field)."""
    coach_id: str
    analysis_type: str = "BATTING"       # BATTING | BOWLING


class PublishRequest(BaseModel):
    """Body when Coach publishes: contains the edited rich text."""
    edited_text: str


# Response: Lightweight list items 
class SubmissionSummary(BaseModel):
    """Compact representation for inbox/gallery list views."""
    id: str
    player_id: str
    coach_id: str
    player_name: Optional[str] = None
    coach_name: Optional[str] = None
    original_filename: str
    analysis_type: str
    status: str
    created_at: datetime
    analyzed_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    pdf_report_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SubmissionListResponse(BaseModel):
    submissions: list[SubmissionSummary]
    total: int


# Response: Full detail
class SubmissionDetail(BaseModel):
    """Full submission detail — used for coach analysis editor & player report view."""
    id: str
    player_id: str
    coach_id: str
    player_name: Optional[str] = None
    coach_name: Optional[str] = None
    original_filename: str
    analysis_type: str
    status: str
    video_url: str

    # AI / MediaPipe data
    raw_biometrics: Optional[dict] = None
    phase_info: Optional[dict] = None
    annotated_video_url: Optional[str] = None
    key_frame_url: Optional[str] = None

    # Text layers
    ai_draft_text: Optional[str] = None
    coach_final_text: Optional[str] = None

    # Parsed coaching insights
    detected_flaws: list[dict] = Field(default_factory=list)
    drill_recommendations: list[dict] = Field(default_factory=list)

    # Published report
    pdf_report_url: Optional[str] = None

    # Timestamps
    created_at: datetime
    analyzed_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Utility: Coach list (for player's dropdown)
class CoachListItem(BaseModel):
    id: str
    name: str
    email: str
    team: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CoachListResponse(BaseModel):
    coaches: list[CoachListItem]
