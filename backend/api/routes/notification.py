from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.config import get_db
from utils.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def get_notifications(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Return notifications for current user when table exists."""
    try:
        rows = db.execute(
            text(
                """
                SELECT id, user_id, message, is_read
                FROM notifications
                WHERE user_id = :user_id
                ORDER BY id DESC
                LIMIT 100
                """
            ),
            {"user_id": str(user.id)},
        ).mappings().all()
        return [dict(row) for row in rows]
    except Exception:
        return []
