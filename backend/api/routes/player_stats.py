@router.get("/stats")
def player_stats(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Player).filter(Player.user_id == user.id).first()
