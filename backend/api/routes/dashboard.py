"""
Coach Dashboard — Coach Starter+

POST   /dashboard/players/invite           add player to roster
GET    /dashboard/players                  paginated roster with live stats
DELETE /dashboard/players/{player_id}      remove player from roster
GET    /dashboard/export?format=csv        streaming CSV export (Coach Pro+)
"""

from __future__ import annotations

import csv
import io
import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.batting import BattingAnalysis
from database.models.bowling import BowlingAnalysis
from database.models.coach_player import CoachPlayer
from database.models.monthly_usage import MonthlyUsage
from database.models.user import User
from database.models.video import HighlightJob, VideoStatus
from dependencies.feature_gate import require_feature, get_active_subscription

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_COACH_STARTER_CAP = 10   # max roster size for coach_starter plan


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class InviteRequest(BaseModel):
    player_id: str


class PlayerStats(BaseModel):
    player_id: str
    name: str
    email: str
    latest_job_status: Optional[str]
    biomech_count_this_month: int
    last_active: Optional[str]          # ISO date string of most recent job


class RosterPage(BaseModel):
    players: list[PlayerStats]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _latest_job_for(player_id: str, db: Session) -> Optional[HighlightJob]:
    return (
        db.query(HighlightJob)
        .join(HighlightJob.video)
        .filter(HighlightJob.video.has(uploaded_by=player_id))
        .order_by(HighlightJob.created_at.desc())
        .first()
    )


def _biomech_this_month(player_id: str, db: Session) -> int:
    today = date.today()
    row = (
        db.query(MonthlyUsage)
        .filter(
            MonthlyUsage.user_id == player_id,
            MonthlyUsage.year == today.year,
            MonthlyUsage.month == today.month,
        )
        .first()
    )
    return row.biomech_count if row else 0


def _player_stats(entry: CoachPlayer, db: Session) -> PlayerStats:
    player: User = entry.player
    job = _latest_job_for(player.id, db)
    return PlayerStats(
        player_id=player.id,
        name=player.name,
        email=player.email,
        latest_job_status=job.status if job else None,
        biomech_count_this_month=_biomech_this_month(player.id, db),
        last_active=job.created_at.date().isoformat() if job and job.created_at else None,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/players/invite", status_code=201)
def invite_player(
    body: InviteRequest,
    current_user: User = Depends(require_feature("player_dashboard")),
    db: Session = Depends(get_db),
) -> dict:
    # Verify player exists
    player = db.query(User).filter(User.id == body.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Enforce coach_starter cap — check subscription tier, not account type
    sub = get_active_subscription(current_user, db)
    if sub and sub.role == "coach_starter":
        count = (
            db.query(func.count(CoachPlayer.player_id))
            .filter(CoachPlayer.coach_id == current_user.id)
            .scalar()
        )
        if count >= _COACH_STARTER_CAP:
            raise HTTPException(
                status_code=403,
                detail="Player limit reached for your plan",
            )

    # Idempotent insert — ignore if already on roster
    existing = (
        db.query(CoachPlayer)
        .filter(
            CoachPlayer.coach_id == current_user.id,
            CoachPlayer.player_id == body.player_id,
        )
        .first()
    )
    if existing:
        return {"detail": "Player already on roster"}

    db.add(CoachPlayer(coach_id=current_user.id, player_id=body.player_id))
    db.commit()
    logger.info("Coach %s added player %s to roster", current_user.id, body.player_id)
    return {"detail": "Player added to roster"}


@router.get("/players", response_model=RosterPage)
def list_roster(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_feature("player_dashboard")),
    db: Session = Depends(get_db),
) -> RosterPage:
    base = db.query(CoachPlayer).filter(CoachPlayer.coach_id == current_user.id)
    total = base.count()
    entries = (
        base.order_by(CoachPlayer.added_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return RosterPage(
        players=[_player_stats(e, db) for e in entries],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete("/players/{player_id}", status_code=204)
def remove_player(
    player_id: str,
    current_user: User = Depends(require_feature("player_dashboard")),
    db: Session = Depends(get_db),
) -> None:
    entry = (
        db.query(CoachPlayer)
        .filter(
            CoachPlayer.coach_id == current_user.id,
            CoachPlayer.player_id == player_id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Player not on your roster")
    db.delete(entry)
    db.commit()
    logger.info("Coach %s removed player %s from roster", current_user.id, player_id)


# ---------------------------------------------------------------------------
# CSV export — Coach Pro+
# ---------------------------------------------------------------------------

@router.get("/export")
def export_roster_csv(
    format: str = Query("csv"),
    current_user: User = Depends(require_feature("csv_export")),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    if format != "csv":
        raise HTTPException(status_code=422, detail="Only format=csv is supported")

    three_months_ago = date.today() - timedelta(days=90)
    coach_id = current_user.id

    def _generate():
        buf = io.StringIO()
        writer = csv.writer(buf)

        writer.writerow([
            "player_id", "name", "email",
            "biomech_count_3m",
            "avg_front_knee_angle", "avg_shoulder_rotation",
            "avg_head_alignment", "avg_stride_length", "avg_backlift_height",
            "avg_elbow_angle", "release_consistency",
        ])
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)

        entries = (
            db.query(CoachPlayer)
            .filter(CoachPlayer.coach_id == coach_id)
            .all()
        )

        for entry in entries:
            player: User = entry.player

            # --- 3-month biomech totals ----------------------------------
            today = date.today()
            usage_rows = (
                db.query(MonthlyUsage)
                .filter(
                    MonthlyUsage.user_id == player.id,
                    MonthlyUsage.year >= three_months_ago.year,
                )
                .all()
            )
            biomech_3m = sum(
                r.biomech_count for r in usage_rows
                if date(r.year, r.month, 1) >= three_months_ago.replace(day=1)
            )

            # --- avg joint angles from most recent batting analysis ------
            bat: Optional[BattingAnalysis] = (
                db.query(BattingAnalysis)
                .filter(BattingAnalysis.player_id == player.id)
                .order_by(BattingAnalysis.created_at.desc())
                .first()
            )

            bowl: Optional[BowlingAnalysis] = (
                db.query(BowlingAnalysis)
                .filter(BowlingAnalysis.player_id == player.id)
                .order_by(BowlingAnalysis.created_at.desc())
                .first()
            )

            writer.writerow([
                player.id,
                player.name,
                player.email,
                biomech_3m,
                bat.avg_front_knee_angle if bat else "",
                bat.avg_shoulder_rotation if bat else "",
                bat.avg_head_alignment if bat else "",
                bat.avg_stride_length if bat else "",
                bat.avg_backlift_height if bat else "",
                bowl.avg_elbow_angle if bowl else "",
                bowl.release_consistency if bowl else "",
            ])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    return StreamingResponse(
        _generate(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="roster_export.csv"'},
    )