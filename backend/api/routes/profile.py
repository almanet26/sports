"""
Player Profile & Scouting Visibility.

POST  /profile/setup              create or update own profile (PLAYER only)
PATCH /profile/scouting           toggle scouting visibility (Platinum+, PLAYER)
GET   /profile/{user_id}/public   read public profile (only if scouting_visible=true)
POST  /profile/image              upload/replace profile image (any user)
POST  /profile/coach-complete     coach completes profile + uploads verification doc
GET   /profile/coaches/public     list all verified coaches (discovery)
"""

from __future__ import annotations

import json
import logging
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.batting import BattingAnalysis
from database.models.bowling import BowlingAnalysis
from database.models.player_profile import PlayerProfile
from database.models.user import User
from dependencies.feature_gate import require_feature
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["profile"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PlayerProfileSetup(BaseModel):
    display_name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    bat_style: Optional[str] = None
    bowl_style: Optional[str] = None
    age: Optional[int] = None
    cricket_role: Optional[Literal["batsman", "bowler", "all_rounder", "wicket_keeper"]] = None
    experience_level: Optional[Literal["beginner", "intermediate", "advanced", "professional"]] = None
    preferred_format: Optional[Literal["T20", "ODI", "Test", "All"]] = None
    profile_image_url: Optional[str] = None


class ScoutingPatchRequest(BaseModel):
    scouting_visible: bool


class StatsResponse(BaseModel):
    avg_bat_speed: Optional[float]
    peak_bat_speed: Optional[float]
    avg_wrist_speed: Optional[float]
    avg_release_height: Optional[float]
    best_front_knee_angle: Optional[float]
    best_shoulder_rotation: Optional[float]
    best_elbow_angle: Optional[float]
    best_release_consistency: Optional[float]


class ProfileResponse(BaseModel):
    user_id: str
    display_name: Optional[str]
    city: Optional[str]
    state: Optional[str]
    bat_style: Optional[str]
    bowl_style: Optional[str]
    age: Optional[int]
    cricket_role: Optional[str]
    experience_level: Optional[str]
    preferred_format: Optional[str]
    profile_image_url: Optional[str]
    scouting_visible: bool
    total_analyses: Optional[int]
    analyses_last_updated: Optional[datetime]
    updated_at: datetime
    stats: StatsResponse


class PublicProfileResponse(BaseModel):
    user_id: str
    display_name: Optional[str]
    city: Optional[str]
    state: Optional[str]
    bat_style: Optional[str]
    bowl_style: Optional[str]
    age: Optional[int]
    cricket_role: Optional[str]
    experience_level: Optional[str]
    preferred_format: Optional[str]
    profile_image_url: Optional[str]
    total_analyses: Optional[int]
    analyses_last_updated: Optional[datetime]
    stats: StatsResponse


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/setup", response_model=ProfileResponse)
def setup_profile(
    body: PlayerProfileSetup,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if profile is None:
        profile = PlayerProfile(user_id=current_user.id)
        db.add(profile)

    for field in ("display_name", "city", "state", "bat_style", "bowl_style", "age",
                  "cricket_role", "experience_level", "preferred_format", "profile_image_url"):
        val = getattr(body, field)
        if val is not None:
            setattr(profile, field, val)

    db.commit()
    db.refresh(profile)
    return _to_response(profile)


@router.patch("/scouting")
def toggle_scouting(
    body: ScoutingPatchRequest,
    current_user: User = Depends(require_feature("scouting_visibility")),
    db: Session = Depends(get_db),
):
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found. Call POST /profile/setup first.")

    if body.scouting_visible:
        missing: List[str] = []
        if not profile.display_name:
            missing.append("display_name")
        if not profile.cricket_role:
            missing.append("cricket_role")
        if missing:
            raise HTTPException(status_code=400, detail={
                "error": "profile_incomplete",
                "missing": missing,
                "message": "Complete your profile before enabling scouting visibility.",
            })

    profile.scouting_visible = body.scouting_visible
    db.commit()
    db.refresh(profile)
    return {
        "scouting_visible": profile.scouting_visible,
        "message": (
            "Your profile is now visible to coaches in the scouting directory."
            if profile.scouting_visible else "Your profile is now private."
        ),
    }


@router.get("/coaches/public")
def get_public_coaches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all verified coaches for player discovery."""
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


@router.post("/image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload or replace profile image for any user — GCS or local fallback."""
    ALLOWED_IMAGE = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE:
        raise HTTPException(status_code=400, detail="Invalid image format. Allowed: jpg, jpeg, png, webp, gif")

    MAX_SIZE = 5 * 1024 * 1024
    try:
        content = await file.read()
        if len(content) > MAX_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Max 5MB.")

        gcs_bucket = os.getenv("GCS_BUCKET_NAME", "")
        unique_filename = f"{secrets.token_urlsafe(16)}{ext}"
        if gcs_bucket:
            import google.cloud.storage as gcs_lib
            blob = gcs_lib.Client().bucket(gcs_bucket).blob(f"profile_images/{unique_filename}")
            blob.upload_from_string(content, content_type=file.content_type or "image/jpeg")
            profile_image_url = f"https://storage.googleapis.com/{gcs_bucket}/profile_images/{unique_filename}"
        else:
            storage_dir = Path("storage/profile_images")
            storage_dir.mkdir(parents=True, exist_ok=True)
            (storage_dir / unique_filename).write_bytes(content)
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
        raise HTTPException(status_code=500, detail="Upload failed. Please try again.")
    finally:
        await file.close()


@router.post("/coach-complete")
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
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can use this endpoint")
    if current_user.coach_status != "incomplete":
        raise HTTPException(status_code=400, detail="Profile already submitted for review")

    ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
    file_extension = os.path.splitext(coach_document.filename)[1].lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    MAX_FILE_SIZE = 10 * 1024 * 1024
    try:
        content = await coach_document.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")
        storage_dir = Path("storage/coach_documents")
        storage_dir.mkdir(parents=True, exist_ok=True)
        unique_filename = f"{secrets.token_urlsafe(16)}{file_extension}"
        (storage_dir / unique_filename).write_bytes(content)
        coach_document_url = f"coach_documents/{unique_filename}"
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Coach document upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload document. Please try again.")
    finally:
        await coach_document.close()

    if phone:
        current_user.phone = phone
    if team:
        current_user.team = team
    if profile_bio:
        current_user.profile_bio = profile_bio
    if specialization:
        try:
            current_user.specialization = json.loads(specialization)
        except Exception:
            current_user.specialization = [specialization]
    if coach_category:
        current_user.coach_category = coach_category

    current_user.coach_document_url = coach_document_url
    current_user.coach_status = "pending"
    db.commit()
    db.refresh(current_user)
    logger.info(f"Coach profile completed: {current_user.email}, status -> pending")
    return current_user


@router.get("/{user_id}/public", response_model=PublicProfileResponse)
def get_public_profile(
    user_id: str,
    db: Session = Depends(get_db),
) -> PublicProfileResponse:
    profile = (
        db.query(PlayerProfile)
        .filter(PlayerProfile.user_id == user_id, PlayerProfile.scouting_visible.is_(True))
        .first()
    )
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _to_public_response(profile)


# ---------------------------------------------------------------------------
# Worker helper
# ---------------------------------------------------------------------------

def update_player_scouting_stats(user_id: str, db: Session) -> None:
    try:
        bat_row = db.query(
            func.avg(BattingAnalysis.avg_front_knee_angle).label("avg_knee"),
            func.max(BattingAnalysis.avg_front_knee_angle).label("best_knee"),
            func.avg(BattingAnalysis.avg_shoulder_rotation).label("avg_shoulder"),
            func.max(BattingAnalysis.avg_shoulder_rotation).label("best_shoulder"),
            func.avg(BattingAnalysis.avg_backlift_height).label("avg_backlift"),
            func.count(BattingAnalysis.id).label("bat_count"),
        ).filter(BattingAnalysis.player_id == user_id).one()

        bowl_row = db.query(
            func.avg(BowlingAnalysis.avg_elbow_angle).label("avg_elbow"),
            func.max(BowlingAnalysis.avg_elbow_angle).label("best_elbow"),
            func.avg(BowlingAnalysis.release_consistency).label("avg_consistency"),
            func.max(BowlingAnalysis.release_consistency).label("best_consistency"),
            func.avg(BowlingAnalysis.avg_release_height).label("avg_release_height"),
            func.count(BowlingAnalysis.id).label("bowl_count"),
        ).filter(BowlingAnalysis.player_id == user_id).one()

        total_analyses = (bat_row.bat_count or 0) + (bowl_row.bowl_count or 0)

        profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == user_id).first()
        if profile is None:
            profile = PlayerProfile(user_id=user_id)
            db.add(profile)

        profile.best_front_knee_angle = bat_row.best_knee
        profile.best_shoulder_rotation = bat_row.best_shoulder
        profile.avg_wrist_speed = bat_row.avg_backlift
        profile.best_elbow_angle = bowl_row.best_elbow
        profile.best_release_consistency = bowl_row.best_consistency
        profile.avg_release_height = bowl_row.avg_release_height
        profile.total_analyses = total_analyses
        profile.analyses_last_updated = datetime.now(timezone.utc)

        db.commit()
        logger.info("Scouting stats updated for player %s (total_analyses=%d)", user_id, total_analyses)
    except Exception as exc:
        db.rollback()
        logger.warning("Failed to update scouting stats for player %s: %s", user_id, exc)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_stats(p: PlayerProfile) -> StatsResponse:
    return StatsResponse(
        avg_bat_speed=p.avg_bat_speed,
        peak_bat_speed=p.peak_bat_speed,
        avg_wrist_speed=p.avg_wrist_speed,
        avg_release_height=p.avg_release_height,
        best_front_knee_angle=p.best_front_knee_angle,
        best_shoulder_rotation=p.best_shoulder_rotation,
        best_elbow_angle=p.best_elbow_angle,
        best_release_consistency=p.best_release_consistency,
    )


def _to_response(p: PlayerProfile) -> ProfileResponse:
    return ProfileResponse(
        user_id=p.user_id,
        display_name=p.display_name,
        city=p.city,
        state=p.state,
        bat_style=p.bat_style,
        bowl_style=p.bowl_style,
        age=p.age,
        cricket_role=p.cricket_role,
        experience_level=p.experience_level,
        preferred_format=p.preferred_format,
        profile_image_url=p.profile_image_url,
        scouting_visible=p.scouting_visible,
        total_analyses=p.total_analyses or 0,
        analyses_last_updated=p.analyses_last_updated,
        updated_at=p.updated_at,
        stats=_to_stats(p),
    )


def _to_public_response(p: PlayerProfile) -> PublicProfileResponse:
    return PublicProfileResponse(
        user_id=p.user_id,
        display_name=p.display_name,
        city=p.city,
        state=p.state,
        bat_style=p.bat_style,
        bowl_style=p.bowl_style,
        age=p.age,
        cricket_role=p.cricket_role,
        experience_level=p.experience_level,
        preferred_format=p.preferred_format,
        profile_image_url=p.profile_image_url,
        total_analyses=p.total_analyses or 0,
        analyses_last_updated=p.analyses_last_updated,
        stats=_to_stats(p),
    )
