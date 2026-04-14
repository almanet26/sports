import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class CoachContent(Base):
    __tablename__ = "coach_content"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    coach_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    content_type = Column(String(20), nullable=False, default="video")  # video | document | drill
    file_url = Column(Text, nullable=True)
    file_size = Column(String(50), nullable=True)   # e.g. "12.4 MB"
    views = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    coach = relationship("User", foreign_keys=[coach_id])
