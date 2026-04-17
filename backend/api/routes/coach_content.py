from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database.config import get_db
from database.models import CoachContent, ContentType, User
from utils.auth import get_current_user
from pydantic import BaseModel, Field, validator
from datetime import datetime
import os
import uuid

router = APIRouter()


# Pydantic schemas with validation
class ContentBase(BaseModel):
    """Base schema for content creation"""
    title: str = Field(..., min_length=1, max_length=255, description="Content title")
    description: Optional[str] = Field(None, max_length=1000, description="Content description")
    content_type: ContentType = Field(..., description="Type of content: article, video, or image")
    article_body: Optional[str] = Field(None, description="Article text content")
    tags: Optional[str] = Field(None, max_length=500, description="Comma-separated tags")
    is_public: bool = Field(True, description="Whether content is public or private")

    @validator('title')
    def title_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()

    @validator('tags')
    def validate_tags(cls, v):
        if v:
            return v.strip()
        return v


class ContentResponse(BaseModel):
    """Response schema for content"""
    id: str
    coach_id: str
    title: str
    description: Optional[str] = None
    content_type: ContentType
    article_body: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    thumbnail_url: Optional[str] = None
    tags: Optional[str] = None
    is_public: bool = True
    views: int = 0
    likes: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LikeResponse(BaseModel):
    """Response schema for like action"""
    likes: int = Field(..., description="Total number of likes")


class DeleteResponse(BaseModel):
    """Response schema for delete action"""
    message: str = Field(..., description="Success message")


@router.post("/content", response_model=ContentResponse, status_code=status.HTTP_201_CREATED)
async def create_content(
    title: str = Form(..., min_length=1, max_length=255),
    description: Optional[str] = Form(None, max_length=1000),
    content_type: ContentType = Form(...),
    article_body: Optional[str] = Form(None),
    tags: Optional[str] = Form(None, max_length=500),
    is_public: bool = Form(True),
    file: Optional[UploadFile] = File(None),
    thumbnail: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create new coach content (article, video, or image)"""
    
    # Verify user is a coach
    if current_user.role != "COACH":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can create content"
        )
    
    # Handle file uploads
    file_url = None
    thumbnail_url = None
    
    file_name = None
    file_size = None
    mime_type = None
    
    if file and content_type in [ContentType.VIDEO, ContentType.IMAGE]:
        storage_dir = f"storage/coach_content/{current_user.id}"
        os.makedirs(storage_dir, exist_ok=True)
        
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(storage_dir, unique_filename)
        
        content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        file_url = f"/static/coach_content/{current_user.id}/{unique_filename}"
        file_name = file.filename
        file_size = len(content)
        mime_type = file.content_type
    
    if thumbnail:
        storage_dir = f"storage/coach_content/{current_user.id}/thumbnails"
        os.makedirs(storage_dir, exist_ok=True)
        
        thumb_extension = os.path.splitext(thumbnail.filename)[1]
        unique_thumb = f"{uuid.uuid4()}{thumb_extension}"
        thumb_path = os.path.join(storage_dir, unique_thumb)
        
        with open(thumb_path, "wb") as buffer:
            content = await thumbnail.read()
            buffer.write(content)
        
        thumbnail_url = f"/static/coach_content/{current_user.id}/thumbnails/{unique_thumb}"
    
    # Create content record
    content_record = CoachContent(
        coach_id=current_user.id,
        title=title,
        description=description,
        content_type=content_type,
        article_body=article_body,
        file_url=file_url,
        file_name=file_name,
        file_size=file_size,
        mime_type=mime_type,
        thumbnail_url=thumbnail_url,
        tags=tags,
        is_public=is_public
    )
    
    db.add(content_record)
    db.commit()
    db.refresh(content_record)
    
    return content_record


@router.get("/content", response_model=List[ContentResponse])
def get_my_content(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all content created by the current coach"""
    
    if current_user.role != "COACH":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can access this endpoint"
        )
    
    contents = db.query(CoachContent).filter(
        CoachContent.coach_id == current_user.id
    ).order_by(CoachContent.created_at.desc()).all()
    
    return contents


