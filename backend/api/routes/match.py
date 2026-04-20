from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.config import get_db

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("/upcoming")
def upcoming_matches(db: Session = Depends(get_db)):
    """Return upcoming matches from the matches table when present."""
    try:
        rows = db.execute(
            text(
                """
                SELECT id, team_a, team_b, match_date, venue
                FROM matches
                ORDER BY match_date ASC
                LIMIT 100
                """
            )
        ).mappings().all()
        return [dict(row) for row in rows]
    except Exception:
        # Keep UI resilient if this optional table is not present yet.
        return []
