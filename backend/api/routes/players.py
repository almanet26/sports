from datetime import datetime
from pathlib import Path
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.player_profile import PlayerProfile
from database.models.user import User
from database.models.video import Video, VideoStatus, VideoVisibility
from database.models.submission import VideoSubmission
from schemas.player_profile import (
    PlayerProfileEnvelope,
    PlayerProfileResponse,
    PlayerProfileUpdateEnvelope,
    PlayerProfileUpdateRequest,
)
from schemas.player_video import (
    PlayerVideoDeleteEnvelope,
    PlayerVideoListEnvelope,
    PlayerVideoResponse,
    PlayerVideoUploadEnvelope,
)
from utils.auth import get_current_user

router = APIRouter(prefix="/player", tags=["player-profile"])

_INVALID_PLACEHOLDERS = {"", "NONE", "NULL", "N/A", "NA", "SELECT OPTION"}
_PLAYER_VIDEO_UPLOAD_DIR = Path("storage/uploads/player_videos")
_PLAYER_VIDEO_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
_PLAYER_VIDEO_ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
_PLAYER_VIDEO_MAX_SIZE_BYTES = 100 * 1024 * 1024
_PLAYER_VIDEO_CHUNK_SIZE = 1024 * 1024

# ── Base required fields (all roles) ─────────────────────────────────────────
_BASE_REQUIRED = [
    ("full_name", "Full Name"),
    ("age", "Age"),
    ("gender", "Gender"),
    ("country", "Country"),
    ("cricket_role", "Cricket Role"),
    ("preferred_format", "Preferred Format"),
    ("bio", "Bio"),
    ("education_type", "Education Type"),
]

# ── Extra required fields per role ───────────────────────────────────────────
_ROLE_EXTRA: dict[str, list[tuple[str, str]]] = {
    "BATSMAN": [("batting_hand", "Batting Hand")],
    "BOWLER": [("bowling_arm", "Bowling Arm"), ("bowling_type", "Bowling Type")],
    "ALL-ROUNDER": [
        ("batting_hand", "Batting Hand"),
        ("bowling_arm", "Bowling Arm"),
        ("bowling_type", "Bowling Type"),
    ],
    "WICKET KEEPER": [("batting_hand", "Batting Hand")],
    "WICKETKEEPER": [("batting_hand", "Batting Hand")],
}


def _required_fields_for_role(role: str) -> list[tuple[str, str]]:
    key = (role or "").upper().strip()
    return _BASE_REQUIRED + _ROLE_EXTRA.get(key, [])


def _is_filled(value) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return True
    if isinstance(value, str):
        return value.strip().upper() not in _INVALID_PLACEHOLDERS
    return True


def _apply_completion(profile: PlayerProfile) -> None:
    required = _required_fields_for_role(profile.cricket_role or "")

    # Conditional: institution name required only when education type is selected
    if _is_filled(profile.education_type):
        required = required + [("institution_name", "Institution Name")]

    # Conditional: club name required only when has_cricket_club is True
    if profile.has_cricket_club is True:
        required = required + [("cricket_club_name", "Cricket Club Name")]

    filled = [label for field, label in required if _is_filled(getattr(profile, field, None))]
    missing = [label for field, label in required if not _is_filled(getattr(profile, field, None))]

    profile.completion_percentage = round((len(filled) / len(required)) * 100)
    profile.profile_completed = len(missing) == 0
    profile.missing_fields = missing


def _serialize_profile(profile: PlayerProfile) -> PlayerProfileResponse:
    return PlayerProfileResponse(
        id=profile.id,
        userId=profile.user_id,
        email=profile.email,
        username=profile.username or "",
        fullName=profile.full_name or "",
        age=profile.age,
        gender=profile.gender or "",
        city=profile.city or "",
        state=profile.state or "",
        country=profile.country or "",
        cricketRole=profile.cricket_role or "",
        experienceLevel=profile.experience_level or "",
        battingHand=profile.batting_hand or "",
        bowlingArm=profile.bowling_arm or "",
        bowlingType=profile.bowling_type or "",
        preferredFormat=profile.preferred_format or "",
        bio=profile.bio or "",
        profilePhoto=profile.profile_photo or "",
        educationType=profile.education_type or "",
        institutionName=profile.institution_name or "",
        hasCricketClub=profile.has_cricket_club,
        cricketClubName=profile.cricket_club_name or "",
        verified=bool(profile.verified),
        matches=profile.matches or 0,
        highlights=profile.highlights or 0,
        currentLevel=profile.current_level or "Beginner",
        completionPercentage=profile.completion_percentage or 0,
        profileCompleted=bool(profile.profile_completed),
        missingFields=list(profile.missing_fields or []),
        createdAt=profile.created_at,
        updatedAt=profile.updated_at,
    )


def _derive_name_from_email(email: str) -> str:
    local = (email or "").split("@")[0]
    return " ".join(p.capitalize() for p in local.replace(".", " ").replace("_", " ").replace("-", " ").split())


def _derive_username(user: User) -> str:
    source = user.name or _derive_name_from_email(user.email) or "player"
    return "".join(ch.lower() for ch in source if ch.isalnum()) or "player"


def _get_or_create_profile(db: Session, user: User) -> PlayerProfile:
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == user.id).first()
    if profile:
        return profile
    profile = PlayerProfile(
        user_id=user.id,
        email=user.email,
        username=_derive_username(user),
        full_name=user.name or _derive_name_from_email(user.email),
        bio=user.profile_bio or "",
        verified=bool(user.is_verified),
        current_level="Beginner",
    )
    _apply_completion(profile)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def _refresh_live_counts(db: Session, profile: PlayerProfile) -> None:
    profile.highlights = db.query(Video).filter(Video.uploaded_by == profile.user_id).count()
    profile.matches = db.query(VideoSubmission).filter(VideoSubmission.player_id == profile.user_id).count()
    _apply_completion(profile)


