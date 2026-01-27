"""
API Routes Package

Routes:
- auth: Authentication (register, login, logout)
- videos: Video upload, listing, events
- jobs: OCR processing job management
- requests: Match request voting system
"""
from . import auth, videos, jobs, requests

__all__ = ["auth", "videos", "jobs", "requests"]

