import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, StaticPool
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL")

# Detect if running locally (SQLite) or in cloud (PostgreSQL)
IS_SQLITE = not DATABASE_URL or DATABASE_URL.startswith("sqlite")

if not DATABASE_URL:
    # Default to SQLite for local development without .env
    DATABASE_URL = "sqlite:///./cricket_analytics.db"
    logger.warning("DATABASE_URL not set. Using local SQLite database.")

# Handle Render's postgres:// URL format (needs postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Create engine based on database type
if IS_SQLITE:
    # SQLite config - simpler settings
    engine = create_engine(
        DATABASE_URL,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    background_engine = engine  # Use same engine for SQLite
else:
    # PostgreSQL config with connection pooling optimizations
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_pre_ping=True,       # Test connections before use
        pool_recycle=300,         # Recycle connections every 5 minutes
        pool_size=5,              # Reduced for Render free tier
        max_overflow=10,          # Allow overflow connections
        pool_timeout=30,          # Wait 30s for a connection
        connect_args={
            'connect_timeout': 10,
            'keepalives': 1,
            'keepalives_idle': 30,
            'keepalives_interval': 10,
            'keepalives_count': 5,
        }
    )

    # Separate engine for background tasks (OCR processing)
    background_engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=2,              # Minimal for background tasks
        max_overflow=3,
        pool_timeout=60,
        connect_args={
            'connect_timeout': 30,
            'keepalives': 1,
            'keepalives_idle': 60,
            'keepalives_interval': 15,
            'keepalives_count': 5,
        }
    )

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
