from sqlalchemy import Column, Integer, Float, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from database.config import Base


class MonthlyUsage(Base):
    __tablename__ = "monthly_usage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)

    biomech_count = Column(Integer, nullable=False, default=0, server_default="0")
    ocr_hours_used = Column(Float, nullable=False, default=0.0, server_default="0")
    submission_count = Column(Integer, nullable=False, default=0, server_default="0")

    user = relationship("User", back_populates="monthly_usages")

    __table_args__ = (
        UniqueConstraint("user_id", "year", "month", name="uq_monthly_usage_user_year_month"),
    )
