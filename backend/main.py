import logging
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
from sqlalchemy import text
from database.config import SessionLocal, engine, Base

# Import all models to ensure they're registered with SQLAlchemy
from database.models import (
    User, UserSession, ProcessingJob,
    Video, HighlightEvent, HighlightJob, MatchRequest, UserVote
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Ensure storage directories exist
STORAGE_DIRS = [
    "storage/uploads",
    "storage/raw",
    "storage/trimmed",
    "storage/highlight",
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
    # Default origins for local development
    ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]
else:
    # Clean up any whitespace from env var
    ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()]

logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for video/clip serving
app.mount("/static/uploads", StaticFiles(directory="storage/uploads"), name="uploads")
app.mount("/static/clips", StaticFiles(directory="storage/trimmed"), name="clips")
app.mount("/static/highlights", StaticFiles(directory="storage/highlight"), name="highlights")


# ============ Health Check Endpoints ============

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


# ============ Include API Routers ============

from api.routes import auth, videos, jobs, requests

# Authentication routes
app.include_router(auth.router, prefix="/api/v1", tags=["authentication"])

# Video management routes
app.include_router(videos.router, prefix="/api/v1", tags=["videos"])

# OCR processing job routes
app.include_router(jobs.router, prefix="/api/v1", tags=["jobs"])

# Match request/voting routes
app.include_router(requests.router, prefix="/api/v1", tags=["requests"])


# ============ Entry Point ============

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )

