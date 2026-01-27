"""
Video and Highlight Job Models
Links videos to users and tracks OCR processing jobs.
"""

import uuid
from enum import Enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey, 
    Text, JSON, Boolean, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class VideoVisibility(str, Enum):
    """Video visibility enumeration"""
    PUBLIC = "public"
    PRIVATE = "private"


class VideoStatus(str, Enum):
    """Video processing status enumeration"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class EventType(str, Enum):
    """Cricket event types detected by OCR"""
    FOUR = "FOUR"
    SIX = "SIX"
    WICKET = "WICKET"


class Video(Base):
    """
    Video model for storing uploaded match videos.
    Supports both public (admin-uploaded) and private (premium user) videos.
    """
    __tablename__ = "videos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    
    # Video metadata
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    
    # Match metadata
    match_date = Column(DateTime, nullable=True)
    teams = Column(String(200), nullable=True)  # e.g., "IND vs AUS"
    venue = Column(String(200), nullable=True)
    
    # Visibility and ownership
    visibility = Column(String(20), nullable=False, default=VideoVisibility.PRIVATE.value)
    uploaded_by = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Processing status
    status = Column(String(20), nullable=False, default=VideoStatus.PENDING.value)
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)
    processing_error = Column(Text, nullable=True)
    
    # Statistics (populated after processing)
    total_events = Column(Integer, default=0)
    total_fours = Column(Integer, default=0)
    total_sixes = Column(Integer, default=0)
    total_wickets = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # Soft delete

    # Relationships
    uploader = relationship("User", backref="videos")
    events = relationship("HighlightEvent", back_populates="video", cascade="all, delete-orphan")
    highlight_job = relationship("HighlightJob", back_populates="video", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Video {self.id}: {self.title} ({self.status})>"

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "duration_seconds": self.duration_seconds,
            "match_date": self.match_date.isoformat() if self.match_date else None,
            "teams": self.teams,
            "venue": self.venue,
            "visibility": self.visibility,
            "status": self.status,
            "total_events": self.total_events,
            "total_fours": self.total_fours,
            "total_sixes": self.total_sixes,
            "total_wickets": self.total_wickets,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class HighlightEvent(Base):
    """
    Individual highlight events detected by OCR engine.
    Stores timestamp, event type, score changes, and clip paths.
    """
    __tablename__ = "highlight_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    video_id = Column(String(36), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Event data
    event_type = Column(String(20), nullable=False)  # FOUR, SIX, WICKET
    timestamp_seconds = Column(Float, nullable=False)
    
    # Score context (from OCR)
    score_before = Column(String(20), nullable=True)  # e.g., "145/3"
    score_after = Column(String(20), nullable=True)   # e.g., "151/3"
    overs = Column(String(10), nullable=True)         # e.g., "23.4"
    
    # Generated clip
    clip_path = Column(String(500), nullable=True)
    clip_duration_seconds = Column(Float, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    video = relationship("Video", back_populates="events")

    def __repr__(self):
        return f"<HighlightEvent {self.event_type} at {self.timestamp_seconds}s>"

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "event_type": self.event_type,
            "timestamp_seconds": self.timestamp_seconds,
            "score_before": self.score_before,
            "score_after": self.score_after,
            "overs": self.overs,
            "clip_path": self.clip_path,
            "clip_duration_seconds": self.clip_duration_seconds,
        }


class HighlightJob(Base):
    """
    OCR processing job for a video.
    
    Tracks the state of highlight generation and stores results.
    """
    __tablename__ = "highlight_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    video_id = Column(String(36), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # Job status
    status = Column(String(20), nullable=False, default=VideoStatus.PENDING.value)
    progress_percent = Column(Integer, default=0)  # 0-100
    
    # OCR Configuration used
    config = Column(JSON, nullable=True)  # ROI settings, thresholds, etc.
    
    # Processing metrics
    frames_processed = Column(Integer, default=0)
    ocr_success_rate = Column(Float, nullable=True)  # Percentage
    
    # Results
    events_detected = Column(JSON, nullable=True)  # Array of event dicts
    supercut_path = Column(String(500), nullable=True)
    
    # Error handling
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    video = relationship("Video", back_populates="highlight_job")

    def __repr__(self):
        return f"<HighlightJob {self.id} for video {self.video_id} ({self.status})>"

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "video_id": self.video_id,
            "status": self.status,
            "progress_percent": self.progress_percent,
            "frames_processed": self.frames_processed,
            "ocr_success_rate": self.ocr_success_rate,
            "events_detected": self.events_detected,
            "supercut_path": self.supercut_path,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class MatchRequest(Base):
    """
    User requests for matches to be added to the public library.
    
    Implements voting system for popularity-based prioritization.
    """
    __tablename__ = "match_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    
    # Match details
    match_title = Column(String(255), nullable=True)  # Optional - can be auto-extracted
    youtube_url = Column(String(500), nullable=False)  # Required: YouTube URL to process
    match_date = Column(DateTime, nullable=True)
    teams = Column(String(200), nullable=True)
    venue = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    video_url = Column(String(500), nullable=True)  # Legacy field
    
    # Voting
    vote_count = Column(Integer, default=1)  # Legacy - kept for backward compatibility
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    
    # Status
    status = Column(String(20), default="pending")  # pending, approved, completed, rejected
    
    # Tracking
    requested_by = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    fulfilled_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    fulfilled_video_id = Column(String(36), ForeignKey("videos.id", ondelete="SET NULL"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    requester = relationship("User", foreign_keys=[requested_by], backref="match_requests")
    fulfiller = relationship("User", foreign_keys=[fulfilled_by])
    fulfilled_video = relationship("Video")

    def __repr__(self):
        return f"<MatchRequest {self.match_title} ({self.vote_count} votes)>"


class UserVote(Base):
    """
    Tracks user votes on match requests to prevent duplicate voting.
    """
    __tablename__ = "user_votes"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    request_id = Column(String(36), ForeignKey("match_requests.id", ondelete="CASCADE"), primary_key=True)
    vote_type = Column(String(10), nullable=False)  # 'up' or 'down'
    voted_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", backref="votes")
    request = relationship("MatchRequest", backref="votes")

    def __repr__(self):
        return f"<UserVote user={self.user_id} request={self.request_id}>"
