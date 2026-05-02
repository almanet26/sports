import uuid
from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, JSON, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base
from database.models.enums import USER_ROLE_VALUES

from passlib.context import CryptContext
import secrets

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)

    # Account type — PLAYER | COACH | ADMIN.  Permanent; set at registration.
    # Subscription tier is stored in subscriptions.role, never here.
    role = Column(
        Enum(*USER_ROLE_VALUES, name="user_role_enum", native_enum=False),
        nullable=False,
        default="PLAYER",
        server_default="PLAYER",
    )

    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    profile_bio = Column(Text, nullable=True)
    gender = Column(String, nullable=True)
    jersey_number = Column(Integer, nullable=True)
    team = Column(String, nullable=True)

    # Coach profile fields
    certifications = Column(JSON, nullable=True)
    specialization = Column(JSON, nullable=True)
    intro_video_url = Column(String, nullable=True)
    profile_image_url = Column(String, nullable=True)
    coach_category = Column(String, nullable=True)

    # Coach verification status
    coach_status = Column(String, default='pending', nullable=True)
    coach_document_url = Column(String, nullable=True)

    # Authentication
    is_active = Column(Boolean, default=True, nullable=False, server_default="true")
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

    # Relationships
    subscriptions = relationship(
        "Subscription",
        back_populates="user",
        order_by="Subscription.started_at.desc()",
    )
    monthly_usages = relationship("MonthlyUsage", back_populates="user")
    chat_messages = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    player_profile = relationship("PlayerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")

    # ── password helpers ──────────────────────────────────────────────────────

    def set_password(self, password: str):
        self.password_hash = pwd_context.hash(password)

    def verify_password(self, password: str) -> bool:
        return pwd_context.verify(password, self.password_hash)

    # ── email verification ────────────────────────────────────────────────────

    def generate_email_verification_token(self) -> str:
        self.email_verification_token = secrets.token_urlsafe(32)
        return self.email_verification_token

    def verify_email(self):
        self.is_verified = True
        self.email_verified_at = datetime.utcnow()
        self.email_verification_token = None

    # ── password reset ────────────────────────────────────────────────────────

    def generate_password_reset_token(self) -> str:
        self.password_reset_token = secrets.token_urlsafe(32)
        self.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        return self.password_reset_token

    def reset_password(self, new_password: str):
        self.set_password(new_password)
        self.password_reset_token = None
        self.password_reset_expires = None
        self.failed_login_attempts = 0
        self.locked_until = None

    # ── login tracking ────────────────────────────────────────────────────────

    def record_login(self):
        self.last_login = datetime.utcnow()
        self.failed_login_attempts = 0
        self.locked_until = None

    def record_failed_login(self):
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= 5:
            self.locked_until = datetime.utcnow() + timedelta(minutes=30)

    def is_account_locked(self) -> bool:
        if self.locked_until and self.locked_until > datetime.utcnow():
            return True
        return False

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
