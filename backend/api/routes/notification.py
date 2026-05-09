from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
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
                SELECT id, user_id, title, message, type, is_read, created_at
                FROM notifications
                WHERE user_id = :user_id
                ORDER BY id DESC
                LIMIT 100
                """
            ),
            {"user_id": str(user.id)},
        ).mappings().all()
        notifications = []
        for row in rows:
            created_at = row.get("created_at")
            if isinstance(created_at, datetime):
                created_at = created_at.isoformat()
            notifications.append(
                {
                    "id": row.get("id"),
                    "title": row.get("title"),
                    "message": row.get("message"),
                    "type": row.get("type") or "info",
                    "is_read": bool(row.get("is_read")),
                    "created_at": created_at,
                }
            )

        unread_count = sum(1 for item in notifications if not item["is_read"])
        return {"notifications": notifications, "unread_count": unread_count}
    except Exception:
        return {"notifications": [], "unread_count": 0}


@router.patch("/{notification_id}/read")
def mark_read(notification_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    try:
        db.execute(
            text(
                """
                UPDATE notifications
                SET is_read = true
                WHERE id = :id AND user_id = :user_id
                """
            ),
            {"id": notification_id, "user_id": str(user.id)},
        )
        db.commit()
        return {"status": "ok"}
    except Exception:
        db.rollback()
        return {"status": "ok"}


@router.patch("/read-all")
def mark_all_read(db: Session = Depends(get_db), user=Depends(get_current_user)):
    try:
        db.execute(
            text(
                """
                UPDATE notifications
                SET is_read = true
                WHERE user_id = :user_id
                """
            ),
            {"user_id": str(user.id)},
        )
        db.commit()
        return {"status": "ok"}
    except Exception:
        db.rollback()
        return {"status": "ok"}


@router.delete("/{notification_id}")
def delete_notification(notification_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    try:
        result = db.execute(
            text(
                """
                DELETE FROM notifications
                WHERE id = :id AND user_id = :user_id
                """
            ),
            {"id": notification_id, "user_id": str(user.id)},
        )
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        return {"status": "ok"}
