from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from database.config import Base


class PlayerPerformanceEntry(Base):
    __tablename__ = "player_performance_entries"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    # Match info
    opponent = Column(String, nullable=False)
    match_date = Column(String, nullable=False)
    match_type = Column(String, default="Practice")  # Practice, Tournament, Friendly

    # Batting stats
    runs = Column(Integer, default=0)
    fours = Column(Integer, default=0)
    sixes = Column(Integer, default=0)
    balls_faced = Column(Integer, default=0)

    # Bowling stats
    wickets = Column(Integer, default=0)
    overs_bowled = Column(Float, default=0.0)
    runs_conceded = Column(Integer, default=0)

    # Fielding stats
    catches = Column(Integer, default=0)
    run_outs = Column(Integer, default=0)

    # Result
    result = Column(String, default="Won")  # Won / Lost / Draw

    created_at = Column(DateTime(timezone=True), server_default=func.now())
