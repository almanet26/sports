from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base
from database.models.enums import SUBSCRIPTION_STATUS_VALUES


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    # unique=True removed — a user may have multiple rows (subscription history).
    # All queries must filter by status='active' and expires_at > NOW() to obtain the current subscription.  Use get_active_subscription() from dependencies/feature_gate.py rather than querying directly.
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Authoritative link to the dynamic plan (entitlement engine reads via this).
    # ON DELETE RESTRICT — a plan with active subscribers cannot be deleted without an explicit migration (see admin_plans.delete_plan).
    plan_id = Column(
        Integer,
        ForeignKey("plans.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # plan_key / role are denormalized mirrors of the linked plan's key, kept so legacy reads (sub.role, sub.plan_key) keep working.  Free-form strings (not a bounded enum) so admin-created plans with any key can be mirrored here; plan_id is the authoritative link.
    plan_key = Column(String(50), nullable=False)
    role = Column(String(50), nullable=False)
    status = Column(
        Enum(*SUBSCRIPTION_STATUS_VALUES, name="subscription_status_enum", native_enum=False),
        nullable=False,
        default="inactive",
        server_default="inactive",
    )

    started_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    razorpay_order_id = Column(String(255), nullable=True)
    razorpay_payment_id = Column(String(255), nullable=True)
    razorpay_customer_id = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # One user → many subscription history rows.
    user = relationship("User", back_populates="subscriptions")
    # The linked plan (may be None for legacy rows until backfilled).
    plan = relationship("Plan")