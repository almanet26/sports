"""
Batting Analysis Schemas for Request/Response validation.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime


# Response Schemas for Batting Analysis
class BattingBiometricsResponse(BaseModel):
    """Core batting biomechanics measurements."""
    avg_head_alignment: float = Field(0.0, description="Head position ratio (0-1 = within base)")
    avg_stride_length: float = Field(0.0, description="Normalized stride distance between ankles")
    avg_backlift_height: float = Field(0.0, description="Average wrist height (lower = higher backlift)")
    avg_front_knee_angle: float = Field(0.0, description="Front knee angle in degrees")
    avg_shoulder_rotation: float = Field(0.0, description="Shoulder rotation in degrees")


class BattingFeedbackResponse(BaseModel):
    """AI coaching feedback for batting."""
    summary: str
    full_text: str


class BattingPhaseInfo(BaseModel):
    """Detected batting phases (frame indices)."""
    stance_end: Optional[int] = None
    stride_peak: Optional[int] = None
    downswing_start: Optional[int] = None
    impact: Optional[int] = None
    followthrough_start: Optional[int] = None


class DetectedFlaw(BaseModel):
    """A single detected batting flaw extracted from AI analysis."""
    flaw_name: str = Field(..., description="Name of the detected weakness")
    description: str = Field("", description="Detailed explanation of the flaw")
    rating: Optional[int] = Field(None, ge=1, le=10, description="Severity rating 1-10")
    timestamp: Optional[str] = Field(None, description="Timestamp in seconds where flaw is visible (e.g. '1.25')")


class DrillRecommendation(BaseModel):
    """A YouTube drill recommendation derived from detected flaws."""
    query: str = Field(..., description="Original search query phrase from AI")
    title: str = Field(..., description="Display title for the drill link")
    link: str = Field(..., description="YouTube search URL for the drill")
    reason: str = Field("", description="Why this drill helps fix the flaw")


class BattingAnalysisResponse(BaseModel):
    """Full response from a batting analysis."""
    id: str
    player_id: str
    original_filename: Optional[str] = None
    biometrics: BattingBiometricsResponse
    feedback: BattingFeedbackResponse
    phases: Optional[BattingPhaseInfo] = None
    annotated_video_url: Optional[str] = Field(None, description="URL to video with pose skeleton overlay")
    report_url: Optional[str] = None
    created_at: datetime
    detected_flaws: List[DetectedFlaw] = Field(default_factory=list, description="Weaknesses extracted from AI analysis")
    drill_recommendations: List[DrillRecommendation] = Field(default_factory=list, description="YouTube drill links for each flaw")

    model_config = ConfigDict(from_attributes=True)


class BattingAnalysisSummary(BaseModel):
    """Lightweight summary for list views."""
    id: str
    original_filename: Optional[str] = None
    avg_head_alignment: Optional[float] = None
    avg_stride_length: Optional[float] = None
    avg_front_knee_angle: Optional[float] = None
    report_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BattingAnalysisListResponse(BaseModel):
    """Paginated list of batting analyses."""
    analyses: list[BattingAnalysisSummary]
    total: int
