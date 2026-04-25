"""
Video Annotation endpoints — Coach Starter+

POST   /annotations                  create annotation
GET    /annotations/{video_id}        fetch all for a video
PUT    /annotations/{annotation_id}   update coordinates / label
DELETE /annotations/{annotation_id}   owner-only delete
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.user import User
from database.models.video import Video
from database.models.video_annotation import VideoAnnotation
from dependencies.feature_gate import require_feature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/annotations", tags=["annotations"])

_ANNOTATION_TYPES = {"line", "circle", "arrow", "text"}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AnnotationCreate(BaseModel):
    video_id: str
    timestamp_ms: int
    annotation_type: str
    coordinates: Any           # free-form JSON: list of points / shape params
    label: Optional[str] = None
    color: str = "#FF0000"


class AnnotationUpdate(BaseModel):
    coordinates: Optional[Any] = None
    label: Optional[str] = None
    color: Optional[str] = None


class AnnotationResponse(BaseModel):
    id: str
    video_id: str
    coach_id: str
    timestamp_ms: int
    annotation_type: str
    coordinates: Any
    label: Optional[str]
    color: str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=AnnotationResponse, status_code=201)
def create_annotation(
    body: AnnotationCreate,
    current_user: User = Depends(require_feature("video_annotation")),
    db: Session = Depends(get_db),
) -> AnnotationResponse:
    if body.annotation_type not in _ANNOTATION_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"annotation_type must be one of {sorted(_ANNOTATION_TYPES)}",
        )

    video = db.query(Video).filter(Video.id == body.video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    ann = VideoAnnotation(
        video_id=body.video_id,
        coach_id=current_user.id,
        timestamp_ms=body.timestamp_ms,
        annotation_type=body.annotation_type,
        coordinates=body.coordinates,
        label=body.label,
        color=body.color,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    logger.info("Annotation %s created by coach %s on video %s", ann.id, current_user.id, body.video_id)
    return ann


@router.get("/{video_id}", response_model=list[AnnotationResponse])
def list_annotations(
    video_id: str,
    current_user: User = Depends(require_feature("video_annotation")),
    db: Session = Depends(get_db),
) -> list[AnnotationResponse]:
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    return (
        db.query(VideoAnnotation)
        .filter(VideoAnnotation.video_id == video_id)
        .order_by(VideoAnnotation.timestamp_ms)
        .all()
    )


@router.put("/{annotation_id}", response_model=AnnotationResponse)
def update_annotation(
    annotation_id: str,
    body: AnnotationUpdate,
    current_user: User = Depends(require_feature("video_annotation")),
    db: Session = Depends(get_db),
) -> AnnotationResponse:
    ann = db.query(VideoAnnotation).filter(VideoAnnotation.id == annotation_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")
    if ann.coach_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your annotation")

    if body.coordinates is not None:
        ann.coordinates = body.coordinates
    if body.label is not None:
        ann.label = body.label
    if body.color is not None:
        ann.color = body.color

    db.commit()
    db.refresh(ann)
    return ann


@router.delete("/{annotation_id}", status_code=204)
def delete_annotation(
    annotation_id: str,
    current_user: User = Depends(require_feature("video_annotation")),
    db: Session = Depends(get_db),
) -> None:
    ann = db.query(VideoAnnotation).filter(VideoAnnotation.id == annotation_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")
    if ann.coach_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your annotation")

    db.delete(ann)
    db.commit()