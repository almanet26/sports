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
from database.models.video_annotation import VideoAnnotation
from database.models.coach_player import CoachPlayer
from database.models.academy_branding import AcademyBranding
from database.models.coach_session import CoachTrainingSession
from database.models.coach_availability import CoachAvailability
from database.models.coach_training_plan import CoachTrainingPlan
from database.models.coach_content import CoachContent
from database.models.chat_history import ChatHistory
from database.models.feature_usage import FeatureUsage
from database.models.player_profile import PlayerProfile
from database.models.notification import Notification
from database.models.player_stats import PlayerStats
from database.models.player_submission import PlayerSubmission
from database.models.admin_audit_log import AdminAuditLog
from database.models.coach_shortlist import CoachShortlist
from database.models.coach_content import CoachContent, ContentType
from database.models.message import Message
from database.models.coach_review import CoachReview
from database.models.match import Match
from database.models.plan import Plan
from database.models.feature import Feature
from database.models.plan_entitlement import PlanEntitlement
from database.models.message import Message
from database.models.transaction import Transaction, TransactionType, TransactionStatus
from database.models.review import Review

# New player & coach feature models — wrapped in try/except so missing
# tables on older DB instances don't crash startup.
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
    # Subscription
    "Subscription",
    # Coach features
    "VideoAnnotation",
    "CoachPlayer",
    "AcademyBranding",
    # Coach Content
    "CoachContent",
    "ChatHistory",
    "FeatureUsage",
    "PlayerProfile",
    "Notification",
    "PlayerStats",
    "PlayerSubmission",
    "AdminAuditLog",
    "CoachShortlist",
    # Dynamic entitlement engine
    "Plan",
    "Feature",
    "PlanEntitlement",
    # Messages
    "Message",
    # Transactions
    "Transaction",
    "TransactionType",
    "TransactionStatus",
    # Reviews
    "Review",
    # Coach Content
    "CoachContent",
    "ContentType",
    # Messages
    "Message",
    # Transactions
    "Transaction",
    "TransactionType",
    "TransactionStatus",
    # Reviews
    "Review",
    "CoachReview",
    # Matches
    "Match",
    # Enums
    "VideoVisibility",
    "VideoStatus",
    "EventType",
]
