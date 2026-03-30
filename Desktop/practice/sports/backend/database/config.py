import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, StaticPool
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL")
LOCAL_SQLITE_URL = "sqlite:///./cricket_analytics.db"

# Local/dev safety switch: when true, fallback to SQLite if Postgres init fails.
ALLOW_SQLITE_FALLBACK = os.getenv("ALLOW_SQLITE_FALLBACK", "false").lower() in {"1", "true", "yes"}
IS_CLOUD_RUN = os.getenv("K_SERVICE") is not None

# Detect if running locally (SQLite) or in cloud (PostgreSQL)
IS_SQLITE = not DATABASE_URL or DATABASE_URL.startswith("sqlite")

if not DATABASE_URL:
    # Default to SQLite for local development without .env
    DATABASE_URL = LOCAL_SQLITE_URL
    logger.warning("DATABASE_URL not set. Using local SQLite database.")

# Handle Render's postgres:// URL format (needs postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def _build_sqlite_engines(url: str):
    sqlite_engine = create_engine(
        url,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    return sqlite_engine, sqlite_engine


def _build_postgres_engines(url: str):
    primary = create_engine(
        url,
        poolclass=QueuePool,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        connect_args={
            "connect_timeout": 10,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        },
    )

    background = create_engine(
        url,
        poolclass=QueuePool,
        pool_pre_ping=True,
        pool_recycle=1800,
        pool_size=2,
        max_overflow=3,
        pool_timeout=60,
        connect_args={
            "connect_timeout": 30,
            "keepalives": 1,
            "keepalives_idle": 60,
            "keepalives_interval": 15,
            "keepalives_count": 5,
        },
    )
    return primary, background


# Create engine(s) with safe local fallback.
if IS_SQLITE:
    engine, background_engine = _build_sqlite_engines(DATABASE_URL)
else:
    engine, background_engine = _build_postgres_engines(DATABASE_URL)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except SQLAlchemyError as db_err:
        if ALLOW_SQLITE_FALLBACK and not IS_CLOUD_RUN:
            logger.warning(
                "Primary PostgreSQL unavailable (%s). Falling back to local SQLite for development.",
                db_err,
            )
            DATABASE_URL = LOCAL_SQLITE_URL
            IS_SQLITE = True
            engine, background_engine = _build_sqlite_engines(DATABASE_URL)
        else:
            raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
BackgroundSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=background_engine)

Base = declarative_base()


def get_db():
    """Dependency for database session (FastAPI routes).
    
    IMPORTANT: This is a simple generator that yields a session.
    Do NOT add retry logic here - it breaks exception handling!
    The generator must cleanly yield and close, nothing more.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_background_db():
    """Get a database session for background tasks (OCR processing)"""
    return BackgroundSessionLocal()
