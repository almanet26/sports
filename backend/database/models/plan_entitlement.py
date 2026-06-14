"""
PlanEntitlement — join row mapping a Plan to a Feature with a value.

`value` is stored as text and interpreted by the feature's type:
  - boolean feature → "true" / "false"
  - numeric feature → an integer/float string; "-1" means unlimited, "0" means none.

Helper accessors parse the stored string into the right Python type.
"""

from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from database.config import Base


class PlanEntitlement(Base):
    __tablename__ = "plan_entitlements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_id = Column(
        Integer,
        ForeignKey("plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    feature_id = Column(
        Integer,
        ForeignKey("features.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    value = Column(String(50), nullable=False, default="false")

    plan = relationship("Plan", back_populates="entitlements")
    feature = relationship("Feature", back_populates="entitlements")

    __table_args__ = (
        UniqueConstraint("plan_id", "feature_id", name="uq_plan_entitlement_plan_feature"),
    )

    # ── Value parsing helpers ────────────────────────────────────────────────
    def as_bool(self) -> bool:
        return str(self.value).strip().lower() in ("true", "1", "yes")

    def as_number(self) -> float:
        try:
            return float(self.value)
        except (TypeError, ValueError):
            return 0.0

    def __repr__(self) -> str:
        return f"<PlanEntitlement plan={self.plan_id} feature={self.feature_id} value={self.value!r}>"
