from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.config import Base


class AcademyBranding(Base):
    __tablename__ = "academy_branding"

    academy_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    logo_gcs_path = Column(String(512), nullable=True)
    primary_color = Column(String(20), nullable=False, default="#1a73e8")
    report_footer_text = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    academy = relationship("User", backref="branding")

    def __repr__(self) -> str:
        return f"<AcademyBranding academy={self.academy_id}>"