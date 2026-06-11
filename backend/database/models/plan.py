"""
Plan model — a sellable subscription plan in the dynamic entitlement engine.

Replaces the static plan_config table.  Quotas/feature access are no longer hardcoded columns; they live in plan_entitlements (one row per feature).
"""

from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy import DateTime

from database.config import Base

USER_TYPE_VALUES = ("player", "coach")
BILLING_PERIOD_VALUES = ("monthly", "annual")


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Stable machine name (e.g. "bronze", "coach_platinum").  Unique, immutable.
    key = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    # 'player' or 'coach' — restricts which account type may subscribe.
    user_type = Column(String(10), nullable=False)
    # Price in paise (e.g. 20000 = ₹200).
    price_inr = Column(Integer, nullable=False, default=0)
    # 'monthly' or 'annual' — used by the expiry sweep to compute renewal windows.
    billing_period = Column(String(10), nullable=False, default="monthly")
    razorpay_plan_id = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    # Display ordering; also doubles as a coarse tier rank within a user_type.
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    entitlements = relationship(
        "PlanEntitlement",
        back_populates="plan",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Plan {self.key} ({self.user_type})>"
