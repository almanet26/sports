"""
Scouting Directory — Coach-facing endpoints.

Academy coaches can browse ALL players (regardless of scouting_visible),
view individual player profiles, and manage a private shortlist.

GET    /scouting/players                   — paginated directory (all players)
GET    /scouting/players/{user_id}         — single player detail
POST   /scouting/shortlist                 — add player to shortlist
GET    /scouting/shortlist                 — get coach's shortlist
PATCH  /scouting/shortlist/{player_id}     — update note on shortlisted player
DELETE /scouting/shortlist/{player_id}     — remove player from shortlist

All routes require: COACH account + academy tier.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, asc, desc, or_
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.batting import BattingAnalysis
from database.models.bowling import BowlingAnalysis
from database.models.coach_shortlist import CoachShortlist
from database.models.player_profile import PlayerProfile
from database.models.user import User
from dependencies.feature_gate import require_feature
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scouting", tags=["scouting"])

# ── Sort column mapping ───────────────────────────────────────────────────────
_SORT_COLUMNS: Dict[str, Any] = {
    "analyses_last_updated": PlayerProfile.analyses_last_updated,
    "total_analyses":        PlayerProfile.total_analyses,
    "avg_bat_speed":         PlayerProfile.avg_bat_speed,
    "avg_wrist_speed":       PlayerProfile.avg_wrist_speed,
    "avg_release_height":    PlayerProfile.avg_release_height,
    "best_release_consistency": PlayerProfile.best_release_consistency,
    "best_shoulder_rotation": PlayerProfile.best_shoulder_rotation,
    "city":                  PlayerProfile.city,
}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class StatsOut(BaseModel):
    avg_bat_speed: Optional[float]
    peak_bat_speed: Optional[float]
    avg_wrist_speed: Optional[float]
    avg_release_height: Optional[float]
    best_front_knee_angle: Optional[float]
    best_shoulder_rotation: Optional[float]
    best_elbow_angle: Optional[float]
    best_release_consistency: Optional[float]


class PlayerSummary(BaseModel):
    user_id: str
    display_name: Optional[str]
    city: Optional[str]
    state: Optional[str]
    cricket_role: Optional[str]
    experience_level: Optional[str]
    preferred_format: Optional[str]
    bat_style: Optional[str]
    bowl_style: Optional[str]
    age: Optional[int]
    profile_image_url: Optional[str]
    total_analyses: int
    analyses_last_updated: Optional[datetime]
    scouting_visible: bool
    stats: StatsOut


class PaginatedPlayersResponse(BaseModel):
    players: List[PlayerSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class AnalysisSummaryItem(BaseModel):
    id: str
    date: datetime
    metrics: Dict[str, Optional[float]]


class PlayerDetailResponse(BaseModel):
    user_id: str
    display_name: Optional[str]
    city: Optional[str]
    state: Optional[str]
    cricket_role: Optional[str]
    experience_level: Optional[str]
    preferred_format: Optional[str]
    bat_style: Optional[str]
    bowl_style: Optional[str]
    age: Optional[int]
    profile_image_url: Optional[str]
    total_analyses: int
    analyses_last_updated: Optional[datetime]
    scouting_visible: bool
    stats: StatsOut
    recent_batting: List[AnalysisSummaryItem]
    recent_bowling: List[AnalysisSummaryItem]
    shortlisted: bool
    coach_note: Optional[str]


class ShortlistAddRequest(BaseModel):
    player_id: str
    note: Optional[str] = None


class ShortlistUpdateRequest(BaseModel):
    note: Optional[str] = None


class ShortlistPlayerResponse(BaseModel):
    player: PlayerSummary
    note: Optional[str]
    added_at: datetime


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _profile_to_summary(p: PlayerProfile) -> PlayerSummary:
    return PlayerSummary(
        user_id=p.user_id,
        display_name=p.display_name,
        city=p.city,
        state=p.state,
        cricket_role=p.cricket_role,
        experience_level=p.experience_level,
        preferred_format=p.preferred_format,
        bat_style=p.bat_style,
        bowl_style=p.bowl_style,
        age=p.age,
        profile_image_url=p.profile_image_url,
        total_analyses=p.total_analyses or 0,
        analyses_last_updated=p.analyses_last_updated,
        scouting_visible=p.scouting_visible,
        stats=StatsOut(
            avg_bat_speed=p.avg_bat_speed,
            peak_bat_speed=p.peak_bat_speed,
            avg_wrist_speed=p.avg_wrist_speed,
            avg_release_height=p.avg_release_height,
            best_front_knee_angle=p.best_front_knee_angle,
            best_shoulder_rotation=p.best_shoulder_rotation,
            best_elbow_angle=p.best_elbow_angle,
            best_release_consistency=p.best_release_consistency,
        ),
    )


# ---------------------------------------------------------------------------
# 4B — GET /scouting/players
# ---------------------------------------------------------------------------

@router.get("/players", response_model=PaginatedPlayersResponse)
def list_scouting_players(
    # Pagination
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    # Filters
    city: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    cricket_role: Optional[str] = Query(None),
    experience_level: Optional[str] = Query(None),
    preferred_format: Optional[str] = Query(None),
    min_analyses: Optional[int] = Query(None, ge=0),
    bat_style: Optional[str] = Query(None),
    bowl_style: Optional[str] = Query(None),
    # Sort
    sort_by: str = Query("analyses_last_updated"),
    sort_order: str = Query("desc"),
    # Auth
    current_user: User = Depends(require_feature("scouting_access")),
    db: Session = Depends(get_db),
) -> PaginatedPlayersResponse:
    """
    Academy coaches browse ALL players who have a profile (no scouting_visible filter).
    Supports filtering by location, cricket role, experience, format, and data quality.
    """
    # Join PlayerProfile → User to get players only
    query = (
        db.query(PlayerProfile)
        .join(User, User.id == PlayerProfile.user_id)
        .filter(User.role == "PLAYER")
    )

    # ── Filters ──────────────────────────────────────────────────────────────
    if city:
        query = query.filter(PlayerProfile.city.ilike(f"%{city}%"))
    if state:
        query = query.filter(PlayerProfile.state.ilike(f"%{state}%"))
    if cricket_role:
        query = query.filter(PlayerProfile.cricket_role == cricket_role)
    if experience_level:
        query = query.filter(PlayerProfile.experience_level == experience_level)
    if preferred_format:
        query = query.filter(PlayerProfile.preferred_format == preferred_format)
    if min_analyses is not None:
        query = query.filter(PlayerProfile.total_analyses >= min_analyses)
    if bat_style:
        query = query.filter(PlayerProfile.bat_style.ilike(f"%{bat_style}%"))
    if bowl_style:
        query = query.filter(PlayerProfile.bowl_style.ilike(f"%{bowl_style}%"))

    # ── Sort ─────────────────────────────────────────────────────────────────
    sort_col = _SORT_COLUMNS.get(sort_by, PlayerProfile.analyses_last_updated)
    order_fn = desc if sort_order.lower() == "desc" else asc
    query = query.order_by(order_fn(sort_col).nullslast())

    # ── Paginate ─────────────────────────────────────────────────────────────
    total = query.count()
    offset = (page - 1) * page_size
    profiles = query.offset(offset).limit(page_size).all()

    import math
    return PaginatedPlayersResponse(
        players=[_profile_to_summary(p) for p in profiles],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1,
    )


# ---------------------------------------------------------------------------
# 4C — GET /scouting/players/{user_id}
# ---------------------------------------------------------------------------

@router.get("/players/{user_id}", response_model=PlayerDetailResponse)
def get_scouting_player(
    user_id: str,
    current_user: User = Depends(require_feature("scouting_access")),
    db: Session = Depends(get_db),
) -> PlayerDetailResponse:
    """
    Return the full profile for any player (academy coaches bypass scouting_visible).
    Includes last 3 batting + bowling analysis summaries (no ai_feedback text).
    """
    # Confirm target is a PLAYER account
    target_user = db.query(User).filter(User.id == user_id, User.role == "PLAYER").first()
    if target_user is None:
        raise HTTPException(status_code=404, detail="Player not found")

    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == user_id).first()
    if profile is None:
        raise HTTPException(status_code=404, detail="Player profile not found")

    # ── Recent batting analyses ───────────────────────────────────────────────
    batting_records = (
        db.query(BattingAnalysis)
        .filter(BattingAnalysis.player_id == user_id)
        .order_by(desc(BattingAnalysis.created_at))
        .limit(3)
        .all()
    )
    recent_batting = [
        AnalysisSummaryItem(
            id=a.id,
            date=a.created_at,
            metrics={
                "avg_front_knee_angle": a.avg_front_knee_angle,
                "avg_shoulder_rotation": a.avg_shoulder_rotation,
                "avg_backlift_height": a.avg_backlift_height,
            },
        )
        for a in batting_records
    ]

    # ── Recent bowling analyses ───────────────────────────────────────────────
    bowling_records = (
        db.query(BowlingAnalysis)
        .filter(BowlingAnalysis.player_id == user_id)
        .order_by(desc(BowlingAnalysis.created_at))
        .limit(3)
        .all()
    )
    recent_bowling = [
        AnalysisSummaryItem(
            id=a.id,
            date=a.created_at,
            metrics={
                "avg_elbow_angle": a.avg_elbow_angle,
                "release_consistency": a.release_consistency,
                "avg_release_height": a.avg_release_height,
            },
        )
        for a in bowling_records
    ]

    # ── Shortlist state for this coach ────────────────────────────────────────
    shortlist_entry = (
        db.query(CoachShortlist)
        .filter(
            CoachShortlist.coach_id == current_user.id,
            CoachShortlist.player_id == user_id,
        )
        .first()
    )

    return PlayerDetailResponse(
        user_id=profile.user_id,
        display_name=profile.display_name,
        city=profile.city,
        state=profile.state,
        cricket_role=profile.cricket_role,
        experience_level=profile.experience_level,
        preferred_format=profile.preferred_format,
        bat_style=profile.bat_style,
        bowl_style=profile.bowl_style,
        age=profile.age,
        profile_image_url=profile.profile_image_url,
        total_analyses=profile.total_analyses or 0,
        analyses_last_updated=profile.analyses_last_updated,
        scouting_visible=profile.scouting_visible,
        stats=StatsOut(
            avg_bat_speed=profile.avg_bat_speed,
            peak_bat_speed=profile.peak_bat_speed,
            avg_wrist_speed=profile.avg_wrist_speed,
            avg_release_height=profile.avg_release_height,
            best_front_knee_angle=profile.best_front_knee_angle,
            best_shoulder_rotation=profile.best_shoulder_rotation,
            best_elbow_angle=profile.best_elbow_angle,
            best_release_consistency=profile.best_release_consistency,
        ),
        recent_batting=recent_batting,
        recent_bowling=recent_bowling,
        shortlisted=shortlist_entry is not None,
        coach_note=shortlist_entry.note if shortlist_entry else None,
    )


# ---------------------------------------------------------------------------
# 4D — POST /scouting/shortlist
# ---------------------------------------------------------------------------

@router.post("/shortlist")
def add_to_shortlist(
    body: ShortlistAddRequest,
    current_user: User = Depends(require_feature("scouting_access")),
    db: Session = Depends(get_db),
):
    """Add a player to the coach's private shortlist."""
    # Validate the player exists
    player = db.query(User).filter(User.id == body.player_id, User.role == "PLAYER").first()
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")

    existing = (
        db.query(CoachShortlist)
        .filter(
            CoachShortlist.coach_id == current_user.id,
            CoachShortlist.player_id == body.player_id,
        )
        .first()
    )
    if existing:
        # Update note if provided
        if body.note is not None:
            existing.note = body.note
            db.commit()
        return {"shortlisted": True, "player_id": body.player_id, "already_existed": True}

    entry = CoachShortlist(
        coach_id=current_user.id,
        player_id=body.player_id,
        note=body.note,
    )
    db.add(entry)
    db.commit()
    return {"shortlisted": True, "player_id": body.player_id}


