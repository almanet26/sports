from sqlalchemy import Column, String, Float, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class PlayerProfile(Base):
    """
    Player-facing profile and scouting visibility record.

    Identity fields are set by the player via POST /profile/setup.
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

    # ── Player-editable identity ──────────────────────────────────────────────
    display_name = Column(String(150), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    age = Column(Integer, nullable=True)
    bat_style = Column(String(50), nullable=True)    # "right_hand" | "left_hand"
    bowl_style = Column(String(80), nullable=True)   # "right_arm_fast" | "left_arm_spin" | …
    cricket_role = Column(String(30), nullable=True) # batsman | bowler | all_rounder | wicket_keeper
    experience_level = Column(String(30), nullable=True)  # beginner | intermediate | advanced | professional
    preferred_format = Column(String(10), nullable=True)  # T20 | ODI | Test | All
    profile_image_url = Column(String(500), nullable=True)

    # ── Worker-written performance stats (raw from analyses) ──────────────────
    avg_bat_speed = Column(Float, nullable=True)
    peak_bat_speed = Column(Float, nullable=True)
    avg_release_height = Column(Float, nullable=True)
    avg_wrist_speed = Column(Float, nullable=True)

    # ── Worker-written aggregate stats (computed across all analyses) ──────────
    best_front_knee_angle = Column(Float, nullable=True)
    best_shoulder_rotation = Column(Float, nullable=True)
    best_elbow_angle = Column(Float, nullable=True)
    best_release_consistency = Column(Float, nullable=True)
    total_analyses = Column(Integer, nullable=True, default=0)
    analyses_last_updated = Column(DateTime(timezone=True), nullable=True)

    # ── Scouting visibility (player opt-in) ───────────────────────────────────
    scouting_visible = Column(Boolean, nullable=False, default=False, server_default="false")

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship("User", back_populates="player_profile")