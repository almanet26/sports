from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.config import SessionLocal
from database.models.player_stats import PlayerStats
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/player-stats")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _empty_stats_payload() -> dict:
    return {
        "matches": None,
        "runs": None,
        "wickets": None,
        "strike_rate": None,
    }


@router.get("")
def get_my_player_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return current user's player stats when available, else an empty payload."""
    try:
        user_id_int = int(str(current_user.id))
    except (TypeError, ValueError):
        return _empty_stats_payload()

    stats = (
        db.query(PlayerStats)
        .filter(PlayerStats.player_id == user_id_int)
        .first()
    )

    if not stats:
        return _empty_stats_payload()

    return {
        "matches": stats.matches,
        "runs": stats.runs,
        "wickets": stats.wickets,
        "strike_rate": stats.strike_rate,
    }


@router.get("/{player_id}")
def get_player_stats(player_id: str, db: Session = Depends(get_db)):
    stats = (
        db.query(PlayerStats)
        .filter(PlayerStats.player_id == player_id)
        .first()
    )

    if not stats:
        raise HTTPException(status_code=404, detail="Player stats not found")

    return stats