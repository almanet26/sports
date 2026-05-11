from sqlalchemy import Column, Integer, Float, String, ForeignKey
from sqlalchemy.orm import relationship
from database.config import Base


class PlayerStats(Base):
    __tablename__ = "player_stats"

    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Batting stats
    matches = Column(Integer, default=0)
    runs = Column(Integer, default=0)
    balls_faced = Column(Integer, default=0)
    highest_score = Column(Integer, default=0)
    average = Column(Float, default=0.0)
    strike_rate = Column(Float, default=0.0)

    # Bowling stats
    wickets = Column(Integer, default=0)
    economy_rate = Column(Float, default=0.0)

    # Fielding stats
    catches = Column(Integer, default=0)
    run_outs = Column(Integer, default=0)

    player = relationship("User", foreign_keys=[player_id], backref="player_stats")