@router.get("/content/public", response_model=List[ContentResponse])
def get_all_public_content(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all accessible content for the current user"""
    
    # Get all public content
    public_contents = db.query(CoachContent).filter(
        CoachContent.is_public == True
    ).all()
    
    # If user is a coach, also include their own private content
    if current_user.role == "COACH":
        own_private = db.query(CoachContent).filter(
            CoachContent.coach_id == current_user.id,
            CoachContent.is_public == False
        ).all()
        
        # Combine and remove duplicates
        all_contents = list({c.id: c for c in (public_contents + own_private)}.values())
    else:
        all_contents = public_contents
    
    # Sort by created_at descending
    all_contents.sort(key=lambda x: x.created_at, reverse=True)
    
    return all_contents


@router.get("/content/{content_id}", response_model=ContentResponse)
def get_content(
    content_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific content by ID - checks access permissions"""
    
    content = db.query(CoachContent).filter(CoachContent.id == content_id).first()
    
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found"
        )
    
    # Check access: public content OR user is the coach who created it
    if not content.is_public and current_user.id != content.coach_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This content is private. Only the coach can view it."
        )
    
    # Increment views
    content.views += 1
    db.commit()
    
    return content


@router.put("/content/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: str,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    article_body: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    is_public: Optional[bool] = Form(None),
    file: Optional[UploadFile] = File(None),
    thumbnail: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update existing content"""
    
    content = db.query(CoachContent).filter(CoachContent.id == content_id).first()
    
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found"
        )
    
    if content.coach_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this content"
        )
    
    # Update fields
    if title:
        content.title = title
    if description:
        content.description = description
    if article_body:
        content.article_body = article_body
    if tags:
        content.tags = tags
    if is_public is not None:
        content.is_public = is_public
    
    # Handle file updates
    if file:
        storage_dir = f"storage/coach_content/{current_user.id}"
        os.makedirs(storage_dir, exist_ok=True)
        
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(storage_dir, unique_filename)
        
        file_content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        content.file_url = f"/static/coach_content/{current_user.id}/{unique_filename}"
        content.file_name = file.filename
        content.file_size = len(file_content)
        content.mime_type = file.content_type
    
    if thumbnail:
        storage_dir = f"storage/coach_content/{current_user.id}/thumbnails"
        os.makedirs(storage_dir, exist_ok=True)
        
        thumb_extension = os.path.splitext(thumbnail.filename)[1]
        unique_thumb = f"{uuid.uuid4()}{thumb_extension}"
        thumb_path = os.path.join(storage_dir, unique_thumb)
        
        with open(thumb_path, "wb") as buffer:
            thumb_content = await thumbnail.read()
            buffer.write(thumb_content)
        
        content.thumbnail_url = f"/static/coach_content/{current_user.id}/thumbnails/{unique_thumb}"
    
    content.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(content)
    
    return content


@router.delete("/content/{content_id}", response_model=DeleteResponse)
def delete_content(
    content_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete content"""
    
    content = db.query(CoachContent).filter(CoachContent.id == content_id).first()
    
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found"
        )
    
    if content.coach_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this content"
        )
    
    db.delete(content)
    db.commit()
    
    return {"message": "Content deleted successfully"}


@router.post("/content/{content_id}/like", response_model=LikeResponse)
def like_content(
    content_id: str,
    db: Session = Depends(get_db)
):
    """Like a content"""
    
    content = db.query(CoachContent).filter(CoachContent.id == content_id).first()
    
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found"
        )
    
    content.likes += 1
    db.commit()
    
    return {"likes": content.likes}


@router.get("/coach/{coach_id}/content", response_model=List[ContentResponse])
def get_coach_content(
    coach_id: str,
    db: Session = Depends(get_db)
):
    """Get all public content from a specific coach"""
    
    contents = db.query(CoachContent).filter(
        CoachContent.coach_id == coach_id
    ).order_by(CoachContent.created_at.desc()).all()
    
    return contents
