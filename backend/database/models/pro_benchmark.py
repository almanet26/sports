import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import JSON
from sqlalchemy.sql import func
from database.config import Base


class ProBenchmark(Base):
    """
    Reference biomechanics keypoints for professional cricketers.
    Used by the compare endpoint to compute user-vs-pro delta.

    keypoints_json structure:
      {
        "angles": {
          "front_knee_angle": float,   # degrees
          "shoulder_rotation": float,  # degrees
          "head_alignment": float,     # 0-100 (normalised)
          "stride_length": float,      # 0-100 (normalised)
          "backlift_height": float,    # 0-100 (normalised)
          "elbow_angle": float,        # degrees (bowlers / batters)
          "hip_rotation": float,       # degrees
          ...
        }
      }
    """
    __tablename__ = "pro_benchmarks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pro_name = Column(String(150), nullable=False)
    # "batsman" | "bowler"
    role = Column(String(20), nullable=False)
    keypoints_json = Column(JSON, nullable=False)
    source_video_url = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())