"""
PDF Report Download — Platinum+

GET /batting/{analysis_id}/report
GET /bowling/{analysis_id}/report

PDFs are generated during the worker pipeline and stored in the
pdf_report_url column of batting_analyses / bowling_analyses.

This endpoint extracts the GCS blob path from that column and returns
a 15-minute signed URL for direct client download.

pdf_report_url formats handled:
  gs://bucket-name/reports/…/file.pdf  →  strip gs://bucket/ prefix
  reports/user_id/job_id.pdf           →  use as blob name directly
  /static/reports/file.pdf             →  GCS unavailable / dev mode; return raw path
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.batting import BattingAnalysis
from database.models.bowling import BowlingAnalysis
from database.models.user import User
from dependencies.feature_gate import require_feature

logger = logging.getLogger(__name__)

router = APIRouter(tags=["report"])

_GCS_BUCKET: str = os.getenv("GCS_BUCKET_NAME", "")

_gcs = None


def _get_gcs():
    global _gcs
    if _gcs is not None:
        return _gcs
    if not _GCS_BUCKET:
        return None
    try:
        from services.gcs_storage_service import GCSStorageManager
        _gcs = GCSStorageManager(_GCS_BUCKET)
        return _gcs
    except Exception as exc:
        logger.warning("GCS init failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

class ReportUrlResponse(BaseModel):
    url: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sign_or_return(report_url: str) -> str:
    """
    Convert a stored pdf_report_url into a usable download URL.

    - gs://bucket/path   → signed URL via GCSStorageManager
    - path/to/blob.pdf   → signed URL (treated as blob name)
    - /static/...        → returned as-is (dev; GCS not configured)
    """
    if not report_url:
        raise ValueError("empty report_url")

    # Local static path — no GCS available in dev
    if report_url.startswith("/static/") or report_url.startswith("http"):
        return report_url

    gcs = _get_gcs()

    # Extract blob name
    blob_name = report_url
    if report_url.startswith("gs://"):
        # gs://bucket-name/path/to/file.pdf
        after_scheme = report_url[5:]           # bucket-name/path/to/file.pdf
        slash = after_scheme.find("/")
        if slash == -1:
            raise ValueError(f"Malformed GCS URI: {report_url}")
        blob_name = after_scheme[slash + 1:]    # path/to/file.pdf

    if gcs is None:
        # GCS library not available — best effort: return raw path
        return report_url

    return gcs.get_signed_url(blob_name, expiration_minutes=15)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/batting/{analysis_id}/report", response_model=ReportUrlResponse)
def batting_report(
    analysis_id: str,
    current_user: User = Depends(require_feature("pdf_report")),
    db: Session = Depends(get_db),
) -> ReportUrlResponse:
    """Return a 15-minute signed download URL for a batting analysis PDF."""
    analysis: Optional[BattingAnalysis] = (
        db.query(BattingAnalysis)
        .filter(
            BattingAnalysis.id == analysis_id,
            BattingAnalysis.player_id == current_user.id,
        )
        .first()
    )
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if not analysis.report_url:
        raise HTTPException(status_code=404, detail="PDF not yet generated for this analysis")

    try:
        url = _sign_or_return(analysis.report_url)
    except Exception as exc:
        logger.error("Failed to sign batting report %s: %s", analysis_id, exc)
        raise HTTPException(status_code=500, detail="Could not generate download URL")

    return ReportUrlResponse(url=url)


@router.get("/bowling/{analysis_id}/report", response_model=ReportUrlResponse)
def bowling_report(
    analysis_id: str,
    current_user: User = Depends(require_feature("pdf_report")),
    db: Session = Depends(get_db),
) -> ReportUrlResponse:
    """Return a 15-minute signed download URL for a bowling analysis PDF."""
    analysis: Optional[BowlingAnalysis] = (
        db.query(BowlingAnalysis)
        .filter(
            BowlingAnalysis.id == analysis_id,
            BowlingAnalysis.player_id == current_user.id,
        )
        .first()
    )
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if not analysis.report_url:
        raise HTTPException(status_code=404, detail="PDF not yet generated for this analysis")

    try:
        url = _sign_or_return(analysis.report_url)
    except Exception as exc:
        logger.error("Failed to sign bowling report %s: %s", analysis_id, exc)
        raise HTTPException(status_code=500, detail="Could not generate download URL")

    return ReportUrlResponse(url=url)