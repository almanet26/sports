import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.config import Base


class PlayerProfile(Base):
    __tablename__ = "player_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    username = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(50), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    cricket_role = Column(String(100), nullable=True)
    experience_level = Column(String(100), nullable=True)
    batting_hand = Column(String(100), nullable=True)
    bowling_arm = Column(String(100), nullable=True)
    bowling_type = Column(String(100), nullable=True)
    preferred_format = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    profile_photo = Column(String(500), nullable=True)

    # New fields
    education_type = Column(String(50), nullable=True)       # School / College / Other
    institution_name = Column(String(255), nullable=True)    # school or college name
    has_cricket_club = Column(Boolean, nullable=True)        # True / False
    cricket_club_name = Column(String(255), nullable=True)   # club name if has_cricket_club

    verified = Column(Boolean, default=False, nullable=False)
    matches = Column(Integer, default=0, nullable=False)
    highlights = Column(Integer, default=0, nullable=False)
    current_level = Column(String(100), default="Beginner", nullable=False)
    completion_percentage = Column(Integer, default=0, nullable=False)
    profile_completed = Column(Boolean, default=False, nullable=False)
    missing_fields = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="player_profile")

    def __repr__(self) -> str:
        return f"<PlayerProfile user_id={self.user_id} email={self.email}>"
