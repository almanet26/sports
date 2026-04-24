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
from database.models.bowling import BowlingAnalysis
from database.models.batting import BattingAnalysis
from database.models.submission import VideoSubmission, SubmissionStatus
from database.models.subscription import Subscription
from database.models.monthly_usage import MonthlyUsage
from database.models.plan_config import PlanConfig
from database.models.chat_history import ChatHistory
from database.models.pro_benchmark import ProBenchmark
from database.models.player_profile import PlayerProfile
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
    # Bowling
    "BowlingAnalysis",
    # Batting
    "BattingAnalysis",
    # Submissions 
    "VideoSubmission",
    "SubmissionStatus",
    # Subscriptions and quota
    "Subscription",
    "MonthlyUsage",
    "PlanConfig",
    # Phase 4 player features
    "ChatHistory",
    "ProBenchmark",
    "PlayerProfile",
    # Enums
    "VideoVisibility",
    "VideoStatus",
    "EventType",
]
