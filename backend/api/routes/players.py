from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database.config import get_db
from backend.database.models.player import Player
from backend.utils.auth import get_current_user

router = APIRouter(prefix="/api/player", tags=["Player"])

@router.get("/profile")
def get_profile(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Player).filter(Player.user_id == user.id).first()

@router.put("/profile")
def update_profile(data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    player = db.query(Player).filter(Player.user_id == user.id).first()
    for key, value in data.items():
        setattr(player, key, value)
    db.commit()
    return {"message": "Profile updated"}
