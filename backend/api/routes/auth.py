"""
Authentication API routes — login, logout, registration, token management, password.
"""

from datetime import timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
import logging
import secrets
import os
from pathlib import Path

from database.config import get_db
from database.models.user import User
from database.models.session import UserSession
from schemas.auth import UserLogin, UserResponse, TokenResponse, ProfileUpdateRequest, IntroVideoResponse
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


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form(...),
    phone: str = Form(None),
    team: str = Form(None),
    coach_document: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    coach_document_url = None
    if coach_document and role == "COACH":
        ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
        file_extension = os.path.splitext(coach_document.filename)[1].lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
            )
        MAX_FILE_SIZE = 10 * 1024 * 1024
        try:
            content = await coach_document.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large. Maximum size is 10MB.")
            storage_dir = Path("storage/coach_documents")
            storage_dir.mkdir(parents=True, exist_ok=True)
            unique_filename = f"{secrets.token_urlsafe(16)}{file_extension}"
            with open(storage_dir / unique_filename, "wb") as buffer:
                buffer.write(content)
            coach_document_url = f"coach_documents/{unique_filename}"
            logger.info(f"Coach document uploaded: {coach_document_url}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Coach document upload failed: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to upload document. Please try again.")
        finally:
            await coach_document.close()

    new_user = User(
        email=email,
        password_hash=get_password_hash(password),
        name=name,
        role=role,
        phone=phone,
        team=team,
        coach_document_url=coach_document_url,
        coach_status="pending" if role == "COACH" and coach_document_url else ("incomplete" if role == "COACH" else None),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(f"New user registered: {new_user.email} (ID: {new_user.id}, Role: {role})")
    return new_user


@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account has been suspended. Please contact support.")

    if user.role == "COACH" and user.coach_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending verification. Please wait until the Admin reviews your documents.",
        )

    if user.role == "COACH" and user.coach_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your coach application has been rejected. Please contact support for more information.",
        )

    user.last_login = datetime.utcnow()
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires)
    refresh_token = create_refresh_token(data={"sub": user.email})

    db.add(UserSession(
        user_id=user.id,
        refresh_token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=30),
    ))
    db.commit()
    logger.info(f"User logged in: {user.email} (ID: {user.id})")

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


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_email = current_user.email
    user_id = current_user.id
    try:
        db.query(UserSession).filter(UserSession.user_id == user_id).delete()
        db.commit()
        logger.info(f"User logged out: {user_email} (ID: {user_id})")
    except Exception as e:
        db.rollback()
        logger.error(f"Logout error for user {user_id}: {e}")
    return None


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user(
    update_data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from api.routes.notification import create_notification

    for field, value in update_data.model_dump(exclude_unset=True).items():
        if hasattr(current_user, field):
            setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    logger.info(f"User profile updated: {current_user.email}")

    create_notification(
        db=db,
        user_id=current_user.id,
        title="Profile Updated",
        message="Your profile information has been successfully updated.",
        notif_type="system",
    )
    return current_user


@router.post("/forgot-password", status_code=201)
def forgot_password(data: dict, db: Session = Depends(get_db)):
    from database.models.password_reset_request import PasswordResetRequest

    email = data.get("email", "").strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"ok": True, "message": "If this email exists, your request has been submitted."}

    existing = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.user_id == user.id,
        PasswordResetRequest.is_resolved == False,
    ).first()
    if existing:
        return {"ok": True, "message": "A request is already pending. Please wait for admin to respond."}

    db.add(PasswordResetRequest(
        user_id=user.id,
        email=user.email,
        name=user.name,
        message=data.get("message", ""),
    ))
    db.commit()
    return {"ok": True, "message": "Request submitted. Admin will reset your password shortly."}


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from api.routes.notification import create_notification

    if not verify_password(data.get("current_password", ""), current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    new_password = data.get("new_password", "")
    if len(new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")

    current_user.password_hash = get_password_hash(new_password)
    db.commit()
    create_notification(
        db=db,
        user_id=current_user.id,
        title="Password Changed",
        message="Your password was successfully changed. If you didn't make this change, please contact support immediately.",
        notif_type="system",
    )
    logger.info(f"Password changed for user: {current_user.email}")
    return None


@router.post("/coach-intro-video", response_model=IntroVideoResponse)
async def upload_intro_video(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload or replace coach intro video — streams to GCS, falls back to local disk in dev."""
    if current_user.role != "COACH":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only coaches can upload intro videos")

    ALLOWED_VIDEO = {".mp4", ".mov", ".avi", ".webm", ".mkv"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_VIDEO:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid video format. Allowed: mp4, mov, avi, webm, mkv")

    unique_filename = f"{secrets.token_urlsafe(16)}{ext}"
    try:
        gcs_bucket = os.getenv("GCS_BUCKET_NAME", "")
        if gcs_bucket:
            import google.cloud.storage as gcs_lib
            blob = gcs_lib.Client().bucket(gcs_bucket).blob(f"coach_intro_videos/{unique_filename}")
            CHUNK = 256 * 1024
            with blob.open("wb", content_type=file.content_type or "video/mp4") as gcs_stream:
                while True:
                    chunk = await file.read(CHUNK)
                    if not chunk:
                        break
                    gcs_stream.write(chunk)
            intro_video_url = f"https://storage.googleapis.com/{gcs_bucket}/coach_intro_videos/{unique_filename}"
        else:
            storage_dir = Path("storage/coach_intro_videos")
            storage_dir.mkdir(parents=True, exist_ok=True)
            file_path = storage_dir / unique_filename
            CHUNK = 256 * 1024
            MAX_SIZE = 100 * 1024 * 1024
            written = 0
            with open(file_path, "wb") as buf:
                while True:
                    chunk = await file.read(CHUNK)
                    if not chunk:
                        break
                    written += len(chunk)
                    if written > MAX_SIZE:
                        file_path.unlink(missing_ok=True)
                        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large. Max 100MB.")
                    buf.write(chunk)
            intro_video_url = f"/static/coach_intro_videos/{unique_filename}"

        current_user.intro_video_url = intro_video_url
        db.commit()
        db.refresh(current_user)
        logger.info(f"Intro video uploaded for coach: {current_user.email} -> {intro_video_url}")
        return IntroVideoResponse(intro_video_url=intro_video_url)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Intro video upload failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Upload failed. Please try again.")
    finally:
        await file.close()
