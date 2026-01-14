"""
Authentication API routes.
"""

from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import logging
import secrets

from database.config import get_db
from database.models.user import User
from database.models.session import UserSession
from schemas.auth import UserCreate, UserLogin, Token, UserResponse, TokenResponse
from utils.auth import (
    create_refresh_token,
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)
from utils.config import settings

router = APIRouter(prefix="/auth", tags=["authentication"])
logger = logging.getLogger(__name__)


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        name=user_data.full_name,  # User model has 'name' field
        role=user_data.role,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"New user registered: {new_user.email} (ID: {new_user.id})")

    return new_user


@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    # Find user
    user = db.query(User).filter(User.email == login_data.email).first()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last_login timestamp
    user.last_login = datetime.utcnow()
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )

    # Create refresh token
    refresh_token = create_refresh_token(
        data = {"sub": user.email}
    )
    
    # Create session record
    session = UserSession(
        user_id=user.id,
        refresh_token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    db.add(session)
    db.commit()

    logger.info(f"User logged in: {user.email} (ID: {user.id})")

    # Return token with user profile
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": int(access_token_expires.total_seconds()),
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.name,  # User model has 'name' field
            "role": user.role,
        },
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    # Delete all active sessions for this user
    db.query(UserSession).filter(UserSession.user_id == current_user.id).delete()
    db.commit()

    logger.info(f"User logged out: {current_user.email} (ID: {current_user.id})")

    return None


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user(
    full_name: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if full_name:
        current_user.full_name = full_name
        db.commit()
        db.refresh(current_user)
        logger.info(f"User profile updated: {current_user.email}")

    return current_user
