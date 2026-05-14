import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base
import enum


class TransactionType(str, enum.Enum):
    SESSION = "session"
    TRAINING_PLAN = "training_plan"
    SUBSCRIPTION = "subscription"
    CONTENT = "content"


class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    coach_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    player_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    transaction_type = Column(SQLEnum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(SQLEnum(TransactionStatus), default=TransactionStatus.PENDING, nullable=False)
    
    description = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    coach = relationship("User", foreign_keys=[coach_id], backref="coach_transactions")
    player = relationship("User", foreign_keys=[player_id], backref="player_transactions")

    def __repr__(self):
        return f"<Transaction {self.id} - {self.amount} - {self.status}>"
