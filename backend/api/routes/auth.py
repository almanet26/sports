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
from schemas.auth import UserCreate, UserLogin, Token, UserResponse, TokenResponse, ProfileUpdateRequest, IntroVideoResponse
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
    db: Session = Depends(get_db)
):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create new user — coaches start as 'incomplete' until they complete their profile
    hashed_password = get_password_hash(password)
    new_user = User(
        email=email,
        password_hash=hashed_password,
        name=name,
        role=role,
        phone=phone,
        team=team,
        coach_status='incomplete' if role == 'COACH' else None,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"New user registered: {new_user.email} (ID: {new_user.id}, Role: {role})")

    return new_user


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
    """Coach completes their profile and uploads verification document after first login."""
    if current_user.role != 'COACH':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only coaches can use this endpoint")

    if current_user.coach_status not in ('incomplete',):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Profile already submitted for review")

    # Validate and save document
    ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'}
    file_extension = os.path.splitext(coach_document.filename)[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    MAX_FILE_SIZE = 10 * 1024 * 1024
    try:
        content = await coach_document.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large. Maximum size is 10MB.")

        storage_dir = Path("storage/coach_documents")
        storage_dir.mkdir(parents=True, exist_ok=True)
        unique_filename = f"{secrets.token_urlsafe(16)}{file_extension}"
        file_path = storage_dir / unique_filename
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        coach_document_url = f"coach_documents/{unique_filename}"
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Coach document upload failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to upload document. Please try again.")
    finally:
        await coach_document.close()

    # Update profile fields
    if phone:
        current_user.phone = phone
    if team:
        current_user.team = team
    if profile_bio:
        current_user.profile_bio = profile_bio
    if specialization:
        import json
        try:
            current_user.specialization = json.loads(specialization)
        except Exception:
            current_user.specialization = [specialization]
    if coach_category:
        current_user.coach_category = coach_category

    current_user.coach_document_url = coach_document_url
    current_user.coach_status = 'pending'

    db.commit()
    db.refresh(current_user)
    logger.info(f"Coach profile completed: {current_user.email}, status -> pending")

    return current_user


@router.post("/profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload or replace profile image for any user."""
    ALLOWED_IMAGE = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image format. Allowed: jpg, jpeg, png, webp, gif")

    MAX_SIZE = 5 * 1024 * 1024  # 5MB
    try:
        content = await file.read()
        if len(content) > MAX_SIZE:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large. Max 5MB.")

        gcs_bucket = os.getenv("GCS_BUCKET_NAME", "")
        if gcs_bucket:
            import google.cloud.storage as gcs_lib
            unique_filename = f"{secrets.token_urlsafe(16)}{ext}"
            gcs_client = gcs_lib.Client()
            bucket = gcs_client.bucket(gcs_bucket)
            blob = bucket.blob(f"profile_images/{unique_filename}")
            blob.upload_from_string(content, content_type=file.content_type or "image/jpeg")
            profile_image_url = f"https://storage.googleapis.com/{gcs_bucket}/profile_images/{unique_filename}"
        else:
            storage_dir = Path("storage/profile_images")
            storage_dir.mkdir(parents=True, exist_ok=True)
            unique_filename = f"{secrets.token_urlsafe(16)}{ext}"
            file_path = storage_dir / unique_filename
            with open(file_path, "wb") as buf:
                buf.write(content)
            profile_image_url = f"/static/profile_images/{unique_filename}"

        current_user.profile_image_url = profile_image_url
        db.commit()
        db.refresh(current_user)
        logger.info(f"Profile image uploaded for user: {current_user.email}")
        return {"profile_image_url": profile_image_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profile image upload failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Upload failed. Please try again.")
    finally:
        await file.close()


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

    # Check if coach was rejected
    if user.role == 'COACH' and user.coach_status == 'rejected':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your coach application has been rejected. Please contact support for more information.",
        )

    # Update last_login timestamp
    user.last_login = datetime.utcnow()

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
def logout(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    user_email = current_user.email
    user_id = current_user.id

    try:
        db.query(UserSession).filter(
            UserSession.user_id == user_id).delete()
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
    
    update_dict = update_data.model_dump(exclude_unset=True)

    for field, value in update_dict.items():
        if hasattr(current_user, field):
            setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    logger.info(f"User profile updated: {current_user.email}")
    
    # Create notification
    create_notification(
        db=db,
        user_id=current_user.id,
        title="Profile Updated",
        message="Your profile information has been successfully updated.",
        notif_type="system"
    )

    return current_user


@router.post("/forgot-password", status_code=201)
def forgot_password(
    data: dict,
    db: Session = Depends(get_db),
):
    """User submits a password reset request to admin."""
    from database.models.password_reset_request import PasswordResetRequest
    email = data.get("email", "").strip()
    message = data.get("message", "")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Don't reveal if email exists
        return {"ok": True, "message": "If this email exists, your request has been submitted."}

    # Check no pending request already
    existing = db.query(PasswordResetRequest).filter(
        PasswordResetRequest.user_id == user.id,
        PasswordResetRequest.is_resolved == False
    ).first()
    if existing:
        return {"ok": True, "message": "A request is already pending. Please wait for admin to respond."}

    req = PasswordResetRequest(
        user_id=user.id,
        email=user.email,
        name=user.name,
        message=message,
    )
    db.add(req)
    db.commit()
    return {"ok": True, "message": "Request submitted. Admin will reset your password shortly."}


@router.get("/coaches/public")
def get_public_coaches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all verified coaches with their public profile info including intro video."""
    coaches = (
        db.query(User)
        .filter(User.role == "COACH", User.coach_status == "verified", User.is_active == True)
        .all()
    )
    return {
        "coaches": [
            {
                "id": c.id,
                "name": c.name,
                "profile_bio": c.profile_bio,
                "specialization": c.specialization,
                "intro_video_url": c.intro_video_url,
                "profile_image_url": c.profile_image_url,
                "coach_category": c.coach_category,
                "years_of_experience": c.years_of_experience,
            }
            for c in coaches
        ]
    }


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from utils.auth import verify_password, get_password_hash
    from api.routes.notification import create_notification
    
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")

    current_user.password_hash = get_password_hash(new_password)
    db.commit()
    
    # Create notification
    create_notification(
        db=db,
        user_id=current_user.id,
        title="Password Changed",
        message="Your password was successfully changed. If you didn't make this change, please contact support immediately.",
        notif_type="system"
    )
    
    logger.info(f"Password changed for user: {current_user.email}")
    return None


@router.get("/notifications")
def get_notification_preferences(
    current_user: User = Depends(get_current_user),
):
    default = {"email_submissions": True, "email_published": True, "email_messages": False, "push_all": True}
    return current_user.notification_preferences or default


@router.put("/notifications")
def update_notification_preferences(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.notification_preferences = data
    db.commit()
    db.refresh(current_user)
    return current_user.notification_preferences


@router.post("/coach-intro-video", response_model=IntroVideoResponse)
async def upload_intro_video(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload or replace coach intro video — streams directly to GCS, falls back to local disk in dev."""
    if current_user.role != 'COACH':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only coaches can upload intro videos")

    ALLOWED_VIDEO = {'.mp4', '.mov', '.avi', '.webm', '.mkv'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_VIDEO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video format. Allowed: mp4, mov, avi, webm, mkv"
        )

    unique_filename = f"{secrets.token_urlsafe(16)}{ext}"

    try:
        gcs_bucket = os.getenv("GCS_BUCKET_NAME", "")

        if gcs_bucket:
            # Stream directly to GCS — never loads full file into RAM
            import google.cloud.storage as gcs_lib
            gcs_client = gcs_lib.Client()
            bucket = gcs_client.bucket(gcs_bucket)
            blob = bucket.blob(f"coach_intro_videos/{unique_filename}")

            CHUNK = 256 * 1024  # 256 KB chunks
            with blob.open("wb", content_type=file.content_type or "video/mp4") as gcs_stream:
                while True:
                    chunk = await file.read(CHUNK)
                    if not chunk:
                        break
                    gcs_stream.write(chunk)

            intro_video_url = f"https://storage.googleapis.com/{gcs_bucket}/coach_intro_videos/{unique_filename}"
        else:
            # Local dev fallback — stream to disk in chunks (no full RAM load)
            storage_dir = Path("storage/coach_intro_videos")
            storage_dir.mkdir(parents=True, exist_ok=True)
            file_path = storage_dir / unique_filename

            CHUNK = 256 * 1024  # 256 KB chunks
            MAX_SIZE = 100 * 1024 * 1024  # 100 MB
            written = 0
            with open(file_path, "wb") as buf:
                while True:
                    chunk = await file.read(CHUNK)
                    if not chunk:
                        break
                    written += len(chunk)
                    if written > MAX_SIZE:
                        buf.close()
                        file_path.unlink(missing_ok=True)
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail="File too large. Max 100MB."
                        )
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
