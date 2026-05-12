"""
Player-specific video routes.

Provides an authenticated stream path for private videos for use inside the
player dashboard UI (the generic /videos/{id}/stream intentionally does not
serve private files).
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path

from utils.auth import get_current_user
from database.models.user import User
from database.models.video import Video

router = APIRouter(prefix="/player/videos", tags=["player-videos"])


@router.get("/{video_id}/stream")
def stream_player_video(video_id: str, current_user: User = Depends(get_current_user)):
    """
    Stream a private video for its owner (or ADMIN).

    - Auth required
    - Only the owner (uploaded_by) or ADMIN can access
    """
    # Manually manage DB session to close before streaming (mirrors videos.py behavior)
    from database.config import SessionLocal

    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.id == video_id, Video.deleted_at.is_(None)).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")

        if str(video.uploaded_by) != str(current_user.id) and current_user.role != "ADMIN":
            raise HTTPException(status_code=403, detail="Access denied")

        file_path_str = video.file_path
        video_title = video.title
    finally:
        db.close()

    # Remote storage URL (e.g., GCS public URL)
    if file_path_str.startswith("http://") or file_path_str.startswith("https://"):
        return RedirectResponse(url=file_path_str, status_code=307)

    file_path = Path(file_path_str)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    return FileResponse(
        path=str(file_path),
        media_type="video/mp4",
        filename=f"{video_title}.mp4",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
