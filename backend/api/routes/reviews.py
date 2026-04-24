from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.config import get_db
from database.models import Review, User
from utils.auth import get_current_user
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime

router = APIRouter()


class ReviewResponse(BaseModel):
    id: str
    player_name: str
    player_email: str
    rating: int
    comment: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewStatsResponse(BaseModel):
    average_rating: float
    total_reviews: int
    rating_distribution: dict


class CreateReviewRequest(BaseModel):
    coach_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None


@router.get("/reviews/stats", response_model=ReviewStatsResponse)
def get_review_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get review statistics for coach"""
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can access reviews")
    
    # Average rating
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.coach_id == current_user.id
    ).scalar() or 0.0
    
    # Total reviews
    total_reviews = db.query(func.count(Review.id)).filter(
        Review.coach_id == current_user.id
    ).scalar() or 0
    
    # Rating distribution
    distribution = {}
    for rating in [5, 4, 3, 2, 1]:
        count = db.query(func.count(Review.id)).filter(
            Review.coach_id == current_user.id,
            Review.rating == rating
        ).scalar() or 0
        distribution[str(rating)] = count
    
    return {
        "average_rating": round(avg_rating, 1),
        "total_reviews": total_reviews,
        "rating_distribution": distribution
    }


@router.get("/reviews", response_model=List[ReviewResponse])
def get_reviews(
    rating_filter: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all reviews for coach with optional rating filter"""
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can access reviews")
    
    query = db.query(Review).filter(Review.coach_id == current_user.id)
    
    if rating_filter:
        query = query.filter(Review.rating == rating_filter)
    
    reviews = query.order_by(Review.created_at.desc()).all()
    
    result = []
    for r in reviews:
        player = db.query(User).filter(User.id == r.player_id).first()
        result.append({
            "id": r.id,
            "player_name": player.name if player else "Unknown",
            "player_email": player.email if player else "",
            "rating": r.rating,
            "comment": r.comment,
            "created_at": r.created_at
        })
    
    return result


@router.post("/reviews", response_model=ReviewResponse)
def create_review(
    review_data: CreateReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a review for a coach (player only)"""
    if current_user.role != "PLAYER":
        raise HTTPException(status_code=403, detail="Only players can create reviews")
    
    # Check if coach exists
    coach = db.query(User).filter(User.id == review_data.coach_id).first()
    if not coach or coach.role != "COACH":
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Check if player already reviewed this coach
    existing = db.query(Review).filter(
        Review.coach_id == review_data.coach_id,
        Review.player_id == current_user.id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="You have already reviewed this coach")
    
    # Create review
    review = Review(
        coach_id=review_data.coach_id,
        player_id=current_user.id,
        rating=review_data.rating,
        comment=review_data.comment
    )
    
    db.add(review)
    db.commit()
    db.refresh(review)
    
    return {
        "id": review.id,
        "player_name": current_user.name,
        "player_email": current_user.email,
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at
    }
