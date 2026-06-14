import sys
sys.stdout.reconfigure(encoding='utf-8')

from database.models import *
from database.models.chat_history import ChatHistory
from database.models.feature_usage import FeatureUsage
from database.models.player_profile import PlayerProfile
from database.models.admin_audit_log import AdminAuditLog
from database.models.coach_shortlist import CoachShortlist
from database.models.notification import Notification
from database.models.player_stats import PlayerStats
from database.models.player_submission import PlayerSubmission
from database.models.pro_benchmark import ProBenchmark
from database.models.video_annotation import VideoAnnotation
from sqlalchemy.orm import configure_mappers

try:
    configure_mappers()
    print("ALL MAPPERS OK - safe to commit")
except Exception as e:
    print("MAPPER ERROR:", e)
