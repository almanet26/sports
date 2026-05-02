"""
API Routes Package

Routes:
- auth: Authentication (register, login, logout)
- videos: Video upload, listing, events
- jobs: OCR processing job management
- requests: Match request voting system
- bowling: Bowling biomechanics analysis 
- batting: Batting performance analysis
- admin_coaches: Admin routes for coach verification
"""
from . import auth, videos, jobs, requests, admin_coaches


try:
    from . import bowling
    BOWLING_AVAILABLE = True
except Exception as e:
    print(f"Warning: Bowling analysis feature disabled due to import error: {e}")
    bowling = None
    BOWLING_AVAILABLE = False

try:
    from . import batting
    BATTING_AVAILABLE = True
except Exception as e:
    print(f"Warning: Batting analysis feature disabled due to import error: {e}")
    batting = None
    BATTING_AVAILABLE = False

try:
    from . import submissions
    SUBMISSIONS_AVAILABLE = True
except Exception as e:
    print(f"Warning: Submissions feature disabled due to import error: {e}")
    submissions = None
    SUBMISSIONS_AVAILABLE = False

try:
    from . import storage
    from .storage import GCS_AVAILABLE
except Exception as e:
    print(f"Warning: Cloud storage (signed URL) feature disabled: {e}")
    storage = None
    GCS_AVAILABLE = False

try:
    from . import worker
    WORKER_AVAILABLE = True
except Exception as e:
    print(f"Warning: Worker endpoint disabled: {e}")
    worker = None
    WORKER_AVAILABLE = False

__all__ = [
    "auth", "videos", "jobs", "requests", "admin_coaches",
    "bowling", "BOWLING_AVAILABLE",
    "batting", "BATTING_AVAILABLE",
    "submissions", "SUBMISSIONS_AVAILABLE",
    "storage", "GCS_AVAILABLE",
    "worker", "WORKER_AVAILABLE",
]
