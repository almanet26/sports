from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database.config import get_db
from database.models import CoachContent, User
from database.models.coach_content import ContentType
from utils.auth import get_current_user
from pydantic import BaseModel, Field, validator
from datetime import datetime
import os
import uuid
import shutil
import tempfile
from google.cloud import storage as gcs

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")
USE_GCS = bool(GCS_BUCKET_NAME)


def _upload_to_gcs(file: UploadFile, blob_path: str) -> tuple[str, int]:
    """Stream UploadFile to GCS without loading it fully into memory.
    Returns (public_url, file_size)."""
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        size = os.path.getsize(tmp_path)
        client = gcs.Client()
        blob = client.bucket(GCS_BUCKET_NAME).blob(blob_path)
        blob.content_type = file.content_type
        blob.upload_from_filename(tmp_path)
        url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{blob_path}"
        return url, size
    finally:
        os.unlink(tmp_path)


def _upload_to_local(file: UploadFile, blob_path: str) -> tuple[str, int]:
    """Save file to local storage as fallback.
    Returns (public_url, file_size)."""
    # Create full directory structure matching blob_path
    local_base = os.path.join("storage", "coach_content")
    
    # Extract directory structure from blob_path (e.g., "coach_content/user_id/file.jpg")
    # Remove "coach_content/" prefix if present
    if blob_path.startswith("coach_content/"):
        relative_path = blob_path[len("coach_content/"):]
    else:
        relative_path = blob_path
    
    # Get directory and filename
    dir_path = os.path.dirname(relative_path)
    filename = os.path.basename(relative_path)
    
    # Create full directory path
    if dir_path:
        full_dir = os.path.join(local_base, dir_path)
        os.makedirs(full_dir, exist_ok=True)
        file_path = os.path.join(full_dir, filename)
        url = f"/static/coach_content/{dir_path}/{filename}"
    else:
        os.makedirs(local_base, exist_ok=True)
        file_path = os.path.join(local_base, filename)
        url = f"/static/coach_content/{filename}"
    
    # Save file
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    size = os.path.getsize(file_path)
    return url, size


def _upload_file(file: UploadFile, blob_path: str) -> tuple[str, int]:
    """Upload file to GCS or local storage based on configuration."""
    if USE_GCS:
        try:
            return _upload_to_gcs(file, blob_path)
        except Exception as e:
            print(f"GCS upload failed: {e}, falling back to local storage")
            return _upload_to_local(file, blob_path)
    else:
        return _upload_to_local(file, blob_path)

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
def create_content(
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
        ext = os.path.splitext(file.filename)[1]
        blob_path = f"coach_content/{current_user.id}/{uuid.uuid4()}{ext}"
        file_url, file_size = _upload_file(file, blob_path)
        file_name = file.filename
        mime_type = file.content_type

    if thumbnail:
        ext = os.path.splitext(thumbnail.filename)[1]
        blob_path = f"coach_content/{current_user.id}/thumbnails/{uuid.uuid4()}{ext}"
        thumbnail_url, _ = _upload_file(thumbnail, blob_path)
    
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
def update_content(
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
        ext = os.path.splitext(file.filename)[1]
        blob_path = f"coach_content/{current_user.id}/{uuid.uuid4()}{ext}"
        content.file_url, content.file_size = _upload_file(file, blob_path)
        content.file_name = file.filename
        content.mime_type = file.content_type

    if thumbnail:
        ext = os.path.splitext(thumbnail.filename)[1]
        blob_path = f"coach_content/{current_user.id}/thumbnails/{uuid.uuid4()}{ext}"
        content.thumbnail_url, _ = _upload_file(thumbnail, blob_path)
    
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
