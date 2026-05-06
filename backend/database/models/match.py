from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from database.config import Base

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    
    # User association
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Match details
    opponent = Column(String, nullable=False)
    match_type = Column(String, nullable=False)  # Practice, Tournament, Friendly
    match_status = Column(String, default="Upcoming")  # Upcoming, Today, Completed, Cancelled, Rescheduled
    
    # Date and time
    match_date = Column(String, nullable=False)
    match_time = Column(String, nullable=False)
    
    # Location
    venue = Column(String, nullable=False)
    location_type = Column(String, default="Home")  # Home, Away, Neutral
    
    # Player info
    player_role = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    
    # Statistics (for completed matches)
    statistics = Column(JSON, nullable=True)  # {runs, wickets, catches, result}
    
    # Reminders
    reminder = Column(String, nullable=True)  # "1 Day Before", "2 Hours Before", "30 Minutes Before"
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
