"""
Authentication Schemas for Request/Response validation
"""

from pydantic import BaseModel, EmailStr, field_validator, ConfigDict
from typing import Optional
from datetime import datetime
import uuid


UserCreate = None
UserLogin = None
Token = None
UserResponse = None


# Registration Schemas
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
        if v not in ["PLAYER", "COACH"]:
            raise ValueError("Role must be PLAYER or COACH")
        return v

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


# Login Schemas
class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


# User Profile Response
class UserProfileResponse(BaseModel):
    id: uuid.UUID
    role: str
    name: str
    email: str
    phone: Optional[str]
    profile_bio: Optional[str]
    jersey_number: Optional[int]
    team: Optional[str]
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


# Password Reset Schemas
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


# Email Verification Schema
class EmailVerificationRequest(BaseModel):
    token: str


# Refresh Token Schema
class RefreshTokenRequest(BaseModel):
    refresh_token: str


# Set aliases for backward compatibility
UserCreate = UserRegisterRequest
UserLogin = UserLoginRequest
Token = TokenResponse
UserResponse = UserProfileResponse
