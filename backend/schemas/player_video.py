from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class PlayerVideoResponse(BaseModel):
    id: str
    title: str
    url: str
    uploadedAt: Optional[datetime]
    status: str
    thumbnailUrl: Optional[str] = None


class PlayerVideoUploadEnvelope(BaseModel):
    success: bool = True
    message: str = "Video uploaded successfully"
    video: PlayerVideoResponse


class PlayerVideoListEnvelope(BaseModel):
    success: bool = True
    videos: List[PlayerVideoResponse] = Field(default_factory=list)


class PlayerVideoDeleteEnvelope(BaseModel):
    success: bool = True
    message: str = "Video deleted successfully"
