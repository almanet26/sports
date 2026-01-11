# Database Models Package

# Import all models for SQLAlchemy to recognize them
from database.models.user import User
from database.models.session import UserSession, ProcessingJob, JobStatus
from database.models.video import (
    Video,
    HighlightEvent,
    HighlightJob,
    MatchRequest,
    UserVote,
    VideoVisibility,
    VideoStatus,
    EventType,
)

__all__ = [
    # User models
    "User",
    "UserSession",
    "ProcessingJob",
    "JobStatus",
    # Video models
    "Video",
    "HighlightEvent",
    "HighlightJob",
    "MatchRequest",
    "UserVote",
    # Enums
    "VideoVisibility",
    "VideoStatus",
    "EventType",
]
