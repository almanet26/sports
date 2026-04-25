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
from database.models.coach_session import CoachTrainingSession
from database.models.coach_availability import CoachAvailability
from database.models.coach_training_plan import CoachTrainingPlan
from database.models.coach_content import CoachContent, ContentType
from database.models.message import Message
from database.models.transaction import Transaction, TransactionType, TransactionStatus
from database.models.review import Review
from database.models.coach_review import CoachReview
from database.models.match import Match

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
