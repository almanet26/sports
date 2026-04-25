"""Authentication Schemas for Request/Response validation."""

from pydantic import BaseModel, EmailStr, field_validator, ConfigDict
from typing import Optional
from datetime import datetime
import uuid


# ── Registration ───────────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # PLAYER or COACH
    phone: Optional[str] = None
    jersey_number: Optional[int] = None
    team: Optional[str] = None
    profile_bio: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v.upper() not in ("PLAYER", "COACH"):
            raise ValueError("role must be PLAYER or COACH")
        return v.upper()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


# ── Login ──────────────────────────────────────────────────────────────────────

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Tokens ─────────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ── Profile ────────────────────────────────────────────────────────────────────

class UserProfileResponse(BaseModel):
    """Response model for GET /auth/me.

    `account_type` is the permanent account type (PLAYER | COACH | ADMIN).
    `subscription_role` and `subscription_status` are denormalised from the
    active subscriptions row so the frontend does not need a second round-trip.
    They may be None when no subscription row exists (new free account that
    hasn't had its seed row written yet — shouldn't happen in practice).
    """
    id: uuid.UUID
    account_type: str                   # account type: PLAYER | COACH | ADMIN
    name: str
    email: str
    phone: Optional[str] = None
    profile_bio: Optional[str] = None
    gender: Optional[str] = None
    jersey_number: Optional[int] = None
    team: Optional[str] = None
    certifications: Optional[list] = None
    specialization: Optional[list] = None
    intro_video_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    coach_category: Optional[str] = None
    coach_status: Optional[str] = None
    date_of_birth: Optional[str] = None
    years_of_experience: Optional[int] = None
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    # Subscription denorm — pulled from subscriptions table in the endpoint
    subscription_role: Optional[str] = None    # e.g. "free" | "basic" | "platinum" …
    subscription_status: Optional[str] = None  # e.g. "active" | "expired"
    subscription_expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    profile_bio: Optional[str] = None
    gender: Optional[str] = None
    jersey_number: Optional[int] = None
    team: Optional[str] = None
    certifications: Optional[list] = None
    specialization: Optional[list] = None
    intro_video_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    coach_category: Optional[str] = None
    date_of_birth: Optional[str] = None
    years_of_experience: Optional[int] = None
    notification_preferences: Optional[dict] = None

    model_config = ConfigDict(extra="ignore")


# ── Password reset ─────────────────────────────────────────────────────────────

class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class EmailVerificationRequest(BaseModel):
    token: str


# ── Backward-compat aliases ────────────────────────────────────────────────────
UserCreate  = UserRegisterRequest
UserLogin   = UserLoginRequest
Token       = TokenResponse
UserResponse = UserProfileResponse
