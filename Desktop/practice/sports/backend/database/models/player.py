from sqlalchemy import Column, Integer, String, ForeignKey
from backend.database.config import Base

class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    role = Column(String)  # batsman / bowler / all-rounder
    team = Column(String)
    photo = Column(String, nullable=True)

    runs = Column(Integer, default=0)
    wickets = Column(Integer, default=0)
    matches = Column(Integer, default=0)

    strike_rate = Column(Integer, default=0)
