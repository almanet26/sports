from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from database.config import get_db
from database.models.player_performance import PlayerPerformanceEntry
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/performance", tags=["performance"])


class PerformanceEntryCreate(BaseModel):
    opponent: str
    match_date: str
    match_type: str = "Practice"
    runs: int = 0
    fours: int = 0
    sixes: int = 0
    balls_faced: int = 0
    wickets: int = 0
    overs_bowled: float = 0.0
    runs_conceded: int = 0
    catches: int = 0
    run_outs: int = 0
    result: str = "Won"


class PerformanceEntryResponse(PerformanceEntryCreate):
    id: int
    player_id: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/", response_model=PerformanceEntryResponse, status_code=status.HTTP_201_CREATED)
def log_performance(
    data: PerformanceEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = PlayerPerformanceEntry(player_id=current_user.id, **data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/stats", response_model=dict)
def get_my_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entries = db.query(PlayerPerformanceEntry).filter(
        PlayerPerformanceEntry.player_id == current_user.id
    ).all()

    total = len(entries)
    if total == 0:
        return {
            "total_matches": 0, "total_runs": 0, "total_fours": 0,
            "total_sixes": 0, "total_wickets": 0, "total_catches": 0,
            "total_run_outs": 0, "highest_score": 0, "batting_average": 0.0,
            "total_balls_faced": 0, "total_overs_bowled": 0.0,
            "total_runs_conceded": 0, "bowling_average": 0.0,
            "wins": 0, "losses": 0, "draws": 0,
        }

    total_runs = sum(e.runs for e in entries)
    total_fours = sum(e.fours for e in entries)
    total_sixes = sum(e.sixes for e in entries)
    total_wickets = sum(e.wickets for e in entries)
    total_catches = sum(e.catches for e in entries)
    total_run_outs = sum(e.run_outs for e in entries)
    total_balls = sum(e.balls_faced for e in entries)
    total_overs = round(sum(e.overs_bowled for e in entries), 1)
    total_runs_conceded = sum(e.runs_conceded for e in entries)
    highest_score = max(e.runs for e in entries)
    wins = sum(1 for e in entries if e.result == "Won")
    losses = sum(1 for e in entries if e.result == "Lost")
    draws = sum(1 for e in entries if e.result == "Draw")
    batting_avg = round(total_runs / total, 2)
    bowling_avg = round(total_runs_conceded / total_wickets, 2) if total_wickets > 0 else 0.0

    return {
        "total_matches": total,
        "total_runs": total_runs,
        "total_fours": total_fours,
        "total_sixes": total_sixes,
        "total_wickets": total_wickets,
        "total_catches": total_catches,
        "total_run_outs": total_run_outs,
        "highest_score": highest_score,
        "batting_average": batting_avg,
        "total_balls_faced": total_balls,
        "total_overs_bowled": total_overs,
        "total_runs_conceded": total_runs_conceded,
        "bowling_average": bowling_avg,
        "wins": wins,
        "losses": losses,
        "draws": draws,
    }


@router.get("/history", response_model=List[PerformanceEntryResponse])
def get_my_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(PlayerPerformanceEntry).filter(
        PlayerPerformanceEntry.player_id == current_user.id
    ).order_by(PlayerPerformanceEntry.created_at.desc()).all()


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.query(PlayerPerformanceEntry).filter(
        PlayerPerformanceEntry.id == entry_id,
        PlayerPerformanceEntry.player_id == current_user.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
