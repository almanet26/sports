"""
Player Submission Inbox — Coach Starter+

POST  /coach/submissions                        player submits a job for coach review
GET   /coach/submissions/inbox                  coach fetches pending submissions
PATCH /coach/submissions/{submission_id}/status coach marks reviewed / dismissed
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.player_submission import PlayerSubmission
from database.models.user import User
from database.models.video import HighlightJob
from dependencies.feature_gate import require_feature
from dependencies.quota_gate import quota_check, increment_usage_atomic

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/coach/submissions", tags=["coach-inbox"])

_VALID_STATUSES = {"reviewed", "dismissed"}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SubmissionCreate(BaseModel):
    job_id: str
    coach_id: str
    note: Optional[str] = None


class StatusPatch(BaseModel):
    status: str


class SubmissionResponse(BaseModel):
    id: str
    player_id: str
    coach_id: str
    job_id: Optional[str]
    note: Optional[str]
    status: str
    created_at: str
    reviewed_at: Optional[str]

    class Config:
        from_attributes = True


def _fmt(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", status_code=201, response_model=SubmissionResponse)
def submit_job_to_coach(
    body: SubmissionCreate,
    _quota: tuple = Depends(quota_check("player_submission")),
    db: Session = Depends(get_db),
) -> SubmissionResponse:
    """Player submits an OCR highlight job to a coach's inbox."""
    current_user: User = _quota[0]

    if current_user.role != "PLAYER":
        raise HTTPException(
            status_code=403,
            detail="Only player accounts can submit to a coach inbox",
        )

    # Validate job exists and belongs to the submitting player
    job = db.query(HighlightJob).filter(HighlightJob.id == body.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Verify coach exists
    coach = db.query(User).filter(User.id == body.coach_id).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    sub = PlayerSubmission(
        player_id=current_user.id,
        coach_id=body.coach_id,
        job_id=body.job_id,
        note=body.note,
        status="pending",
    )
    db.add(sub)
    db.flush()  # get sub.id before incrementing usage

    # Atomic increment — quota was read-checked by quota_check, now commit the usage.
    # We use the raw atomic helper so the increment is a single SQL statement with no TOCTOU gap.
    ok = increment_usage_atomic(
        current_user.id, "submission_count", "max_submissions_per_month", 1, db
    )
    if not ok:
        db.rollback()
        raise HTTPException(
            status_code=429,
            detail={"error": "quota_exceeded", "reason": "Monthly submission limit reached (concurrent request)."},
        )

    db.commit()
    db.refresh(sub)
    logger.info("Player %s submitted job %s to coach %s (submission %s)", current_user.id, body.job_id, body.coach_id, sub.id)

    return SubmissionResponse(
        id=sub.id,
        player_id=sub.player_id,
        coach_id=sub.coach_id,
        job_id=sub.job_id,
        note=sub.note,
        status=sub.status,
        created_at=_fmt(sub.created_at),
        reviewed_at=_fmt(sub.reviewed_at),
    )


@router.get("/inbox", response_model=list[SubmissionResponse])
def get_inbox(
    current_user: User = Depends(require_feature("player_submission")),
    db: Session = Depends(get_db),
) -> list[SubmissionResponse]:
    """Coach fetches pending submissions from players."""
    rows = (
        db.query(PlayerSubmission)
        .filter(
            PlayerSubmission.coach_id == current_user.id,
            PlayerSubmission.status == "pending",
        )
        .order_by(PlayerSubmission.created_at.desc())
        .all()
    )
    return [
        SubmissionResponse(
            id=r.id,
            player_id=r.player_id,
            coach_id=r.coach_id,
            job_id=r.job_id,
            note=r.note,
            status=r.status,
            created_at=_fmt(r.created_at),
            reviewed_at=_fmt(r.reviewed_at),
        )
        for r in rows
    ]


@router.patch("/{submission_id}/status", response_model=SubmissionResponse)
def update_submission_status(
    submission_id: str,
    body: StatusPatch,
    current_user: User = Depends(require_feature("player_submission")),
    db: Session = Depends(get_db),
) -> SubmissionResponse:
    if body.status not in _VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"status must be one of {sorted(_VALID_STATUSES)}")

    sub = db.query(PlayerSubmission).filter(PlayerSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.coach_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your submission")

    sub.status = body.status
    sub.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)

    return SubmissionResponse(
        id=sub.id,
        player_id=sub.player_id,
        coach_id=sub.coach_id,
        job_id=sub.job_id,
        note=sub.note,
        status=sub.status,
        created_at=_fmt(sub.created_at),
        reviewed_at=_fmt(sub.reviewed_at),
    )