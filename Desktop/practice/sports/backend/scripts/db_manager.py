"""
Database Management Script - Unified database operations
Handles table creation, migrations, and database maintenance

Usage:
    python scripts/db_manager.py                       # Create all tables (default)
    python scripts/db_manager.py --migrate jobs        # Run specific migration
    python scripts/db_manager.py --list-tables         # List all tables
    python scripts/db_manager.py --test-connection     # Test database connection
"""

import argparse
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.config import engine, Base
from database.models.user import User
from database.models.session import UserSession, ProcessingJob

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def create_all_tables():
    """Create all tables defined in SQLAlchemy models"""
    try:
        logger.info("Creating all database tables...")
        Base.metadata.create_all(bind=engine)

        logger.info("All tables created successfully!")
        logger.info("\nCreated tables:")
        for table in Base.metadata.sorted_tables:
            logger.info(f"  - {table.name}")

        return True
    except Exception as e:
        logger.error(f"Error creating tables: {e}")
        return False


def migrate_processing_jobs():
    """Create the processing_jobs table (specific migration)"""
    try:
        logger.info("Running migration: Add processing_jobs table...")

        # This creates only the processing_jobs table if it doesn't exist
        ProcessingJob.__table__.create(bind=engine, checkfirst=True)

        logger.info("Processing - jobs table created/verified successfully!")
        logger.info("\nTable structure:")
        logger.info("  - job_id (unique identifier)")
        logger.info("  - user_id (who requested the job)")
        logger.info("  - video_url (YouTube URL or video source)")
        logger.info("  - match_id (match identifier from API)")
        logger.info("  - data_source (cricsheet, sportmonks, etc.)")
        logger.info("  - status (queued, processing, completed, failed)")
        logger.info("  - video_id, total_clips, total_events (results)")
        logger.info("  - error_message (if failed)")
        logger.info("  - created_at, started_at, completed_at (timestamps)")

        return True
    except Exception as e:
        logger.error(f"Error running migration: {e}")
        return False


def list_tables():
    """List all tables in the database"""
    try:
        logger.info("Database tables:")
        for table in Base.metadata.sorted_tables:
            logger.info(f"  - {table.name}")
            # Show column count
            col_count = len(table.columns)
            logger.info(f"    Columns: {col_count}")

        return True
    except Exception as e:
        logger.error(f"Error listing tables: {e}")
        return False


def test_connection():
    """Test database connection"""
    try:
        logger.info("Testing database connection...")
        with engine.connect() as conn:
            logger.info("Database connection successful!")
            logger.info(f"  Engine: {engine.url}")
        return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        logger.error("\nTroubleshooting:")
        logger.error("  1. Check if database server is running")
        logger.error("  2. Verify DATABASE_URL in .env file")
        logger.error("  3. Ensure database credentials are correct")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Database Management Tool for Cricket Highlight Generator"
    )

    # Optional operations (mutually exclusive)
    group = parser.add_mutually_exclusive_group(required=False)
    group.add_argument(
        "--migrate",
        choices=["jobs", "users", "sessions"],
        help="Run specific migration (jobs, users, sessions)",
    )
    group.add_argument(
        "--list-tables", action="store_true", help="List all existing tables"
    )
    group.add_argument(
        "--drop-all", action="store_true", help="Drop all tables (requires --confirm)"
    )
    group.add_argument(
        "--test-connection", action="store_true", help="Test database connection"
    )

    args = parser.parse_args()

    # Print header
    print("=" * 70)
    print("Database Management Tool - Cricket Highlight Generator")
    print("=" * 70)
    print()

    success = False

    # Default behavior: create all tables if no specific operation specified
    if not any([args.migrate, args.list_tables, args.drop_all, args.test_connection]):
        logger.info("No specific operation specified. Creating all tables...")
        success = create_all_tables()

    elif args.migrate:
        if args.migrate == "jobs":
            success = migrate_processing_jobs()
        elif args.migrate == "users":
            logger.info("Creating users table...")
            User.__table__.create(bind=engine, checkfirst=True)
            success = True
        elif args.migrate == "sessions":
            logger.info("Creating sessions table...")
            UserSession.__table__.create(bind=engine, checkfirst=True)
            success = True

    elif args.list_tables:
        success = list_tables()

    elif args.test_connection:
        success = test_connection()

    # Print footer
    print()
    print("=" * 70)
    if success:
        print("Operation completed successfully!")
    else:
        print("Operation failed. Check logs above for details.")
    print("=" * 70)
    print()

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
