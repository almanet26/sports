"""
Match Request API routes for the voting/request system.

Allows users to request matches to be added to the public library.
Implements popularity-based voting.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.config import get_db
from database.models.user import User
from database.models.video import MatchRequest, UserVote, Video
from schemas.video import MatchRequestCreate, MatchRequestResponse, MatchRequestListResponse
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/requests", tags=["requests"])
logger = logging.getLogger(__name__)


class VoteRequest(BaseModel):
    """Request body for voting"""
    vote_type: str  # 'up' or 'down'


def build_match_request_response(match_request: MatchRequest, current_user_id: Optional[str] = None, db: Session = None) -> MatchRequestResponse:
    """Helper to build MatchRequestResponse with user vote info"""
    user_vote = None
    if current_user_id and db:
        vote = db.query(UserVote).filter(
            UserVote.user_id == current_user_id,
            UserVote.request_id == match_request.id
        ).first()
        if vote:
            user_vote = vote.vote_type
    
    return MatchRequestResponse(
        id=match_request.id,
        match_title=match_request.match_title,
        youtube_url=match_request.youtube_url,
        match_date=match_request.match_date,
        teams=match_request.teams,
        venue=match_request.venue,
        description=match_request.description,
        vote_count=match_request.vote_count,
        upvotes=match_request.upvotes,
        downvotes=match_request.downvotes,
        user_vote=user_vote,
        status=match_request.status,
        requested_by=match_request.requested_by,
        created_at=match_request.created_at,
    )


@router.post("/", response_model=MatchRequestResponse, status_code=status.HTTP_201_CREATED)
def create_match_request(
    request: MatchRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a new match request or vote for an existing one.
    
    If a request with the same title exists, the user's vote is added.
    Otherwise, a new request is created.
    
    **Access:** All authenticated users.
    """
    # Check for existing request with same YouTube URL
    existing = db.query(MatchRequest).filter(
        MatchRequest.youtube_url == request.youtube_url
    ).first()
    
    if existing:
        # Check if user already voted
        existing_vote = db.query(UserVote).filter(
            UserVote.user_id == current_user.id,
            UserVote.request_id == existing.id,
        ).first()
        
        if existing_vote:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already voted for this request"
            )
        
        # Add vote
        vote = UserVote(user_id=current_user.id, request_id=existing.id)
        existing.vote_count += 1
        db.add(vote)
        db.commit()
        db.refresh(existing)
        
        logger.info(f"Vote added for request {existing.id} by {current_user.email}")
        
        return MatchRequestResponse(
            id=existing.id,
            match_title=existing.match_title,
            youtube_url=existing.youtube_url,
            match_date=existing.match_date,
            teams=existing.teams,
            venue=existing.venue,
            description=existing.description,
            vote_count=existing.vote_count,
            status=existing.status,
            requested_by=existing.requested_by,
            created_at=existing.created_at,
        )
    
    # Create new request
    # Use youtube_url as title if match_title not provided
    title = request.match_title or f"Match from YouTube"
    
    match_request = MatchRequest(
        match_title=title,
        youtube_url=request.youtube_url,
        match_date=request.match_date,
        teams=request.teams,
        venue=request.venue,
        description=request.description,
        video_url=request.video_url or request.youtube_url,  # Fallback
        requested_by=current_user.id,
        vote_count=1,
        upvotes=1,  # Creator auto-upvotes
        downvotes=0,
    )
    
    db.add(match_request)
    db.commit()
    db.refresh(match_request)
    
    # Auto-add creator's vote
    vote = UserVote(user_id=current_user.id, request_id=match_request.id, vote_type="up")
    db.add(vote)
    db.commit()
    
    logger.info(f"New match request created: {match_request.id} by {current_user.email}")
    
    return build_match_request_response(match_request, current_user.id, db)


@router.get("/", response_model=MatchRequestListResponse)
def list_requests(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, description="Filter by status: pending, approved, completed, rejected"),
    db: Session = Depends(get_db),
):
    """
    List all match requests sorted by vote count (popularity).
    
    **Access:** Open to all users.
    """
    offset = (page - 1) * per_page
    
    query = db.query(MatchRequest)
    
    if status_filter:
        query = query.filter(MatchRequest.status == status_filter)
    
    total = query.count()
    requests = query.order_by(MatchRequest.vote_count.desc(), MatchRequest.created_at.desc())\
                    .offset(offset).limit(per_page).all()
    
    return MatchRequestListResponse(
        requests=[MatchRequestResponse(
            id=r.id,
            match_title=r.match_title,
            youtube_url=r.youtube_url,
            match_date=r.match_date,
            teams=r.teams,
            venue=r.venue,
            description=r.description,
            vote_count=r.vote_count,
            status=r.status,
            requested_by=r.requested_by,
            created_at=r.created_at,
        ) for r in requests],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("/{request_id}/vote", response_model=MatchRequestResponse)
def vote_for_request(
    request_id: str,
    vote_request: VoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add or update a vote on a match request.
    
    **Access:** All authenticated users.
    **Body:** { "vote_type": "up" | "down" }
    """
    if vote_request.vote_type not in ["up", "down"]:
        raise HTTPException(status_code=400, detail="vote_type must be 'up' or 'down'")
    
    match_request = db.query(MatchRequest).filter(MatchRequest.id == request_id).first()
    
    if not match_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if match_request.status != "pending":
        raise HTTPException(status_code=400, detail="Cannot vote on non-pending requests")
    
    # Check existing vote
    existing_vote = db.query(UserVote).filter(
        UserVote.user_id == current_user.id,
        UserVote.request_id == request_id,
    ).first()
    
    if existing_vote:
        # User is changing their vote
        old_vote_type = existing_vote.vote_type
        
        if old_vote_type == vote_request.vote_type:
            # Same vote - no change
            pass
        else:
            # Change vote type
            if old_vote_type == "up":
                match_request.upvotes -= 1
                match_request.downvotes += 1
            else:
                match_request.downvotes -= 1
                match_request.upvotes += 1
            
            existing_vote.vote_type = vote_request.vote_type
    else:
        # New vote
        vote = UserVote(
            user_id=current_user.id,
            request_id=request_id,
            vote_type=vote_request.vote_type
        )
        
        if vote_request.vote_type == "up":
            match_request.upvotes += 1
        else:
            match_request.downvotes += 1
        
        match_request.vote_count += 1
        db.add(vote)
    
    db.commit()
    db.refresh(match_request)
    
    logger.info(f"{vote_request.vote_type.capitalize()}vote added for request {request_id} by {current_user.email}")
    
    return build_match_request_response(match_request, current_user.id, db)


@router.delete("/{request_id}/vote", status_code=status.HTTP_204_NO_CONTENT)
def remove_vote(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove your vote from a match request.
    
    **Access:** User who voted.
    """
    vote = db.query(UserVote).filter(
        UserVote.user_id == current_user.id,
        UserVote.request_id == request_id,
    ).first()
    
    if not vote:
        raise HTTPException(status_code=404, detail="Vote not found")
    
    match_request = db.query(MatchRequest).filter(MatchRequest.id == request_id).first()
    if match_request:
        match_request.vote_count = max(0, match_request.vote_count - 1)
        
        # Decrement upvotes or downvotes
        if vote.vote_type == "up":
            match_request.upvotes = max(0, match_request.upvotes - 1)
        else:
            match_request.downvotes = max(0, match_request.downvotes - 1)
    
    db.delete(vote)
    db.commit()
    
    logger.info(f"Vote removed for request {request_id} by {current_user.email}")
    
    return None


# ============ Admin Endpoints ============

@router.get("/admin/dashboard", response_model=MatchRequestListResponse)
def admin_request_dashboard(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"])),
):
    """
    Admin dashboard showing all requests sorted by popularity.
    
    **Access Control:** ADMIN only.
    """
    offset = (page - 1) * per_page
    
    query = db.query(MatchRequest).filter(MatchRequest.status == "pending")
    total = query.count()
    requests = query.order_by(MatchRequest.vote_count.desc()).offset(offset).limit(per_page).all()
    
    return MatchRequestListResponse(
        requests=[MatchRequestResponse(
            id=r.id,
            match_title=r.match_title,
            youtube_url=r.youtube_url,
            match_date=r.match_date,
            teams=r.teams,
            venue=r.venue,
            description=r.description,
            vote_count=r.vote_count,
            status=r.status,
            requested_by=r.requested_by,
            created_at=r.created_at,
        ) for r in requests],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.patch("/{request_id}/status")
def update_request_status(
    request_id: str,
    new_status: str = Query(..., description="New status: approved, completed, rejected"),
    fulfilled_video_id: Optional[str] = Query(None, description="Video ID if completing"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"])),
):
    """
    Update the status of a match request.
    
    **Access Control:** ADMIN only.
    
    **Statuses:**
    - `approved`: Request is approved and will be fulfilled
    - `completed`: Request has been fulfilled (requires video_id)
    - `rejected`: Request was rejected
    """
    if new_status not in ["approved", "completed", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    match_request = db.query(MatchRequest).filter(MatchRequest.id == request_id).first()
    
    if not match_request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if new_status == "completed":
        if not fulfilled_video_id:
            raise HTTPException(status_code=400, detail="Video ID required for completed status")
        
        video = db.query(Video).filter(Video.id == fulfilled_video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        match_request.fulfilled_video_id = fulfilled_video_id
        match_request.fulfilled_by = current_user.id
    
    match_request.status = new_status
    db.commit()
    db.refresh(match_request)
    
    logger.info(f"Request {request_id} status updated to {new_status} by {current_user.email}")
    
    return {
        "id": match_request.id,
        "status": match_request.status,
        "message": f"Request status updated to {new_status}",
    }
