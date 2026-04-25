import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base

_ANNOTATION_TYPES = ("line", "circle", "arrow", "text")


class VideoAnnotation(Base):
    __tablename__ = "video_annotations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    video_id = Column(String(36), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True)
    coach_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp_ms = Column(Integer, nullable=False)
    annotation_type = Column(
        Enum(*_ANNOTATION_TYPES, name="annotation_type_enum", native_enum=False),
        nullable=False,
    )
    coordinates = Column(JSON, nullable=False)
    label = Column(String(500), nullable=True)
    color = Column(String(20), nullable=False, default="#FF0000")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    video = relationship("Video", backref="annotations")
    coach = relationship("User", foreign_keys=[coach_id], backref="video_annotations")

    def __repr__(self) -> str:
        return f"<VideoAnnotation {self.id} video={self.video_id} type={self.annotation_type}>"