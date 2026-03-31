from sqlalchemy import Column, Integer, String, Text
from database.config import Base

class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    monthly_price = Column(Integer, nullable=False)
    yearly_price = Column(Integer, nullable=False)
    features = Column(Text)
    