def _build_envelope(serialized: PlayerProfileResponse) -> dict:
    return {
        "completion_percentage": serialized.completionPercentage,
        "missing_fields": serialized.missingFields,
        "fields_left": len(serialized.missingFields),
        "profile_status": "complete" if serialized.profileCompleted else "incomplete",
    }


def _require_player(current_user: User) -> None:
    if (current_user.role or "").upper() != "PLAYER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only players can access this resource.")


def _serialize_player_video(video: Video) -> PlayerVideoResponse:
    thumbnail_url = None
    if video.thumbnail_path:
        thumbnail_url = video.thumbnail_path

    return PlayerVideoResponse(
        id=video.id,
        title=video.title,
        url=f"/api/v1/videos/{video.id}/stream",
        uploadedAt=video.created_at,
        status=video.status,
        thumbnailUrl=thumbnail_url,
    )


@router.get("/profile", response_model=PlayerProfileEnvelope)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_player(current_user)
    profile = _get_or_create_profile(db, current_user)
    _refresh_live_counts(db, profile)
    db.commit()
    db.refresh(profile)
    serialized = _serialize_profile(profile)
    return PlayerProfileEnvelope(profile=serialized, **_build_envelope(serialized))


@router.put("/profile", response_model=PlayerProfileUpdateEnvelope)
def update_profile(
    payload: PlayerProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_player(current_user)

    profile = _get_or_create_profile(db, current_user)

    profile.username = payload.username.strip() or profile.username or _derive_username(current_user)
    profile.full_name = payload.fullName.strip()
    profile.age = payload.age
    profile.gender = payload.gender.strip()
    profile.city = payload.city.strip()
    profile.state = payload.state.strip()
    profile.country = payload.country.strip()
    profile.cricket_role = payload.cricketRole.strip()
    profile.experience_level = payload.experienceLevel.strip()
    profile.batting_hand = payload.battingHand.strip()
    profile.bowling_arm = payload.bowlingArm.strip()
    profile.bowling_type = payload.bowlingType.strip()
    profile.preferred_format = payload.preferredFormat.strip()
    profile.bio = payload.bio.strip()
    profile.profile_photo = payload.profilePhoto.strip()
    profile.education_type = payload.educationType.strip()
    profile.institution_name = payload.institutionName.strip()
    profile.has_cricket_club = payload.hasCricketClub
    profile.cricket_club_name = payload.cricketClubName.strip()
    profile.email = current_user.email
    profile.verified = bool(current_user.is_verified)

    current_user.name = profile.full_name or current_user.name
    current_user.profile_bio = profile.bio

    _refresh_live_counts(db, profile)

    db.add(profile)
    db.add(current_user)
    db.commit()
    db.refresh(profile)
    serialized = _serialize_profile(profile)
    return PlayerProfileUpdateEnvelope(profile=serialized, **_build_envelope(serialized))


@router.post("/videos/upload", response_model=PlayerVideoUploadEnvelope, status_code=status.HTTP_201_CREATED)
async def upload_player_video(
    video: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_player(current_user)

    if not video.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Video filename is required.")

    file_ext = Path(video.filename).suffix.lower()
    if file_ext not in _PLAYER_VIDEO_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid video type. Allowed: {', '.join(sorted(_PLAYER_VIDEO_ALLOWED_EXTENSIONS))}",
        )

    content_type = (video.content_type or "").lower()
    if content_type and not content_type.startswith("video/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only video files can be uploaded.")

    video_id = str(uuid.uuid4())
    file_path = _PLAYER_VIDEO_UPLOAD_DIR / f"{video_id}{file_ext}"
    total_size = 0

    try:
        with open(file_path, "wb") as buffer:
            while chunk := await video.read(_PLAYER_VIDEO_CHUNK_SIZE):
                total_size += len(chunk)
                if total_size > _PLAYER_VIDEO_MAX_SIZE_BYTES:
                    buffer.close()
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Video is too large. Maximum allowed size is 100MB.",
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save video: {exc}") from exc
    finally:
        await video.close()

    video_record = Video(
        id=video_id,
        title=os.path.basename(video.filename),
        file_path=str(file_path),
        file_size_bytes=total_size,
        visibility=VideoVisibility.PRIVATE.value,
        uploaded_by=current_user.id,
        status=VideoStatus.COMPLETED.value,
    )

    db.add(video_record)
    db.commit()
    db.refresh(video_record)

    profile = _get_or_create_profile(db, current_user)
    _refresh_live_counts(db, profile)
    db.add(profile)
    db.commit()

    return PlayerVideoUploadEnvelope(video=_serialize_player_video(video_record))


@router.get("/videos", response_model=PlayerVideoListEnvelope)
def list_player_videos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_player(current_user)

    videos = (
        db.query(Video)
        .filter(Video.uploaded_by == current_user.id, Video.deleted_at.is_(None))
        .order_by(Video.created_at.desc())
        .all()
    )

    return PlayerVideoListEnvelope(videos=[_serialize_player_video(video) for video in videos])


@router.delete("/videos/{video_id}", response_model=PlayerVideoDeleteEnvelope)
def delete_player_video(
    video_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_player(current_user)

    video = (
        db.query(Video)
        .filter(Video.id == video_id, Video.uploaded_by == current_user.id, Video.deleted_at.is_(None))
        .first()
    )
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found.")

    video.deleted_at = datetime.utcnow()
    db.add(video)
    db.commit()

    profile = _get_or_create_profile(db, current_user)
    _refresh_live_counts(db, profile)
    db.add(profile)
    db.commit()

    return PlayerVideoDeleteEnvelope()
