import logging
import os
import warnings
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
from sqlalchemy import text
from dotenv import load_dotenv
from database.crud import bowling
from database.config import SessionLocal, engine, Base

# Load environment variables from .env file
load_dotenv()

# Import all models to ensure they're registered with SQLAlchemy
from database.models import (
    User, UserSession,
    Video, HighlightEvent, HighlightJob, MatchRequest, UserVote,
    BattingAnalysis,
    VideoSubmission,
    VideoAnnotation, CoachPlayer, PlayerSubmission, AcademyBranding,
    AdminAuditLog,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Suppress noisy upstream protobuf deprecation warning from Google client internals.
warnings.filterwarnings(
    "ignore",
    message=r"SymbolDatabase\.GetPrototype\(\) is deprecated\..*",
    category=UserWarning,
)


def _ensure_users_schema(db_session) -> None:
    """One-time forward-migration for columns that still exist on older DB instances."""
    try:
        dialect = db_session.bind.dialect.name if db_session.bind is not None else ""

        if dialect == "sqlite":
            cols = db_session.execute(text("PRAGMA table_info(users)")).fetchall()
            existing = {str(c[1]).lower() for c in cols}
            if "coach_status" not in existing:
                db_session.execute(text("ALTER TABLE users ADD COLUMN coach_status VARCHAR(20) DEFAULT 'pending'"))
            if "coach_document_url" not in existing:
                db_session.execute(text("ALTER TABLE users ADD COLUMN coach_document_url TEXT"))
        else:
            db_session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_status VARCHAR(20) DEFAULT 'pending'"))
            db_session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_document_url TEXT"))

        # Ensure users.role holds only account-type values (PLAYER|COACH|ADMIN).
        # Any row that still carries an old subscription-tier value (free, basic …)
        # is mapped back to PLAYER — the safe default.
        db_session.execute(
            text(
                "UPDATE users "
                "SET role = 'PLAYER' "
                "WHERE role NOT IN ('PLAYER', 'COACH', 'ADMIN')"
            )
        )

        db_session.commit()
        logger.info("Users schema patch check completed.")
    except Exception as patch_err:
        db_session.rollback()
        logger.warning("Users schema patch skipped/failed: %s", patch_err)


def _ensure_videos_schema(db_session) -> None:
    """Patch legacy videos schema for large file uploads."""
    try:
        dialect = db_session.bind.dialect.name if db_session.bind is not None else ""
        if dialect != "sqlite":
            # Prevent overflow for files larger than 2GB.
            db_session.execute(text("ALTER TABLE videos ALTER COLUMN file_size_bytes TYPE BIGINT"))
            db_session.commit()
            logger.info("Videos schema patch check completed.")
    except Exception as patch_err:
        db_session.rollback()
        logger.warning("Videos schema patch skipped/failed: %s", patch_err)


def _ensure_submission_status_enum(db_session) -> None:
    """Ensure legacy PostgreSQL enum includes UPLOADING status value."""
    try:
        dialect = db_session.bind.dialect.name if db_session.bind is not None else ""
        if dialect != "sqlite":
            db_session.execute(
                text("ALTER TYPE submissionstatus ADD VALUE IF NOT EXISTS 'UPLOADING'")
            )
            db_session.commit()
            logger.info("Submission status enum patch check completed.")
    except Exception as patch_err:
        db_session.rollback()
        logger.warning("Submission status enum patch skipped/failed: %s", patch_err)


def _ensure_plan_config(db_session) -> None:
    """Keep plan_config aligned with the current monetization rules."""
    try:
        plan_rows = [
            # plan_key, role, display_name, price_inr, duration_days, max_biomech, max_ocr_hours, max_submissions, max_players
            ("free",           "free",          "Free",          0,     36500, 3,   0,   0,    0),
            ("coach_free",     "coach_free",    "Coach Free",    0,     36500, 0,   0,   0,    0),
            ("basic_90d",      "basic",         "Basic",         499,   90,   15,   0,   5,    0),
            ("platinum_180d",  "platinum",      "Platinum",      1499,  180,  50,   0,   15,   0),
            ("coach_starter",  "coach_starter", "Coach Starter", 1999,  90,   999,  50,  150,  10),
            ("coach_pro",      "coach_pro",     "Coach Pro",     4999,  180,  999,  150, 600,  100),
            ("academy",        "academy",       "Academy",       14999, 365,  999,  500, 1500, -1),
        ]

        for plan_key, role, display_name, price_inr, duration_days, biomech, ocr_hours, submissions, players in plan_rows:
            db_session.execute(
                text(
                    "INSERT INTO plan_config "
                    "(plan_key, role, display_name, price_inr, duration_days, max_biomech_per_month, max_ocr_hours_per_month, max_submissions_per_month, max_players_in_dashboard) "
                    "VALUES (:plan_key, :role, :display_name, :price_inr, :duration_days, :max_biomech_per_month, :max_ocr_hours_per_month, :max_submissions_per_month, :max_players_in_dashboard) "
                    "ON CONFLICT(plan_key) DO UPDATE SET "
                    "role = excluded.role, "
                    "display_name = excluded.display_name, "
                    "price_inr = excluded.price_inr, "
                    "duration_days = excluded.duration_days, "
                    "max_biomech_per_month = excluded.max_biomech_per_month, "
                    "max_ocr_hours_per_month = excluded.max_ocr_hours_per_month, "
                    "max_submissions_per_month = excluded.max_submissions_per_month, "
                    "max_players_in_dashboard = excluded.max_players_in_dashboard"
                ),
                {
                    "plan_key": plan_key,
                    "role": role,
                    "display_name": display_name,
                    "price_inr": price_inr,
                    "duration_days": duration_days,
                    "max_biomech_per_month": biomech,
                    "max_ocr_hours_per_month": ocr_hours,
                    "max_submissions_per_month": submissions,
                    "max_players_in_dashboard": players,
                },
            )

        db_session.commit()
        logger.info("Plan config patch check completed.")
    except Exception as patch_err:
        db_session.rollback()
        logger.warning("Plan config patch skipped/failed: %s", patch_err)

# Ensure storage directories exist (skip on Cloud Run — ephemeral, uses /tmp/)
_CLOUD_RUN = os.getenv("CLOUD_RUN", "").lower() in ("1", "true", "yes")
if not _CLOUD_RUN:
    STORAGE_DIRS = [
        "storage/uploads",
        "storage/raw",
        "storage/trimmed",
        "storage/highlight",
        "storage/reports",
        "storage/bowling_videos",
        "storage/batting_videos",
        "storage/submissions",
        "storage/submission_videos",
        "storage/temp_frames",
        "storage/coach_documents",
        "storage/coach_intro_videos",
    ]
    for dir_path in STORAGE_DIRS:
        Path(dir_path).mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - startup and shutdown events."""
    try:
        logger.info("Starting Cricket Highlight Platform API...")
        
        # Check database connection
        logger.info("Checking database connection...")
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        logger.info("Database connection successful.")
        
        # Create tables if they don't exist (dev mode)
        logger.info("Ensuring database tables exist...")
        Base.metadata.create_all(bind=engine)

        # Patch legacy schema drift (Cloud SQL instances created before new auth fields).
        _ensure_users_schema(db)
        _ensure_videos_schema(db)
        _ensure_submission_status_enum(db)
        _ensure_plan_config(db)
        logger.info("Database tables ready.")
        
        db.close()
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise
    
    yield
    
    logger.info("Shutting down Cricket Highlight Platform API...")


app = FastAPI(
    title="Cricket Highlight Platform API",
    description="""
## Cricket Highlight Generator - SaaS Platform

A platform for automated cricket highlight generation using OCR-based event detection.
""",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware for frontend
# Get allowed origins from environment or use defaults for local dev
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")
if not ALLOWED_ORIGINS or ALLOWED_ORIGINS == [""]:
    # Default origins for local development + production deployments
    ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://sports-teal-two.vercel.app",  # Vercel production frontend
    ]
    # Append additional production frontend URL from env if set
    _frontend = os.getenv("FRONTEND_URL", "").strip()
    if _frontend and _frontend not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(_frontend)
else:
    # Clean up any whitespace from env var
    ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]

logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://sports-.*-almanets-projects-17904779\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Mount static files for video/clip serving (skip on Cloud Run — served from GCS)
if not _CLOUD_RUN:
    app.mount("/static/uploads", StaticFiles(directory="storage/uploads"), name="uploads")
    app.mount("/static/clips", StaticFiles(directory="storage/trimmed"), name="clips")
    app.mount("/static/highlights", StaticFiles(directory="storage/highlight"), name="highlights")
    app.mount("/static/reports", StaticFiles(directory="storage/reports"), name="reports")
    app.mount("/static/bowling_videos", StaticFiles(directory="storage/bowling_videos"), name="bowling_videos")
    app.mount("/static/batting_videos", StaticFiles(directory="storage/batting_videos"), name="batting_videos")
    app.mount("/static/submissions", StaticFiles(directory="storage/submissions"), name="submissions")
    app.mount("/static/submission_videos", StaticFiles(directory="storage/submission_videos"), name="submission_videos")
    app.mount("/static/temp_frames", StaticFiles(directory="storage/temp_frames"), name="temp_frames")
    app.mount("/static/coach_documents", StaticFiles(directory="storage/coach_documents"), name="coach_documents")
    app.mount("/static/coach_intro_videos", StaticFiles(directory="storage/coach_intro_videos"), name="coach_intro_videos")


# Health Check Endpoints 
@app.get("/", tags=["health"])
def read_root():
    """Root endpoint - API info."""
    return {
        "name": "Cricket Highlight Platform API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


@app.get("/api/v1/health", tags=["health"])
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "cricket-highlight-api"}


@app.get("/api/v1/db-health", tags=["health"])
def db_health_check():
    """Database health check."""
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"status": "error", "database": "disconnected", "detail": str(e)}


# Include API Routers 
from api.routes import auth, videos, jobs, requests, player_stats, bowling, BOWLING_AVAILABLE, batting, BATTING_AVAILABLE, submissions, SUBMISSIONS_AVAILABLE, storage, GCS_AVAILABLE, worker, WORKER_AVAILABLE, admin_coaches
from api.routes import match, notification
from api.routes import subscription

# Authentication routes
app.include_router(auth.router, prefix="/api/v1", tags=["authentication"])

# Admin routes
app.include_router(admin_coaches.router, prefix="/api/v1", tags=["admin"])
app.include_router(subscription.router, prefix="/api/v1", tags=["subscriptions"])

from api.routes import admin as admin_users
app.include_router(admin_users.router, prefix="/api/v1", tags=["admin"])


# Video management routes
app.include_router(videos.router, prefix="/api/v1", tags=["videos"])

# OCR processing job routes
app.include_router(jobs.router, prefix="/api/v1", tags=["jobs"])

# Match request/voting routes
app.include_router(requests.router, prefix="/api/v1", tags=["requests"])

# Matches and notifications routes
app.include_router(match.router, prefix="/api/v1", tags=["matches"])
app.include_router(notification.router, prefix="/api/v1", tags=["notifications"])

# Player statistics routes (read-only API)
app.include_router(player_stats.router, prefix="/api/v1", tags=["player-stats"])

# Bowling Analysis routes
if BOWLING_AVAILABLE and bowling is not None:
    app.include_router(bowling.router, prefix="/api/v1/bowling", tags=["bowling"])
    logger.info("Bowling analysis feature enabled")
else:
    logger.warning("Bowling analysis feature disabled (MediaPipe not available)")

# Batting Analysis routes
if BATTING_AVAILABLE and batting is not None:
    app.include_router(batting.router, prefix="/api/v1/batting", tags=["batting"])
    logger.info("Batting analysis feature enabled")
else:
    logger.warning("Batting analysis feature disabled (MediaPipe not available)")

# Submissions routes
app.include_router(submissions.public_router, prefix="/api/v1", tags=["submissions-public"])
if SUBMISSIONS_AVAILABLE and submissions is not None:
    app.include_router(submissions.router, prefix="/api/v1/submissions", tags=["submissions"])
    logger.info("B2B2C Submissions pipeline enabled")
else:
    logger.warning("Submissions pipeline disabled")

# Cloud Storage (Direct-to-GCS signed URL uploads)
if GCS_AVAILABLE and storage is not None:
    app.include_router(storage.router, prefix="/api/v1/storage", tags=["storage"])
    logger.info("Direct-to-GCS upload feature enabled")
else:
    logger.warning("Direct-to-GCS upload feature disabled (GCS not configured)")

# Internal Worker endpoint (called by Cloud Tasks, NOT public API)
if WORKER_AVAILABLE and worker is not None:
    app.include_router(worker.router, prefix="/internal/worker", tags=["worker"])
    logger.info("Internal worker endpoint enabled")
else:
    logger.warning("Internal worker endpoint disabled")

# Usage tracking — internal callback + user-facing billing dashboard
from api.routes.usage import internal_router as usage_internal_router
from api.routes.usage import billing_router as usage_billing_router

app.include_router(usage_internal_router, prefix="/internal/usage", tags=["internal"])
app.include_router(usage_billing_router, prefix="/api/v1/billing", tags=["billing"])

# Phase 4 player-facing features
from api.routes.report import router as report_router
from api.routes.chat import router as chat_router
from api.routes.benchmarks import router as benchmarks_router
from api.routes.profile import router as profile_router
from api.routes.scouting import router as scouting_router

app.include_router(report_router,     prefix="/api/v1", tags=["report"])
app.include_router(chat_router,       prefix="/api/v1", tags=["chat"])
app.include_router(benchmarks_router, prefix="/api/v1", tags=["benchmarks"])
app.include_router(profile_router,    prefix="/api/v1", tags=["profile"])
app.include_router(scouting_router,   prefix="/api/v1", tags=["scouting"])

# Phase 5 coach-facing features
from api.routes.annotations import router as annotations_router
from api.routes.dashboard import router as dashboard_router
from api.routes.coach_inbox import router as coach_inbox_router
from api.routes.academy import router as academy_router

app.include_router(annotations_router, prefix="/api/v1", tags=["annotations"])
app.include_router(dashboard_router,   prefix="/api/v1", tags=["dashboard"])
app.include_router(coach_inbox_router, prefix="/api/v1", tags=["coach-inbox"])
app.include_router(academy_router,     prefix="/api/v1", tags=["academy"])
    
# Subscription expiry cron — POST /internal/cron/expire-subscriptions
from services.subscription_expiry import register_expiry_endpoint
register_expiry_endpoint(app)


# Entry Point 
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )

