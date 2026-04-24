import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class Review(Base):
    __tablename__ = "reviews"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    coach_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    player_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    coach = relationship("User", foreign_keys=[coach_id], backref="coach_reviews")
    player = relationship("User", foreign_keys=[player_id], backref="player_reviews")

    def __repr__(self):
        return f"<Review {self.id} - {self.rating} stars>"
