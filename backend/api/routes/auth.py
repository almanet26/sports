"""
Authentication API routes.
"""

from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import logging
import secrets
import os
from pathlib import Path

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
async def register(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form(...),
    phone: str = Form(None),
    team: str = Form(None),
    document: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Handle document upload for coaches
    document_path = None
    if role == "COACH" and document:
        upload_dir = Path("storage/coach_documents")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        file_ext = os.path.splitext(document.filename)[1]
        filename = f"{secrets.token_urlsafe(16)}{file_ext}"
        file_path = upload_dir / filename
        
        with open(file_path, "wb") as f:
            content = await document.read()
            f.write(content)
        
        document_path = str(file_path)

    # Create new user
    hashed_password = get_password_hash(password)
    new_user = User(
        email=email,
        password_hash=hashed_password,
        name=name,
        role=role,
        phone=phone,
        team=team,
        coach_document_path=document_path,
        coach_verification_status="PENDING" if role == "COACH" else None
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
    
    # Check if coach is verified
    if user.role == "COACH" and user.coach_verification_status != "APPROVED":
        if user.coach_verification_status == "PENDING":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your coach account is pending admin approval. Please wait for verification."
            )
        elif user.coach_verification_status == "REJECTED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your coach account has been rejected. Please contact support."
            )

    # Update last_login timestamp
    user.last_login = datetime.utcnow()

    # Create access token
    access_token_expires = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    # Create access token
    access_token_expires = timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )

    # Create refresh token
    refresh_token = create_refresh_token(
        data={"sub": user.email}
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
            "team": user.team,
            "jersey_number": user.jersey_number,
        },
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    # Delete all active sessions for this user
    db.query(UserSession).filter(
        UserSession.user_id == current_user.id).delete()
    db.commit()

    logger.info(
        f"User logged out: {current_user.email} (ID: {current_user.id})")

    return None


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user(
    name: str | None = None,
    team: str | None = None,
    jersey_number: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if name is not None:
        current_user.name = name
    if team is not None:
        current_user.team = team
    if jersey_number is not None:
        current_user.jersey_number = jersey_number

    db.commit()
    db.refresh(current_user)
    logger.info(f"User profile updated: {current_user.email}")

    return current_user
