"""
Video-related Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum


class VideoVisibility(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"


class VideoStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class EventType(str, Enum):
    FOUR = "FOUR"
    SIX = "SIX"
    WICKET = "WICKET"


class VideoUploadRequest(BaseModel):
    """Request schema for video upload metadata"""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    match_date: Optional[datetime] = None
    teams: Optional[str] = Field(None, max_length=200)
    venue: Optional[str] = Field(None, max_length=200)
    visibility: VideoVisibility = VideoVisibility.PRIVATE


class VideoUpdateRequest(BaseModel):
    """Request schema for updating video metadata"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    match_date: Optional[datetime] = None
    teams: Optional[str] = Field(None, max_length=200)
    venue: Optional[str] = Field(None, max_length=200)
    visibility: Optional[VideoVisibility] = None


class VideoResponse(BaseModel):
    """Response schema for video details"""
    id: str
    title: str
    description: Optional[str]
    duration_seconds: Optional[int]
    file_path: Optional[str] = None
    supercut_path: Optional[str] = None
    match_date: Optional[datetime]
    teams: Optional[str]
    venue: Optional[str]
    visibility: str
    status: str
    total_events: int
    total_fours: int
    total_sixes: int
    total_wickets: int
    uploaded_by: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VideoListResponse(BaseModel):
    """Response schema for video list"""
    videos: List[VideoResponse]
    total: int
    page: int
    per_page: int


class HighlightEventResponse(BaseModel):
    """Response schema for a single highlight event"""
    id: str
    event_type: str
    timestamp_seconds: float
    score_before: Optional[str]
    score_after: Optional[str]
    overs: Optional[str]
    clip_path: Optional[str]
    clip_duration_seconds: Optional[float]

    model_config = ConfigDict(from_attributes=True)


class VideoEventsResponse(BaseModel):
    """Response schema for video events with filtering"""
    video_id: str
    events: List[HighlightEventResponse]
    total: int
    filter_applied: Optional[str] = None


class JobTriggerRequest(BaseModel):
    """Request schema for triggering OCR processing"""
    video_id: str
    config: Optional[dict] = None  


class JobStatusResponse(BaseModel):
    """Response schema for job status"""
    id: str
    video_id: str
    status: str
    progress_percent: int
    frames_processed: int
    ocr_success_rate: Optional[float]
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class JobResultResponse(BaseModel):
    """Response schema for completed job results"""
    id: str
    video_id: str
    status: str
    events_detected: Optional[List[dict]]
    supercut_path: Optional[str]
    ocr_success_rate: Optional[float]
    completed_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class MatchRequestCreate(BaseModel):
    """Request schema for creating a match request"""
    youtube_url: str = Field(..., min_length=1, max_length=500, description="YouTube URL of the match")
    match_title: Optional[str] = Field(None, max_length=255, description="Title of the match (optional)")
    match_date: Optional[datetime] = None
    teams: Optional[str] = Field(None, max_length=200)
    venue: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, alias="match_description")
    video_url: Optional[str] = Field(None, max_length=500)  # Legacy field

    model_config = ConfigDict(populate_by_name=True)


class MatchRequestResponse(BaseModel):
    """Response schema for match request"""
    id: str
    match_title: Optional[str]
    youtube_url: Optional[str] = None
    match_date: Optional[datetime]
    teams: Optional[str]
    venue: Optional[str]
    description: Optional[str]
    vote_count: int  # Legacy field
    upvotes: int = 0
    downvotes: int = 0
    user_vote: Optional[str] = None  # 'up', 'down', or None
    status: str
    requested_by: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MatchRequestListResponse(BaseModel):
    """Response schema for match request list"""
    requests: List[MatchRequestResponse]
    total: int
    page: int
    per_page: int
