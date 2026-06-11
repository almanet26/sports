"""
Feature model — the master catalog of enforceable platform capabilities.

A feature is either:
  - 'boolean' — an on/off capability (e.g. ai_chat, csv_export).
  - 'numeric' — a metered quota (e.g. biomechanics_analysis, ocr_highlights).

Admins can create new features at runtime; the entitlement engine and gates resolve everything dynamically by feature.key, so no code change is required to start gating on a newly created boolean feature.
"""

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.config import Base

FEATURE_TYPE_VALUES = ("boolean", "numeric")


class Feature(Base):
    __tablename__ = "features"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Stable machine name used by require_feature("...") / quota_check("...").
    key = Column(String(64), unique=True, nullable=False, index=True)
    display_name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    # 'boolean' | 'numeric'
    type = Column(String(10), nullable=False, default="boolean")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    entitlements = relationship(
        "PlanEntitlement",
        back_populates="feature",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Feature {self.key} ({self.type})>"
