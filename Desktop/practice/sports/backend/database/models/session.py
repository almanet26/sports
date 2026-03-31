import uuid
from datetime import datetime, timedelta
from enum import Enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base, SessionLocal


class JobStatus(str, Enum):
    """Job status enumeration"""
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token = Column(String(512), nullable=False, unique=True, index=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    user = relationship("User")

    @staticmethod
    def create_session(user_id: uuid.UUID, refresh_token: str, ip_address: str = None, user_agent: str = None, expires_in_days: int = 30):
        """Create a new user session"""
        db = SessionLocal()
        try:
            session = UserSession(
                user_id=user_id,
                refresh_token=refresh_token,
                ip_address=ip_address,
                user_agent=user_agent,
                expires_at=datetime.utcnow() + timedelta(days=expires_in_days)
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            return session
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def get_by_token(refresh_token: str):
        """Get session by refresh token"""
        db = SessionLocal()
        try:
            return db.query(UserSession).filter_by(refresh_token=refresh_token, revoked_at=None).first()
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    def revoke(self):
        """Revoke this session"""
        db = SessionLocal()
        try:
            self.revoked_at = datetime.utcnow()
            db.add(self)
            db.commit()
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def revoke_all_user_sessions(user_id: uuid.UUID):
        """Revoke all sessions for a user"""
        db = SessionLocal()
        try:
            db.query(UserSession).filter_by(user_id=user_id, revoked_at=None).update({"revoked_at": datetime.utcnow()})
            db.commit()
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    def is_valid(self) -> bool:
        """Check if session is valid"""
        if self.revoked_at:
            return False
        if self.expires_at < datetime.utcnow():
            return False
        return True

    def __repr__(self):
        return f"<UserSession {self.id} for user {self.user_id}>"


class ProcessingJob(Base):
    """Video processing job tracking"""
    __tablename__ = "processing_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), unique=True, nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    video_url = Column(Text, nullable=False)
    match_id = Column(String(255), nullable=False)
    data_source = Column(String(50), nullable=False)  # cricsheet, sportmonks, etc.
    status = Column(String(20), nullable=False, default=JobStatus.QUEUED.value)  # queued, processing, completed, failed
    
    # Video processing results
    video_id = Column(String(255), nullable=True)
    total_clips = Column(Integer, nullable=True)
    total_events = Column(Integer, nullable=True)
    result_data = Column(JSON, nullable=True)  # Store clips info, events, etc.
    
    # Error handling
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    user = relationship("User")

    def __repr__(self):
        return f"<ProcessingJob {self.job_id} ({self.status})>"
