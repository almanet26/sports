"""
Create admin user for the application.
Run this script to create an admin account.
"""

from database.models.user import User
from database.config import SessionLocal
from utils.auth import get_password_hash
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_admin():
    """Create admin user."""
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(
            User.email == "admin@test.com"
        ).first()
        
        if existing_admin:
            logger.info("Admin user already exists!")
            logger.info("Email: admin@test.com")
            logger.info("Password: Admin123!")
            return
        
        # Create admin user
        admin = User(
            email="admin@test.com",
            password_hash=get_password_hash("Admin123!"),
            name="Admin User",
            role="ADMIN"
        )
        
        db.add(admin)
        db.commit()
        
        logger.info("✓ Admin user created successfully!")
        logger.info("")
        logger.info("Admin Credentials:")
        logger.info("  Email: admin@test.com")
        logger.info("  Password: Admin123!")
        logger.info("")
        logger.info("You can now login at: http://localhost:5173/login")
        
    except Exception as e:
        logger.error(f"Failed to create admin user: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
