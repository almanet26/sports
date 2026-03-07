"""
Bowling Analysis Schemas for Request/Response validation.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime


# Response Schemas for Bowling Analysis
class BiometricsResponse(BaseModel):
    """Core biomechanics measurements."""
    avg_elbow_angle: float = Field(0.0, description="Average right elbow angle in degrees")
    release_consistency: float = Field(0.0, description="Wrist Y standard deviation (lower = more consistent)")


class FeedbackResponse(BaseModel):
    """AI coaching feedback."""
    summary: str
    full_text: str


class DetectedBowlingFlaw(BaseModel):
    """A single detected bowling flaw extracted from AI analysis."""
    flaw_name: str = Field(..., description="Name of the detected weakness")
    description: str = Field("", description="Detailed explanation of the flaw")
    rating: Optional[int] = Field(None, ge=1, le=10, description="Severity rating 1-10")
    timestamp: Optional[str] = Field(None, description="Timestamp in seconds where flaw is visible (e.g. '1.25')")


class BowlingDrillRecommendation(BaseModel):
    """A YouTube drill recommendation derived from detected bowling flaws."""
    query: str = Field(..., description="Original search query phrase from AI")
    title: str = Field(..., description="Display title for the drill link")
    link: str = Field(..., description="YouTube search URL for the drill")
    reason: str = Field("", description="Why this drill helps fix the flaw")


class BowlingAnalysisResponse(BaseModel):
    """Full response from a bowling analysis."""
    id: str
    player_id: str
    original_filename: Optional[str] = None
    biometrics: BiometricsResponse
    feedback: FeedbackResponse
    annotated_video_url: Optional[str] = Field(None, description="URL to video with pose skeleton overlay")
    report_url: Optional[str] = None
    created_at: datetime
    detected_flaws: List[DetectedBowlingFlaw] = Field(default_factory=list, description="Weaknesses extracted from AI analysis")
    drill_recommendations: List[BowlingDrillRecommendation] = Field(default_factory=list, description="YouTube drill links for each flaw")

    model_config = ConfigDict(from_attributes=True)


class BowlingAnalysisSummary(BaseModel):
    """Lightweight summary for list views."""
    id: str
    original_filename: Optional[str] = None
    avg_elbow_angle: Optional[float] = None
    release_consistency: Optional[float] = None
    report_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BowlingAnalysisListResponse(BaseModel):
    """Paginated list of analyses."""
    analyses: list[BowlingAnalysisSummary]
    total: int
