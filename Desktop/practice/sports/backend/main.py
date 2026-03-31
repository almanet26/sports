import logging
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
from sqlalchemy import text
from database.crud import bowling
from database.config import SessionLocal, engine, Base

# Import all models to ensure they're registered with SQLAlchemy
from database.models import (
    User, UserSession, ProcessingJob,
    Video, HighlightEvent, HighlightJob, MatchRequest, UserVote,
    BattingAnalysis,
    VideoSubmission,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def _ensure_users_schema(db_session) -> None:
    """Patch legacy users schema for both PostgreSQL and SQLite."""
    try:
        dialect = db_session.bind.dialect.name if db_session.bind is not None else ""

        if dialect == "sqlite":
            # SQLite support for ADD COLUMN IF NOT EXISTS depends on engine version.
            # Use PRAGMA + plain ADD COLUMN for broad compatibility.
            cols = db_session.execute(text("PRAGMA table_info(users)")).fetchall()
            existing = {str(c[1]).lower() for c in cols}

            if "subscription_plan" not in existing:
                db_session.execute(text("ALTER TABLE users ADD COLUMN subscription_plan VARCHAR(50) DEFAULT 'BASIC'"))
            if "coach_status" not in existing:
                db_session.execute(text("ALTER TABLE users ADD COLUMN coach_status VARCHAR(20) DEFAULT 'pending'"))
            if "coach_document_url" not in existing:
                db_session.execute(text("ALTER TABLE users ADD COLUMN coach_document_url TEXT"))
            if "stripe_customer_id" not in existing:
                db_session.execute(text("ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255)"))
        else:
            # Safe on Postgres and no-ops when columns already exist.
            db_session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'BASIC'"))
            db_session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_status VARCHAR(20) DEFAULT 'pending'"))
            db_session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_document_url TEXT"))
            db_session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)"))

        db_session.execute(text("UPDATE users SET subscription_plan = 'BASIC' WHERE subscription_plan IS NULL"))
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
from api.routes import plan, subscription

# Authentication routes
app.include_router(auth.router, prefix="/api/v1", tags=["authentication"])

# Admin routes
app.include_router(admin_coaches.router, prefix="/api/v1", tags=["admin"])
app.include_router(plan.router, prefix="/api/v1", tags=["admin"])
app.include_router(subscription.router, prefix="/api/v1", tags=["subscriptions"])


# Video management routes
app.include_router(videos.router, prefix="/api/v1", tags=["videos"])

# OCR processing job routes
app.include_router(jobs.router, prefix="/api/v1", tags=["jobs"])

# Match request/voting routes
app.include_router(requests.router, prefix="/api/v1", tags=["requests"])

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


# Entry Point 
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )

