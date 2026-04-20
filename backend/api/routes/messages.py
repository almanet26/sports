"""
Messaging API routes for coach-player communication
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import List
from pydantic import BaseModel
from datetime import datetime

from database.config import get_db
from database.models.user import User
from database.models.message import Message
from utils.auth import get_current_user

router = APIRouter(prefix="/messages", tags=["messages"])


class MessageCreate(BaseModel):
    receiver_id: str
    message_text: str


class MessageResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    message_text: str
    is_read: bool
    created_at: datetime
    sender_name: str
    sender_avatar: str | None
    receiver_name: str
    receiver_avatar: str | None

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    user_id: str
    user_name: str
    user_avatar: str | None
    user_role: str
    last_message: str
    last_message_time: datetime
    unread_count: int


@router.post("/send", response_model=MessageResponse)
def send_message(
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message to another user"""
    # Verify receiver exists
    receiver = db.query(User).filter(User.id == data.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")
    
    # Create message
    message = Message(
        sender_id=current_user.id,
        receiver_id=data.receiver_id,
        message_text=data.message_text
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    
    return MessageResponse(
        id=message.id,
        sender_id=message.sender_id,
        receiver_id=message.receiver_id,
        message_text=message.message_text,
        is_read=message.is_read,
        created_at=message.created_at,
        sender_name=current_user.name,
        sender_avatar=current_user.profile_image_url,
        receiver_name=receiver.name,
        receiver_avatar=receiver.profile_image_url
    )


@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all conversations for current user"""
    # Get all unique users the current user has messaged with
    sent_to = db.query(Message.receiver_id).filter(Message.sender_id == current_user.id).distinct()
    received_from = db.query(Message.sender_id).filter(Message.receiver_id == current_user.id).distinct()
    
    # Combine and get unique user IDs
    user_ids = set()
    for row in sent_to:
        user_ids.add(row[0])
    for row in received_from:
        user_ids.add(row[0])
    
    conversations = []
    for user_id in user_ids:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            continue
        
        # Get last message
        last_msg = db.query(Message).filter(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == user_id),
                and_(Message.sender_id == user_id, Message.receiver_id == current_user.id)
            )
        ).order_by(Message.created_at.desc()).first()
        
        # Count unread messages from this user
        unread = db.query(func.count(Message.id)).filter(
            Message.sender_id == user_id,
            Message.receiver_id == current_user.id,
            Message.is_read == False
        ).scalar()
        
        if last_msg:
            conversations.append(ConversationResponse(
                user_id=user.id,
                user_name=user.name,
                user_avatar=user.profile_image_url,
                user_role=user.role,
                last_message=last_msg.message_text,
                last_message_time=last_msg.created_at,
                unread_count=unread or 0
            ))
    
    # Sort by last message time
    conversations.sort(key=lambda x: x.last_message_time, reverse=True)
    return conversations


@router.get("/conversation/{user_id}", response_model=List[MessageResponse])
def get_conversation(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all messages in a conversation with a specific user"""
    # Verify other user exists
    other_user = db.query(User).filter(User.id == user_id).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all messages between current user and other user
    messages = db.query(Message).filter(
        or_(
            and_(Message.sender_id == current_user.id, Message.receiver_id == user_id),
            and_(Message.sender_id == user_id, Message.receiver_id == current_user.id)
        )
    ).order_by(Message.created_at.asc()).all()
    
    # Mark messages from other user as read
    db.query(Message).filter(
        Message.sender_id == user_id,
        Message.receiver_id == current_user.id,
        Message.is_read == False
    ).update({"is_read": True})
    db.commit()
    
    result = []
    for msg in messages:
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        receiver = db.query(User).filter(User.id == msg.receiver_id).first()
        result.append(MessageResponse(
            id=msg.id,
            sender_id=msg.sender_id,
            receiver_id=msg.receiver_id,
            message_text=msg.message_text,
            is_read=msg.is_read,
            created_at=msg.created_at,
            sender_name=sender.name if sender else "Unknown",
            sender_avatar=sender.profile_image_url if sender else None,
            receiver_name=receiver.name if receiver else "Unknown",
            receiver_avatar=receiver.profile_image_url if receiver else None
        ))
    
    return result


@router.get("/players", response_model=List[dict])
def get_coach_players(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all players for a coach (from submissions)"""
    if current_user.role != "COACH":
        raise HTTPException(status_code=403, detail="Only coaches can access this endpoint")
    
    # Import here to avoid circular dependency
    from database.models.submission import VideoSubmission
    
    # Get unique player IDs from submissions
    player_ids = db.query(VideoSubmission.player_id).filter(
        VideoSubmission.coach_id == current_user.id
    ).distinct().all()
    
    players = []
    for (player_id,) in player_ids:
        player = db.query(User).filter(User.id == player_id).first()
        if player:
            players.append({
                "id": player.id,
                "name": player.name,
                "email": player.email,
                "avatar": player.profile_image_url,
                "team": player.team
            })
    
    return players
