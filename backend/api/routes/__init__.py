"""
API Routes Package

Routes:
- auth: Authentication (register, login, logout)
- videos: Video upload, listing, events
- jobs: OCR processing job management
- requests: Match request voting system
- bowling: Bowling biomechanics analysis 
- batting: Batting performance analysis
"""
from . import auth, videos, jobs, requests

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

__all__ = [
    "auth", "videos", "jobs", "requests",
    "bowling", "BOWLING_AVAILABLE",
    "batting", "BATTING_AVAILABLE",
    "submissions", "SUBMISSIONS_AVAILABLE",
]
