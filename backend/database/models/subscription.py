from sqlalchemy import Column, Integer, ForeignKey, DateTime, String, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base
from database.models.enums import ROLE_VALUES, SUBSCRIPTION_STATUS_VALUES

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    plan_key = Column(String(50), nullable=False)
    role = Column(
        Enum(*ROLE_VALUES, name="subscription_role_enum", native_enum=False),
        nullable=False,
    )
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

    user = relationship("User", back_populates="subscription")
    