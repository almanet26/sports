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
    coach_document: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    role = role.upper()
    if role not in ("PLAYER", "COACH"):
        raise HTTPException(status_code=400, detail="role must be PLAYER or COACH")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # ── coach document upload ─────────────────────────────────────────────────
    coach_document_url = None
    if coach_document and role == "COACH":
        ALLOWED = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
        ext = os.path.splitext(coach_document.filename)[1].lower()
        if ext not in ALLOWED:
            raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(sorted(ALLOWED))}")
        try:
            content = await coach_document.read()
            if len(content) > 1 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="File too large. Maximum size is 1MB.")
            storage_dir = Path("storage/coach_documents")
            storage_dir.mkdir(parents=True, exist_ok=True)
            unique_filename = f"{secrets.token_urlsafe(16)}{ext}"
            with open(storage_dir / unique_filename, "wb") as buf:
                buf.write(content)
            coach_document_url = f"coach_documents/{unique_filename}"
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Coach document upload failed: %s", exc)
            raise HTTPException(status_code=500, detail="Failed to upload document. Please try again.")
        finally:
            await coach_document.close()

    # ── create user ───────────────────────────────────────────────────────────
    new_user = User(
        email=email,
        password_hash=get_password_hash(password),
        name=name,
        role=role,                  # permanent account type: PLAYER | COACH
        phone=phone,
        team=team,
        coach_document_url=coach_document_url,
        coach_status="pending" if role == "COACH" else None,
    )
    db.add(new_user)
    db.flush()  # get new_user.id without committing

    # ── seed subscription in the same transaction ─────────────────────────────
    _seed_subscription(new_user.id, role, db)
    db.commit()
    db.refresh(new_user)

    logger.info("New user registered: %s (ID: %s, role: %s)", new_user.email, new_user.id, role)

    sub = _get_active_sub(new_user.id, db)
    return _build_profile_response(new_user, sub)


# ── Login ──────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.role == "COACH" and user.coach_status == "pending":
        raise HTTPException(
            status_code=403,
            detail="Your account is pending verification. Please wait until Admin reviews your documents.",
        )
    if user.role == "COACH" and user.coach_status == "rejected":
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
    }


# ── /me ────────────────────────────────────────────────────────────────────────

def _build_profile_response(user: User, sub: Optional[Subscription]) -> dict:
    """Merge user row with active subscription for /me and /register responses."""
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
        "is_verified": user.is_verified,
        "created_at": user.created_at,
        "last_login": user.last_login,
        "subscription_role": (
            sub.role
            if sub
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
