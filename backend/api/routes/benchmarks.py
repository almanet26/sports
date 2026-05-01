"""
Pro Benchmarking — Platinum+

GET  /benchmarks                   list all available pro benchmarks
POST /batting/{analysis_id}/compare  compare a batting analysis against a pro
POST /bowling/{analysis_id}/compare  compare a bowling analysis against a pro

compare_keypoints() is a pure function that works on any two angle dicts;
it only compares keys that exist in BOTH dictionaries.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.batting import BattingAnalysis
from database.models.bowling import BowlingAnalysis
from database.models.pro_benchmark import ProBenchmark
from database.models.user import User
from dependencies.feature_gate import require_feature

logger = logging.getLogger(__name__)

router = APIRouter(tags=["benchmarks"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BenchmarkSummary(BaseModel):
    id: str
    pro_name: str
    role: str  # "batsman" | "bowler"


class CompareRequest(BaseModel):
    pro_id: str


class CompareResponse(BaseModel):
    analysis_id: str
    pro_id: str
    pro_name: str
    joint_deltas: dict[str, float]
    similarity_score: float


# ---------------------------------------------------------------------------
# Pure comparison logic
# ---------------------------------------------------------------------------

def compare_keypoints(user_kp: dict[str, Any], pro_kp: dict[str, Any]) -> dict[str, Any]:
    """
    Compute per-joint angle deltas and a scalar similarity score.

    Both dicts must contain an "angles" key mapping joint names to floats.
    Only joints present in BOTH dicts contribute to the result.

    similarity_score = 1 − RMS(deltas) / 90, clamped to [0, 1].
    90° is treated as the maximum meaningful single-joint deviation.

    Returns:
        {
          "joint_deltas":    {"left_knee_angle": +12.3, ...},  # user − pro
          "similarity_score": 0.74,
        }
    """
    user_angles: dict[str, float] = user_kp.get("angles", {})
    pro_angles: dict[str, float] = pro_kp.get("angles", {})

    common = sorted(set(user_angles) & set(pro_angles))
    joint_deltas = {
        joint: round(float(user_angles[joint]) - float(pro_angles[joint]), 2)
        for joint in common
    }

    if joint_deltas:
        rms = (sum(d ** 2 for d in joint_deltas.values()) / len(joint_deltas)) ** 0.5
        similarity_score = round(max(0.0, min(1.0, 1.0 - rms / 90.0)), 2)
    else:
        similarity_score = 0.0

    return {"joint_deltas": joint_deltas, "similarity_score": similarity_score}


# ---------------------------------------------------------------------------
# Keypoint extractors — normalise the DB scalar fields to an "angles" dict
# so compare_keypoints() receives a homogeneous structure.
# ---------------------------------------------------------------------------

def _batting_kp(a: BattingAnalysis) -> dict:
    """
    Map BattingAnalysis scalar columns to the shared angles dict.

    head_alignment, stride_length, backlift_height are 0-1 normalised
    MediaPipe values; multiply by 100 to put them on the same 0-100 scale
    as the seeded pro benchmark data.
    """
    return {
        "angles": {
            "front_knee_angle":  a.avg_front_knee_angle  or 0.0,
            "shoulder_rotation": a.avg_shoulder_rotation or 0.0,
            "head_alignment":    (a.avg_head_alignment   or 0.0) * 100.0,
            "stride_length":     (a.avg_stride_length    or 0.0) * 100.0,
            "backlift_height":   (a.avg_backlift_height  or 0.0) * 100.0,
        }
    }


def _bowling_kp(a: BowlingAnalysis) -> dict:
    """
    Map BowlingAnalysis scalar columns to the shared angles dict.

    release_consistency is 0-1; multiply by 100 to match seeded pro values.
    """
    return {
        "angles": {
            "elbow_angle":         a.avg_elbow_angle      or 0.0,
            "release_consistency": (a.release_consistency or 0.0) * 100.0,
        }
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/benchmarks", response_model=list[BenchmarkSummary])
def list_benchmarks(
    current_user: User = Depends(require_feature("pro_benchmarking")),
    db: Session = Depends(get_db),
) -> list[BenchmarkSummary]:
    """List all available pro benchmark profiles."""
    rows = (
        db.query(ProBenchmark)
        .order_by(ProBenchmark.role, ProBenchmark.pro_name)
        .all()
    )
    return [BenchmarkSummary(id=r.id, pro_name=r.pro_name, role=r.role) for r in rows]


@router.post("/batting/{analysis_id}/compare", response_model=CompareResponse)
def compare_batting(
    analysis_id: str,
    body: CompareRequest,
    current_user: User = Depends(require_feature("pro_benchmarking")),
    db: Session = Depends(get_db),
) -> CompareResponse:
    """Compare a batting analysis against a pro batsman benchmark."""
    analysis: Optional[BattingAnalysis] = (
        db.query(BattingAnalysis)
        .filter(
            BattingAnalysis.id == analysis_id,
            BattingAnalysis.player_id == current_user.id,
        )
        .first()
    )
    if analysis is None:
        raise HTTPException(status_code=404, detail="Batting analysis not found")

    pro: Optional[ProBenchmark] = (
        db.query(ProBenchmark).filter(ProBenchmark.id == body.pro_id).first()
    )
    if pro is None:
        raise HTTPException(status_code=404, detail="Pro benchmark not found")
    if pro.role != "batsman":
        raise HTTPException(
            status_code=422,
            detail=f"Pro '{pro.pro_name}' is a {pro.role} — use a batsman benchmark for batting analysis",
        )

    result = compare_keypoints(_batting_kp(analysis), pro.keypoints_json)
    return CompareResponse(
        analysis_id=analysis_id,
        pro_id=pro.id,
        pro_name=pro.pro_name,
        joint_deltas=result["joint_deltas"],
        similarity_score=result["similarity_score"],
    )


@router.post("/bowling/{analysis_id}/compare", response_model=CompareResponse)
def compare_bowling(
    analysis_id: str,
    body: CompareRequest,
    current_user: User = Depends(require_feature("pro_benchmarking")),
    db: Session = Depends(get_db),
) -> CompareResponse:
    """Compare a bowling analysis against a pro bowler benchmark."""
    analysis: Optional[BowlingAnalysis] = (
        db.query(BowlingAnalysis)
        .filter(
            BowlingAnalysis.id == analysis_id,
            BowlingAnalysis.player_id == current_user.id,
        )
        .first()
    )
    if analysis is None:
        raise HTTPException(status_code=404, detail="Bowling analysis not found")

    pro: Optional[ProBenchmark] = (
        db.query(ProBenchmark).filter(ProBenchmark.id == body.pro_id).first()
    )
    if pro is None:
        raise HTTPException(status_code=404, detail="Pro benchmark not found")
    if pro.role != "bowler":
        raise HTTPException(
            status_code=422,
            detail=f"Pro '{pro.pro_name}' is a {pro.role} — use a bowler benchmark for bowling analysis",
        )

    result = compare_keypoints(_bowling_kp(analysis), pro.keypoints_json)
    return CompareResponse(
        analysis_id=analysis_id,
        pro_id=pro.id,
        pro_name=pro.pro_name,
        joint_deltas=result["joint_deltas"],
        similarity_score=result["similarity_score"],
    )