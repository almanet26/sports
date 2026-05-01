"""
Player Profile & Scouting Visibility.

POST  /profile/setup             create or update own profile (PLAYER only)
PATCH /profile/scouting          toggle scouting visibility (Platinum+, PLAYER)
GET   /profile/{user_id}/public  read public profile (only if scouting_visible=true)

Performance stats (avg_bat_speed etc.) are written by the biomech worker and
are NOT accepted as user input through these endpoints.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
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
    """
    Create or update the authenticated user's player profile.
    Only identity fields are accepted — performance stats are populated by the worker.
    """
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()

    if profile is None:
        profile = PlayerProfile(user_id=current_user.id)
        db.add(profile)

    # Apply player-editable fields (only those explicitly provided)
    if body.display_name is not None:
        profile.display_name = body.display_name
    if body.city is not None:
        profile.city = body.city
    if body.state is not None:
        profile.state = body.state
    if body.bat_style is not None:
        profile.bat_style = body.bat_style
    if body.bowl_style is not None:
        profile.bowl_style = body.bowl_style
    if body.age is not None:
        profile.age = body.age
    if body.cricket_role is not None:
        profile.cricket_role = body.cricket_role
    if body.experience_level is not None:
        profile.experience_level = body.experience_level
    if body.preferred_format is not None:
        profile.preferred_format = body.preferred_format
    if body.profile_image_url is not None:
        profile.profile_image_url = body.profile_image_url

    db.commit()
    db.refresh(profile)
    return _to_response(profile)


@router.patch("/scouting")
def toggle_scouting(
    body: ScoutingPatchRequest,
    current_user: User = Depends(require_feature("scouting_visibility")),
    db: Session = Depends(get_db),
):
    """
    Enable or disable scouting visibility for the current player.
    Requires Platinum tier (PLAYER account only).
    When enabling: profile must have display_name and cricket_role filled in.
    """
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Profile not found. Call POST /profile/setup first.",
        )

    if body.scouting_visible:
        # Completeness check — only when enabling visibility
        missing: List[str] = []
        if not profile.display_name:
            missing.append("display_name")
        if not profile.cricket_role:
            missing.append("cricket_role")

        if missing:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "profile_incomplete",
                    "missing": missing,
                    "message": "Complete your profile before enabling scouting visibility.",
                },
            )

    profile.scouting_visible = body.scouting_visible
    db.commit()
    db.refresh(profile)

    return {
        "scouting_visible": profile.scouting_visible,
        "message": (
            "Your profile is now visible to coaches in the scouting directory."
            if profile.scouting_visible
            else "Your profile is now private."
        ),
    }


@router.get("/{user_id}/public", response_model=PublicProfileResponse)
def get_public_profile(
    user_id: str,
    db: Session = Depends(get_db),
) -> PublicProfileResponse:
    """
    Return a player's public profile.
    Returns 404 if the profile doesn't exist or scouting_visible is false.
    Callers cannot distinguish the two cases (privacy-preserving).
    """
    profile = (
        db.query(PlayerProfile)
        .filter(
            PlayerProfile.user_id == user_id,
            PlayerProfile.scouting_visible.is_(True),
        )
        .first()
    )
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    return _to_public_response(profile)


# ---------------------------------------------------------------------------
# Worker helper — called after each batting/bowling analysis completes
# ---------------------------------------------------------------------------

def update_player_scouting_stats(user_id: str, db: Session) -> None:
    """
    Aggregate stats from batting_analyses and bowling_analyses and upsert
    them into player_profiles.  Called by the Cloud Tasks worker callback.
    """
    try:
        # ── Batting aggregates ───────────────────────────────────────────────
        bat_row = db.query(
            func.avg(BattingAnalysis.avg_front_knee_angle).label("avg_knee"),
            func.max(BattingAnalysis.avg_front_knee_angle).label("best_knee"),
            func.avg(BattingAnalysis.avg_shoulder_rotation).label("avg_shoulder"),
            func.max(BattingAnalysis.avg_shoulder_rotation).label("best_shoulder"),
            func.avg(BattingAnalysis.avg_backlift_height).label("avg_backlift"),
            func.count(BattingAnalysis.id).label("bat_count"),
        ).filter(BattingAnalysis.player_id == user_id).one()

        # ── Bowling aggregates ───────────────────────────────────────────────
        bowl_row = db.query(
            func.avg(BowlingAnalysis.avg_elbow_angle).label("avg_elbow"),
            func.max(BowlingAnalysis.avg_elbow_angle).label("best_elbow"),
            func.avg(BowlingAnalysis.release_consistency).label("avg_consistency"),
            func.max(BowlingAnalysis.release_consistency).label("best_consistency"),
            func.avg(BowlingAnalysis.avg_release_height).label("avg_release_height"),
            func.count(BowlingAnalysis.id).label("bowl_count"),
        ).filter(BowlingAnalysis.player_id == user_id).one()

        total_analyses = (bat_row.bat_count or 0) + (bowl_row.bowl_count or 0)

        # ── Upsert player_profiles ───────────────────────────────────────────
        profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == user_id).first()
        if profile is None:
            profile = PlayerProfile(user_id=user_id)
            db.add(profile)

        profile.best_front_knee_angle = bat_row.best_knee
        profile.best_shoulder_rotation = bat_row.best_shoulder
        # avg_wrist_speed maps to backlift proxy until dedicated field exists
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