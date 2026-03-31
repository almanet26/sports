@router.get("/upcoming")
def upcoming_matches(db: Session = Depends(get_db)):
    return db.query(Match).all()
