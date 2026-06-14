"""
FeatureUsage — normalized per-feature monthly consumption counter.

Replaces the static monthly_usage table (which had hardcoded columns).  Each
row tracks how much of one numeric feature a user has consumed in one calendar month, so admin-created numeric features are metered automatically with no schema change.

`period_start` is the first day of the calendar month (date).  All numeric quotas reset monthly regardless of the plan's billing_period.
"""

from sqlalchemy import Column, Date, Float, ForeignKey, Integer, String, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from database.config import Base


class FeatureUsage(Base):
    __tablename__ = "feature_usage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    feature_id = Column(
        Integer,
        ForeignKey("features.id", ondelete="CASCADE"),
        nullable=False,
    )
    period_start = Column(Date, nullable=False)
    used = Column(Float, nullable=False, default=0.0, server_default="0")

    feature = relationship("Feature")

    __table_args__ = (
        UniqueConstraint(
            "user_id", "feature_id", "period_start",
            name="uq_feature_usage_user_feature_period",
        ),
        Index("ix_feature_usage_user_period", "user_id", "period_start"),
    )

    def __repr__(self) -> str:
        return f"<FeatureUsage user={self.user_id} feature={self.feature_id} used={self.used}>"
