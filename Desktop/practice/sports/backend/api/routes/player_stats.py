from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.config import SessionLocal
from database.models.player_stats import PlayerStats

router = APIRouter(prefix="/player-stats")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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