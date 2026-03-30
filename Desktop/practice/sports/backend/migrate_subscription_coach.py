"""
Database migration script to add subscription and coach verification fields.
Run this script to update the existing database schema.
"""

from sqlalchemy import text
from database.config import engine, SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_add_subscription_and_coach_fields():
    """Add subscription_plan, coach_status, and coach_document_url fields to users table."""
    
    db = SessionLocal()
    
    try:
        logger.info("Starting migration: Adding subscription and coach verification fields...")
        
        # Check if columns already exist
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name IN ('subscription_plan', 'coach_status', 'coach_document_url')
        """))
        existing_columns = [row[0] for row in result]
        
        # Add subscription_plan column if it doesn't exist
        if 'subscription_plan' not in existing_columns:
            logger.info("Adding subscription_plan column...")
            db.execute(text("""
                ALTER TABLE users 
                ADD COLUMN subscription_plan VARCHAR DEFAULT 'BASIC' NOT NULL
            """))
            logger.info("✓ subscription_plan column added")
        else:
            logger.info("subscription_plan column already exists")
        
        # Add coach_status column if it doesn't exist
        if 'coach_status' not in existing_columns:
            logger.info("Adding coach_status column...")
            db.execute(text("""
                ALTER TABLE users 
                ADD COLUMN coach_status VARCHAR DEFAULT 'pending'
            """))
            logger.info("✓ coach_status column added")
        else:
            logger.info("coach_status column already exists")
        
        # Add coach_document_url column if it doesn't exist
        if 'coach_document_url' not in existing_columns:
            logger.info("Adding coach_document_url column...")
            db.execute(text("""
                ALTER TABLE users 
                ADD COLUMN coach_document_url VARCHAR
            """))
            logger.info("✓ coach_document_url column added")
        else:
            logger.info("coach_document_url column already exists")
        
        # Update existing PLAYER users to have BASIC subscription
        logger.info("Setting BASIC subscription for existing PLAYER users...")
        db.execute(text("""
            UPDATE users 
            SET subscription_plan = 'BASIC' 
            WHERE role = 'PLAYER' AND subscription_plan IS NULL
        """))
        
        # Update existing COACH users to have verified status (for backward compatibility)
        logger.info("Setting verified status for existing COACH users...")
        db.execute(text("""
            UPDATE users 
            SET coach_status = 'verified' 
            WHERE role = 'COACH' AND coach_status = 'pending'
        """))
        
        db.commit()
        logger.info("✓ Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_add_subscription_and_coach_fields()
