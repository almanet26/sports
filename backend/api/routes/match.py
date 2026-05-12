from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database.config import get_db
from database.models.match import Match
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/matches", tags=["matches"])


class MatchStatistics(BaseModel):
    runs: int
    wickets: int
    catches: int
    result: str  # "Won" or "Lost"


class MatchCreate(BaseModel):
    opponent: str
    match_type: str  # Practice, Tournament, Friendly
    match_date: str
    match_time: str
    venue: str
    location_type: str = "Home"  # Home, Away, Neutral
    player_role: Optional[str] = None
    notes: Optional[str] = None
    reminder: Optional[str] = None


class MatchUpdate(BaseModel):
    opponent: Optional[str] = None
    match_type: Optional[str] = None
    match_status: Optional[str] = None
    match_date: Optional[str] = None
    match_time: Optional[str] = None
    venue: Optional[str] = None
    location_type: Optional[str] = None
    player_role: Optional[str] = None
    notes: Optional[str] = None
    reminder: Optional[str] = None
    statistics: Optional[MatchStatistics] = None


class MatchResponse(BaseModel):
    id: int
    created_by: str
    opponent: str
    match_type: str
    match_status: str
    match_date: str
    match_time: str
    venue: str
    location_type: str
    player_role: Optional[str]
    notes: Optional[str]
    statistics: Optional[dict]
    reminder: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


@router.get("/", response_model=List[MatchResponse])
def get_user_matches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all matches for the current user."""
    matches = db.query(Match).filter(Match.created_by == current_user.id).order_by(Match.match_date.asc(), Match.match_time.asc()).all()
    return matches


@router.get("/upcoming", response_model=List[MatchResponse])
def get_upcoming_matches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get upcoming matches for the current user."""
    matches = db.query(Match).filter(
        Match.created_by == current_user.id,
        Match.match_status.in_(["Upcoming", "Today"])
    ).order_by(Match.match_date.asc(), Match.match_time.asc()).all()
    return matches


@router.get("/{match_id}", response_model=MatchResponse)
def get_match(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific match by ID."""
    match = db.query(Match).filter(
        Match.id == match_id,
        Match.created_by == current_user.id
    ).first()
    
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )
    
    return match


@router.post("/", response_model=MatchResponse, status_code=status.HTTP_201_CREATED)
def create_match(
    match_data: MatchCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new match."""
    from api.routes.notification import create_notification
    
    new_match = Match(
        created_by=current_user.id,
        opponent=match_data.opponent,
        match_type=match_data.match_type,
        match_date=match_data.match_date,
        match_time=match_data.match_time,
        venue=match_data.venue,
        location_type=match_data.location_type,
        player_role=match_data.player_role,
        notes=match_data.notes,
        reminder=match_data.reminder,
        match_status="Upcoming"
    )
    
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    
    # Create notification
    create_notification(
        db=db,
        user_id=current_user.id,
        title="Match Scheduled",
        message=f"New match vs {match_data.opponent} on {match_data.match_date} at {match_data.venue}",
        notif_type="match"
    )
    
    return new_match


@router.put("/{match_id}", response_model=MatchResponse)
def update_match(
    match_id: int,
    match_data: MatchUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing match."""
    from api.routes.notification import create_notification
    
    match = db.query(Match).filter(
        Match.id == match_id,
        Match.created_by == current_user.id
    ).first()
    
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )
    
    update_data = match_data.model_dump(exclude_unset=True)
    
    # Handle statistics separately
    if "statistics" in update_data and update_data["statistics"]:
        update_data["statistics"] = update_data["statistics"].dict() if hasattr(update_data["statistics"], "dict") else update_data["statistics"]
    
    # Check if critical fields changed
    date_changed = "match_date" in update_data and update_data["match_date"] != match.match_date
    time_changed = "match_time" in update_data and update_data["match_time"] != match.match_time
    venue_changed = "venue" in update_data and update_data["venue"] != match.venue
    cancelled = "match_status" in update_data and update_data["match_status"] == "Cancelled"

    for field, value in update_data.items():
        setattr(match, field, value)
    
    db.commit()
    db.refresh(match)
    
    # Create notification for significant changes
    if cancelled:
        create_notification(
            db=db,
            user_id=current_user.id,
            title="Match Cancelled",
            message=f"Match vs {match.opponent} on {match.match_date} has been cancelled",
            notif_type="match"
        )
    elif date_changed or time_changed or venue_changed:
        create_notification(
            db=db,
            user_id=current_user.id,
            title="Match Updated",
            message=f"Match vs {match.opponent} details have been updated",
            notif_type="match"
        )
    
    return match


@router.delete("/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_match(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a match."""
    match = db.query(Match).filter(
        Match.id == match_id,
        Match.created_by == current_user.id
    ).first()
    
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )
    
    db.delete(match)
    db.commit()
    
    return None
