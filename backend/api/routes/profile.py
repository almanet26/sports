"""
Player Profile & Scouting Visibility.

POST  /profile/setup                     create or update own profile (any user)
PATCH /profile/scouting                  toggle scouting visibility (Platinum+)
GET   /profile/{user_id}/public          read public profile (only if visible)

Performance stats (avg_bat_speed etc.) are written by the biomech worker and
are NOT accepted as user input through these endpoints.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.player_profile import PlayerProfile
from database.models.user import User
from dependencies.feature_gate import require_feature
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["profile"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProfileSetupRequest(BaseModel):
    display_name: Optional[str] = None
    city: Optional[str] = None
    bat_style: Optional[str] = None
    bowl_style: Optional[str] = None


class ScoutingPatchRequest(BaseModel):
    scouting_visible: bool


class ProfileResponse(BaseModel):
    user_id: str
    display_name: Optional[str]
    city: Optional[str]
    bat_style: Optional[str]
    bowl_style: Optional[str]
    avg_bat_speed: Optional[float]
    peak_bat_speed: Optional[float]
    avg_release_height: Optional[float]
    avg_wrist_speed: Optional[float]
    scouting_visible: bool
    updated_at: datetime


class PublicProfileResponse(BaseModel):
    user_id: str
    display_name: Optional[str]
    city: Optional[str]
    bat_style: Optional[str]
    bowl_style: Optional[str]
    avg_bat_speed: Optional[float]
    peak_bat_speed: Optional[float]
    avg_release_height: Optional[float]
    avg_wrist_speed: Optional[float]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/setup", response_model=ProfileResponse)
def setup_profile(
    body: ProfileSetupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """
    Create or update the authenticated user's player profile.
    Only identity fields (display_name, city, bat_style, bowl_style) are
    accepted here — performance stats are populated by the worker.
    """
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()

    if profile is None:
        profile = PlayerProfile(user_id=current_user.id)
        db.add(profile)

    if body.display_name is not None:
        profile.display_name = body.display_name
    if body.city is not None:
        profile.city = body.city
    if body.bat_style is not None:
        profile.bat_style = body.bat_style
    if body.bowl_style is not None:
        profile.bowl_style = body.bowl_style

    db.commit()
    db.refresh(profile)
    return _to_response(profile)


@router.patch("/scouting", response_model=ProfileResponse)
def toggle_scouting(
    body: ScoutingPatchRequest,
    current_user: User = Depends(require_feature("pro_benchmarking")),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """
    Enable or disable scouting visibility.  Requires Platinum+ tier.
    (Uses pro_benchmarking as the platinum proxy gate.)
    """
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Profile not found. Call POST /profile/setup first.",
        )

    profile.scouting_visible = body.scouting_visible
    db.commit()
    db.refresh(profile)
    return _to_response(profile)


@router.get("/{user_id}/public", response_model=PublicProfileResponse)
def get_public_profile(
    user_id: str,
    db: Session = Depends(get_db),
) -> PublicProfileResponse:
    """
    Return a player's public profile.  Returns 404 if the profile doesn't
    exist or if scouting_visible is false — callers cannot distinguish the two.
    """
    profile = (
        db.query(PlayerProfile)
        .filter(PlayerProfile.user_id == user_id, PlayerProfile.scouting_visible.is_(True))
        .first()
    )
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    return PublicProfileResponse(
        user_id=profile.user_id,
        display_name=profile.display_name,
        city=profile.city,
        bat_style=profile.bat_style,
        bowl_style=profile.bowl_style,
        avg_bat_speed=profile.avg_bat_speed,
        peak_bat_speed=profile.peak_bat_speed,
        avg_release_height=profile.avg_release_height,
        avg_wrist_speed=profile.avg_wrist_speed,
    )


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _to_response(p: PlayerProfile) -> ProfileResponse:
    return ProfileResponse(
        user_id=p.user_id,
        display_name=p.display_name,
        city=p.city,
        bat_style=p.bat_style,
        bowl_style=p.bowl_style,
        avg_bat_speed=p.avg_bat_speed,
        peak_bat_speed=p.peak_bat_speed,
        avg_release_height=p.avg_release_height,
        avg_wrist_speed=p.avg_wrist_speed,
        scouting_visible=p.scouting_visible,
        updated_at=p.updated_at,
    )