from sqlalchemy import Column, Integer, ForeignKey, DateTime, String
from datetime import datetime
from database.config import Base

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(String, ForeignKey("users.id"))
    plan_id = Column(Integer, ForeignKey("plans.id"))

    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime)
    