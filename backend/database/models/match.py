from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from database.config import Base


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    created_by = Column(String(36), nullable=False, index=True)
    opponent = Column(String, nullable=False)
    match_type = Column(String, default="Practice")
    match_status = Column(String, default="Upcoming")
    match_date = Column(String, nullable=False)
    match_time = Column(String, nullable=False)
    venue = Column(String, nullable=False)
    location_type = Column(String, default="Home")
    player_role = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    reminder = Column(String, nullable=True)
    statistics = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
