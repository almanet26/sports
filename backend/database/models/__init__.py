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
from database.models.video_annotation import VideoAnnotation
from database.models.coach_player import CoachPlayer
from database.models.player_submission import PlayerSubmission
from database.models.academy_branding import AcademyBranding
from database.models.admin_audit_log import AdminAuditLog
from database.models.coach_shortlist import CoachShortlist
from database.models.coach_content import CoachContent, ContentType

# New player & coach feature models — wrapped in try/except so missing
# tables on older DB instances don't crash startup.
try:
    from database.models.notification import Notification
except Exception:
    pass
try:
    from database.models.gamification import PlayerBadge, PlayerStreak
except Exception:
    pass
try:
    from database.models.player_performance import PlayerPerformanceEntry
except Exception:
    pass
try:
    from database.models.coach_review import CoachReview
except Exception:
    pass
try:
    from database.models.match import Match
except Exception:
    pass
try:
    from database.models.message import Message
except Exception:
    pass
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
    # Phase 5 coach features
    "VideoAnnotation",
    "CoachPlayer",
    "PlayerSubmission",
    "AcademyBranding",
    "AdminAuditLog",
    # Scouting
    "CoachShortlist",
    # Coach Content
    "CoachContent",
    "ContentType",
    # Enums
    "VideoVisibility",
    "VideoStatus",
    "EventType",
]
