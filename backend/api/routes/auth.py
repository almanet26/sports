"""Authentication API routes."""

from datetime import timedelta, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
import logging
import secrets
import os
from pathlib import Path

from database.config import get_db
from database.models.subscription import Subscription
from database.models.user import User
from database.models.session import UserSession
from schemas.auth import UserCreate, UserLogin, Token, UserResponse, TokenResponse, ProfileUpdateRequest
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

_FREE_EXPIRES_DAYS = 36500  # ~100 years — effectively never for the free tier


def _seed_subscription(user_id: str, account_type: str, db: Session) -> Subscription:
    """Insert the initial free (or academy for ADMIN) subscription row."""
    now = datetime.now(timezone.utc)
    if account_type == "ADMIN":
        tier = "academy"
        plan_key = "academy_365d"
    elif account_type == "COACH":
        tier = "coach_free"
        plan_key = "coach_free"
    else:
        tier = "free"
        plan_key = "free"
    sub = Subscription(
        user_id=user_id,
        plan_key=plan_key,
        role=tier,
        status="active",
        started_at=now,
        expires_at=now + timedelta(days=_FREE_EXPIRES_DAYS),
    )
    db.add(sub)
    return sub


def _get_active_sub(user_id: str, db: Session) -> Optional[Subscription]:
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.status == "active")
        .order_by(Subscription.started_at.desc())
        .first()
    )


# ── Registration ───────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form(...),          # PLAYER | COACH
    phone: str = Form(None),
    team: str = Form(None),
    db: Session = Depends(get_db),
):
    role = role.upper()
    if role not in ("PLAYER", "COACH"):
        raise HTTPException(status_code=400, detail="role must be PLAYER or COACH")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=email,
        password_hash=get_password_hash(password),
        name=name,
        role=role,
        phone=phone,
        team=team,
        coach_status='incomplete' if role == 'COACH' else None,
    )
    db.add(new_user)
    db.flush()

    _seed_subscription(new_user.id, role, db)
    db.commit()
    db.refresh(new_user)

    logger.info("New user registered: %s (ID: %s, role: %s)", new_user.email, new_user.id, role)

    sub = _get_active_sub(new_user.id, db)
    return _build_profile_response(new_user, sub)



@router.post("/coach-profile", response_model=UserResponse)
async def complete_coach_profile(
    phone: str = Form(None),
    team: str = Form(None),
    profile_bio: str = Form(None),
    specialization: str = Form(None),
    coach_category: str = Form(None),
    coach_document: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != 'COACH':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only coaches can use this endpoint")
    if current_user.coach_status not in ('incomplete',):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Profile already submitted for review")

    ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'}
    file_extension = os.path.splitext(coach_document.filename)[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    MAX_DOC_SIZE = 5 * 1024 * 1024  # 5MB limit for documents
    try:
        content = await coach_document.read()
        if len(content) > MAX_DOC_SIZE:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large. Maximum size is 5MB.")

        import base64
        encoded = base64.b64encode(content).decode('utf-8')
        mime = coach_document.content_type or 'application/octet-stream'
        coach_document_url = f"data:{mime};base64,{encoded}"
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Coach document upload failed: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to upload document. Please try again.")
    finally:
        await coach_document.close()

    if phone: current_user.phone = phone
    if team: current_user.team = team
    if profile_bio: current_user.profile_bio = profile_bio
    if specialization:
        import json
        try:
            current_user.specialization = json.loads(specialization)
        except Exception:
            current_user.specialization = [specialization]
    if coach_category: current_user.coach_category = coach_category
    current_user.coach_document_url = coach_document_url
    current_user.coach_status = 'pending'
    db.commit()
    db.refresh(current_user)
    logger.info("Coach profile completed: %s, status -> pending", current_user.email)
    sub = _get_active_sub(current_user.id, db)
    return _build_profile_response(current_user, sub)


@router.post("/coach-intro-video")
async def upload_intro_video(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != 'COACH':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only coaches can upload intro videos")
    ALLOWED_VIDEO = {'.mp4', '.mov', '.avi', '.webm', '.mkv'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_VIDEO:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid video format")
    try:
        content = await file.read()
        if len(content) > 100 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large. Max 100MB.")
        storage_dir = Path("storage/coach_intro_videos")
        storage_dir.mkdir(parents=True, exist_ok=True)
        unique_filename = f"{secrets.token_urlsafe(16)}{ext}"
        with open(storage_dir / unique_filename, "wb") as buf:
            buf.write(content)
        current_user.intro_video_url = f"/static/coach_intro_videos/{unique_filename}"
        db.commit()
        db.refresh(current_user)
        return {"intro_video_url": current_user.intro_video_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Intro video upload failed: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Upload failed")
    finally:
        await file.close()


@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.role == 'COACH' and user.coach_status == 'rejected':
        raise HTTPException(
            status_code=403,
            detail="Your coach application has been rejected. Please contact support.",
        )

    # Pull active subscription so we can embed tier into the JWT
    sub = _get_active_sub(user.id, db)
    if sub:
        sub_role = sub.role
    elif user.role == "COACH":
        sub_role = "coach_free"
    elif user.role == "ADMIN":
        sub_role = "academy"
    else:
        sub_role = "free"
    sub_status = sub.status if sub else "inactive"

    user.last_login = datetime.now(timezone.utc)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": user.id,
            "role": user.role,                  # account type: PLAYER | COACH | ADMIN
            "subscription_role": sub_role,      # tier: free | basic | platinum …
            "subscription_status": sub_status,
        },
        expires_delta=access_token_expires,
    )
    refresh_token = create_refresh_token(data={"sub": user.email})

    db.add(UserSession(
        user_id=user.id,
        refresh_token=refresh_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    ))
    db.commit()

    logger.info("User logged in: %s (ID: %s)", user.email, user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": int(access_token_expires.total_seconds()),
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.name,
            "role": user.role,
            "team": user.team,
            "jersey_number": user.jersey_number,
            "coach_status": user.coach_status,
        },
    }


# ── /me ────────────────────────────────────────────────────────────────────────

def _build_profile_response(user: User, sub: Optional[Subscription]) -> dict:
    return {
        "id": user.id,
        "account_type": user.role,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "profile_bio": user.profile_bio,
        "gender": user.gender,
        "jersey_number": user.jersey_number,
        "team": user.team,
        "certifications": user.certifications,
        "specialization": user.specialization,
        "intro_video_url": user.intro_video_url,
        "profile_image_url": user.profile_image_url,
        "coach_category": user.coach_category,
        "coach_status": user.coach_status,
        "is_verified": user.is_verified,
        "created_at": user.created_at,
        "last_login": user.last_login,
        "subscription_role": (
            sub.role if sub
            else ("coach_free" if user.role == "COACH" else ("academy" if user.role == "ADMIN" else "free"))
        ),
        "subscription_status": sub.status if sub else "inactive",
        "subscription_expires_at": sub.expires_at if sub else None,
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_sub(current_user.id, db)
    return _build_profile_response(current_user, sub)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    try:
        db.query(UserSession).filter(UserSession.user_id == user_id).delete()
        db.commit()
        logger.info("User logged out: %s (ID: %s)", current_user.email, user_id)
    except Exception as exc:
        db.rollback()
        logger.error("Logout error for user %s: %s", user_id, exc)
    return None


@router.put("/me", response_model=UserResponse)
def update_current_user(
    update_data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in update_data.model_dump(exclude_unset=True).items():
        if hasattr(current_user, field):
            setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    logger.info("User profile updated: %s", current_user.email)
    sub = _get_active_sub(current_user.id, db)
    return _build_profile_response(current_user, sub)
