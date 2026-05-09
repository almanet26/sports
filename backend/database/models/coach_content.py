from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database.config import Base


class ContentType(str, enum.Enum):
    ARTICLE = "article"
    VIDEO = "video"
    IMAGE = "image"


class CoachContent(Base):
    __tablename__ = "coach_content"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(__import__('uuid').uuid4()))
    coach_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    content_type = Column(SQLEnum(ContentType), nullable=False)
    
    # For articles
    article_body = Column(Text)  # Changed from article_content to match DB
    
    # For videos and images
    file_url = Column(String(500))
    file_name = Column(String(255))
    file_size = Column(Integer)
    mime_type = Column(String(100))
    thumbnail_url = Column(String(500))
    
    # Metadata
    tags = Column(String(500))  # Comma-separated tags
    is_public = Column(Boolean, default=True)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    coach = relationship("User", back_populates="coach_contents")
