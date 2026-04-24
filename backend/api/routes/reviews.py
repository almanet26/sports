from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

from database.config import get_db
from database.models.coach_review import CoachReview
from database.models.user import User
from utils.auth import get_current_user

router = APIRouter(prefix="/reviews")


class ReviewCreate(BaseModel):
    coach_id: str
    rating: int
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: str
    coach_id: str
    player_id: str
    player_name: str
    rating: int
    comment: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def submit_review(
    data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "PLAYER":
        raise HTTPException(status_code=403, detail="Only players can submit reviews")

    if not 1 <= data.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    coach = db.query(User).filter(User.id == data.coach_id, User.role == "COACH").first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    existing = db.query(CoachReview).filter_by(coach_id=data.coach_id, player_id=current_user.id).first()
    if existing:
        existing.rating = data.rating
        existing.comment = data.comment
        db.commit()
        db.refresh(existing)
        review = existing
    else:
        review = CoachReview(
            coach_id=data.coach_id,
            player_id=current_user.id,
            rating=data.rating,
            comment=data.comment,
        )
        db.add(review)
        db.commit()
        db.refresh(review)

    return ReviewResponse(
        id=review.id,
        coach_id=review.coach_id,
        player_id=review.player_id,
        player_name=current_user.name,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
    )


@router.get("/coach/{coach_id}", response_model=dict)
def get_coach_reviews(
    coach_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reviews = db.query(CoachReview).filter(CoachReview.coach_id == coach_id).all()

    result = []
    for r in reviews:
        player = db.query(User).filter(User.id == r.player_id).first()
        result.append({
            "id": r.id,
            "player_id": r.player_id,
            "player_name": player.name if player else "Unknown",
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    avg = round(sum(r["rating"] for r in result) / len(result), 1) if result else 0.0
    return {"reviews": result, "total": len(result), "average_rating": avg}


@router.get("/player/my-coaches", response_model=dict)
def get_player_coaches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all coaches the player has submitted videos to, with their existing review if any."""
    if current_user.role != "PLAYER":
        raise HTTPException(status_code=403, detail="Players only")

    from database.models.submission import VideoSubmission
    rows = (
        db.query(User)
        .join(VideoSubmission, VideoSubmission.coach_id == User.id)
        .filter(VideoSubmission.player_id == current_user.id)
        .distinct()
        .all()
    )

    coaches = []
    for coach in rows:
        review = db.query(CoachReview).filter_by(coach_id=coach.id, player_id=current_user.id).first()
        coaches.append({
            "id": coach.id,
            "name": coach.name,
            "email": coach.email,
            "specialization": coach.specialization,
            "existing_review": {
                "rating": review.rating,
                "comment": review.comment,
            } if review else None,
        })

    return {"coaches": coaches}
