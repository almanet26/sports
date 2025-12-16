import uuid
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base, SessionLocal

from passlib.context import CryptContext
import secrets

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)   
    role = Column(String, nullable=False)  # PLAYER, COACH, ADMIN
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    profile_bio = Column(Text, nullable=True)
    jersey_number = Column(Integer, nullable=True)
    team = Column(String, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    
    # Authentication fields
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    email_verification_token = Column(String, nullable=True)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    
    # Password reset
    password_reset_token = Column(String, nullable=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)
    
    # Security
    last_login = Column(DateTime(timezone=True), nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships (commented out until other models are created)
    # videos = relationship("Video", back_populates="uploader")
    # clips = relationship("Clip", back_populates="user")
    # player_connections = relationship("Connection", foreign_keys="Connection.player_id", back_populates="player")
    # coach_connections = relationship("Connection", foreign_keys="Connection.coach_id", back_populates="coach")

    # Password management methods
    def set_password(self, password: str):
        """Hash and set password"""
        self.password_hash = pwd_context.hash(password)

    def verify_password(self, password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(password, self.password_hash)

    # Email verification methods
    def generate_email_verification_token(self) -> str:
        """Generate email verification token"""
        self.email_verification_token = secrets.token_urlsafe(32)
        return self.email_verification_token

    def verify_email(self):
        """Mark email as verified"""
        self.is_verified = True
        self.email_verified_at = datetime.utcnow()
        self.email_verification_token = None

    # Password reset methods
    def generate_password_reset_token(self) -> str:
        """Generate password reset token"""
        self.password_reset_token = secrets.token_urlsafe(32)
        self.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        return self.password_reset_token

    def reset_password(self, new_password: str):
        """Reset password and clear reset token"""
        self.set_password(new_password)
        self.password_reset_token = None
        self.password_reset_expires = None
        self.failed_login_attempts = 0
        self.locked_until = None

    # Login tracking methods
    def record_login(self):
        """Record successful login"""
        self.last_login = datetime.utcnow()
        self.failed_login_attempts = 0
        self.locked_until = None

    def record_failed_login(self):
        """Record failed login attempt and lock account if needed"""
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= 5:
            self.locked_until = datetime.utcnow() + timedelta(minutes=30)

    def is_account_locked(self) -> bool:
        """Check if account is locked"""
        if self.locked_until and self.locked_until > datetime.utcnow():
            return True
        return False

    def save(self):
        """Save the user to the database with exception handling."""
        db = SessionLocal()
        try:
            db.add(self)
            db.commit()
            db.refresh(self)
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def get_by_email(email):
        """Get user by email"""
        db = SessionLocal()
        try:
            return db.query(User).filter_by(email=email).first()
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def get_by_id(user_id):
        """Get user by ID"""
        db = SessionLocal()
        try:
            return db.query(User).filter_by(id=user_id).first()
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    def __repr__(self):
        return f"<User {self.email}>"