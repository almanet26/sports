from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class PlayerProfile(Base):
    """
    Player-facing profile and scouting visibility record.

    Identity fields are set by the player.
    Performance stats (avg_bat_speed etc.) are written by the biomech worker
    after analysis completes — never accepted from user input.
    """
    __tablename__ = "player_profiles"

    # One-to-one with users — user_id is both PK and FK.
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Player-editable identity
    display_name = Column(String(150), nullable=True)
    city = Column(String(100), nullable=True)
    bat_style = Column(String(50), nullable=True)   # "Right-hand" | "Left-hand"
    bowl_style = Column(String(80), nullable=True)  # "Right-arm fast" | "Leg-break" | …

    # Worker-written performance stats
    avg_bat_speed = Column(Float, nullable=True)
    peak_bat_speed = Column(Float, nullable=True)
    avg_release_height = Column(Float, nullable=True)
    avg_wrist_speed = Column(Float, nullable=True)

    scouting_visible = Column(Boolean, nullable=False, default=False, server_default="false")
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="player_profile")