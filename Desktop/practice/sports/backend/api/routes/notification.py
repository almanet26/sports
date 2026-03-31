@router.get("/notifications")
def get_notifications(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Notification).filter(Notification.user_id == user.id).all()