# ---------------------------------------------------------------------------
# 4E — GET /scouting/shortlist
# ---------------------------------------------------------------------------

@router.get("/shortlist")
def get_shortlist(
    current_user: User = Depends(require_feature("scouting_access")),
    db: Session = Depends(get_db),
):
    """Return the coach's full shortlist with player profiles and notes."""
    entries = (
        db.query(CoachShortlist)
        .filter(CoachShortlist.coach_id == current_user.id)
        .order_by(desc(CoachShortlist.added_at))
        .all()
    )

    result = []
    for entry in entries:
        profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == entry.player_id).first()
        if profile:
            result.append({
                "player": _profile_to_summary(profile).model_dump(),
                "note": entry.note,
                "added_at": entry.added_at.isoformat() if entry.added_at else None,
            })

    return {"shortlist": result, "total": len(result)}


# ---------------------------------------------------------------------------
# 4F — DELETE /scouting/shortlist/{player_id}
# ---------------------------------------------------------------------------

@router.delete("/shortlist/{player_id}")
def remove_from_shortlist(
    player_id: str,
    current_user: User = Depends(require_feature("scouting_access")),
    db: Session = Depends(get_db),
):
    """Remove a player from the coach's shortlist."""
    entry = (
        db.query(CoachShortlist)
        .filter(
            CoachShortlist.coach_id == current_user.id,
            CoachShortlist.player_id == player_id,
        )
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Player not in shortlist")

    db.delete(entry)
    db.commit()
    return {"removed": True, "player_id": player_id}


# ---------------------------------------------------------------------------
# PATCH /scouting/shortlist/{player_id} — update note
# ---------------------------------------------------------------------------

@router.patch("/shortlist/{player_id}")
def update_shortlist_note(
    player_id: str,
    body: ShortlistUpdateRequest,
    current_user: User = Depends(require_feature("scouting_access")),
    db: Session = Depends(get_db),
):
    """Update the coach's private note for a shortlisted player."""
    entry = (
        db.query(CoachShortlist)
        .filter(
            CoachShortlist.coach_id == current_user.id,
            CoachShortlist.player_id == player_id,
        )
        .first()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Player not in shortlist")

    entry.note = body.note
    db.commit()
    return {"player_id": player_id, "note": entry.note}
