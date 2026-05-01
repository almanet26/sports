from sqlalchemy import Column, Integer, Float, String, Enum

from database.config import Base
from database.models.enums import ROLE_VALUES


class PlanConfig(Base):
    __tablename__ = "plan_config"

    plan_key = Column(String(50), primary_key=True)
    role = Column(
        Enum(*ROLE_VALUES, name="plan_config_role_enum", native_enum=False),
        nullable=False,
    )
    display_name = Column(String(100), nullable=False)
    price_inr = Column(Integer, nullable=False)
    duration_days = Column(Integer, nullable=False)

    max_biomech_per_month = Column(Integer, nullable=False)
    max_ocr_hours_per_month = Column(Float, nullable=False)
    max_submissions_per_month = Column(Integer, nullable=False)
    max_players_in_dashboard = Column(Integer, nullable=False)
