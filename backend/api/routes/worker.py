"""
Internal Worker — Async Video Processing Endpoint, Called by Google Cloud Tasks (NOT by the frontend directly).
Downloads the video from GCS → runs MediaPipe + Gemini → uploads PDF → updates DB.

Endpoint:
  POST /internal/worker/process-video
  Body: { "submission_id": "...", "blob_name": "raw_videos/..." }

Security:
  Protected by an OIDC token check (Cloud Tasks → Cloud Run).
  In dev/staging you can set WORKER_AUTH_SECRET as a shared-secret fallback.

Environment Variables:
  GCS_BUCKET_NAME                — bucket holding raw videos + reports
  GOOGLE_APPLICATION_CREDENTIALS — service-account key (omit on Cloud Run)
  WORKER_AUTH_SECRET              — optional shared secret for non-OIDC envs
"""

import logging
import os
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import SessionLocal
from database.models.submission import VideoSubmission, SubmissionStatus
from database.crud.submission import (
    get_submission_by_id,
    mark_processing,
    save_analysis_results,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# Config
GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "")
WORKER_AUTH_SECRET: str = os.getenv("WORKER_AUTH_SECRET", "")

# GCS client (reuse the same pattern as storage.py)
_storage_client = None
_bucket = None

try:
    from google.cloud import storage as gcs

    if GCS_BUCKET_NAME:
        _storage_client = gcs.Client()
        _bucket = _storage_client.bucket(GCS_BUCKET_NAME)
        logger.info("Worker GCS client initialised — bucket '%s'", GCS_BUCKET_NAME)
    else:
        logger.warning("Worker: GCS_BUCKET_NAME not set")
except ImportError:
    logger.warning("Worker: google-cloud-storage not installed")
except Exception as exc:
    logger.error("Worker: GCS client init failed: %s", exc)

GCS_WORKER_AVAILABLE: bool = _bucket is not None

# ML engine imports (same as submissions.py — lazy & guarded)
try:
    from scripts.bowling_engine import (
        CricketPoseAnalyzer,
        GeminiManager,
        create_pdf,
        MEDIAPIPE_AVAILABLE,
        BOWLING_ANALYSIS_PROMPT,
    )
    BOWLING_ENGINE_AVAILABLE = True
except Exception:
    BOWLING_ENGINE_AVAILABLE = False
    MEDIAPIPE_AVAILABLE = False

try:
    from scripts.batting_engine import (
        BattingPoseAnalyzer,
        BattingGeminiManager,
        create_batting_pdf,
        BATTING_MEDIAPIPE_AVAILABLE,
    )
    BATTING_ENGINE_AVAILABLE = True
except Exception:
    BATTING_ENGINE_AVAILABLE = False
    BATTING_MEDIAPIPE_AVAILABLE = False

# Heavy singletons — created once, reused across requests
_bowling_analyzer = CricketPoseAnalyzer() if BOWLING_ENGINE_AVAILABLE and MEDIAPIPE_AVAILABLE else None
_bowling_gemini = GeminiManager() if BOWLING_ENGINE_AVAILABLE else None
_batting_analyzer = BattingPoseAnalyzer() if BATTING_ENGINE_AVAILABLE and BATTING_MEDIAPIPE_AVAILABLE else None
_batting_gemini = BattingGeminiManager() if BATTING_ENGINE_AVAILABLE else None


# Request / Response 
class ProcessVideoRequest(BaseModel):
    submission_id: str
    blob_name: str


class ProcessVideoResponse(BaseModel):
    submission_id: str
    status: str
    pdf_blob: str | None = None


# Auth helper — validates Cloud Tasks / shared-secret header
def _verify_worker_auth(
    authorization: str | None = Header(None),
    x_worker_secret: str | None = Header(None),
) -> None:
    """
    Accept either:
      1. An OIDC token from Cloud Tasks (Authorization: Bearer <token>)
      2. A shared secret (X-Worker-Secret: <secret>)  — for dev / staging
    """
    # In production Cloud Run + Cloud Tasks, the OIDC token is validated automatically by Cloud Run's IAM invoker policy.  We only need the shared-secret path for local testing / non-GCP environments.
    if WORKER_AUTH_SECRET:
        if x_worker_secret == WORKER_AUTH_SECRET:
            return
    # If no shared secret is configured, allow all (rely on Cloud Run IAM). In a hardened setup you'd verify the OIDC JWT here.
    if not WORKER_AUTH_SECRET:
        return
    raise HTTPException(status_code=403, detail="Unauthorised worker request")


# POST /process-video
@router.post("/process-video", response_model=ProcessVideoResponse)
def process_video(
    body: ProcessVideoRequest,
    authorization: str | None = Header(None),
    x_worker_secret: str | None = Header(None),
) -> ProcessVideoResponse:
    """
    Cloud Tasks calls this endpoint to run the heavy ML pipeline:
      1. Download video from GCS → /tmp/
      2. PENDING → PROCESSING
      3. Run MediaPipe + Gemini
      4. Generate PDF, upload to GCS reports/ folder
      5. PROCESSING → DRAFT_REVIEW, save results
      6. Clean up /tmp/ file
    """
    _verify_worker_auth(authorization, x_worker_secret)

    if not GCS_WORKER_AVAILABLE:
        raise HTTPException(status_code=503, detail="GCS not configured on worker")

    db: Session = SessionLocal()
    tmp_video_path: str | None = None
    tmp_report_path: str | None = None

    try:
        # 0. Look up submission 
        sub = get_submission_by_id(db, body.submission_id)
        if sub is None:
            raise HTTPException(status_code=404, detail="Submission not found")

        if sub.status not in (SubmissionStatus.PENDING, SubmissionStatus.PROCESSING):
            raise HTTPException(
                status_code=409,
                detail=f"Submission already in '{sub.status.value}' — cannot re-process",
            )

        # 1. Download video from GCS to /tmp/ 
        blob = _bucket.blob(body.blob_name)  # type: ignore[union-attr]
        if not blob.exists():
            raise HTTPException(status_code=404, detail=f"Blob '{body.blob_name}' not in GCS")

        suffix = Path(body.blob_name).suffix or ".mp4"
        tmp_fd, tmp_video_path = tempfile.mkstemp(suffix=suffix, prefix="worker_")
        os.close(tmp_fd)
        blob.download_to_filename(tmp_video_path)
        logger.info("Downloaded %s → %s (%.1f MB)", body.blob_name, tmp_video_path,
                     os.path.getsize(tmp_video_path) / (1024 * 1024))

        # 2. Mark PROCESSING 
        mark_processing(db, sub)

        # 3. Run analysis 
        if sub.analysis_type == "BOWLING":
            raw_biometrics, annotated_url, ai_draft, phase_info, key_frame_url = (
                _run_bowling(tmp_video_path, sub.id)
            )
        else:
            raw_biometrics, annotated_url, ai_draft, phase_info, key_frame_url = (
                _run_batting(tmp_video_path, sub.id)
            )

        # 4. Generate PDF & upload to GCS 
        pdf_blob_name = _upload_pdf(sub, ai_draft, raw_biometrics)

        # 5. Save results → DRAFT_REVIEW 
        save_analysis_results(
            db,
            sub,
            raw_biometrics=raw_biometrics,
            phase_info=phase_info or {},
            ai_draft_text=ai_draft,
            annotated_video_url=annotated_url,
            key_frame_url=key_frame_url,
        )

        # Store PDF public URL (pdf_blob_name now holds the full public URL)
        if pdf_blob_name:
            sub.pdf_report_url = pdf_blob_name
            db.commit()

        logger.info("Worker finished — submission=%s → DRAFT_REVIEW", sub.id)

        return ProcessVideoResponse(
            submission_id=sub.id,
            status=sub.status.value,
            pdf_blob=pdf_blob_name,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Worker error for submission %s: %s", body.submission_id, exc)
        # Roll back to PENDING so processing can be retried
        try:
            sub_rollback = get_submission_by_id(db, body.submission_id)
            if sub_rollback and sub_rollback.status == SubmissionStatus.PROCESSING:
                sub_rollback.status = SubmissionStatus.PENDING
                db.commit()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Processing failed: {exc}") from exc

    finally:
        # 6. Clean up temp files 
        for tmp in (tmp_video_path, tmp_report_path):
            if tmp and os.path.exists(tmp):
                try:
                    os.remove(tmp)
                    logger.debug("Cleaned up %s", tmp)
                except OSError:
                    pass
        db.close()


# Analysis runners (mirrors submissions.py but writes to /tmp/ not storage/)
import cv2
import numpy as np
import pandas as pd


def _run_bowling(
    video_path: str, submission_id: str
) -> tuple[dict, str | None, str, dict, str | None]:
    if not _bowling_analyzer:
        raise RuntimeError("Bowling engine unavailable (MediaPipe missing)")

    raw_df, display_df, images, annotated_video_path = _bowling_analyzer.process_video(video_path)
    if display_df.empty:
        raise ValueError("No bowler detected — ensure full body is visible.")

    # Move annotated video to a known tmp location
    annotated_tmp = os.path.join(tempfile.gettempdir(), f"sub_{submission_id}_bowling_annotated.mp4")
    shutil.move(annotated_video_path, annotated_tmp)

    # Upload annotated video to GCS
    annotated_blob_name = f"annotated_videos/sub_{submission_id}_bowling.mp4"
    annotated_url: str | None = None
    if _bucket:
        ann_blob = _bucket.blob(annotated_blob_name)
        ann_blob.upload_from_filename(annotated_tmp)
        annotated_url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{annotated_blob_name}"
        os.remove(annotated_tmp)

    # Key frame
    key_frame_url = None
    if images:
        first_label = list(images.keys())[0]
        img_arr = images[first_label]
        frame_tmp = os.path.join(tempfile.gettempdir(), f"{submission_id}.jpg")
        cv2.imwrite(frame_tmp, cv2.cvtColor(img_arr, cv2.COLOR_RGB2BGR))
        frame_blob_name = f"key_frames/{submission_id}.jpg"
        if _bucket:
            frame_blob = _bucket.blob(frame_blob_name)
            frame_blob.upload_from_filename(frame_tmp)
            key_frame_url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{frame_blob_name}"
            os.remove(frame_tmp)

    # AI feedback
    prompt = BOWLING_ANALYSIS_PROMPT.format(metrics_summary=display_df.describe().to_string())
    ai_text = _bowling_gemini.call_gemini(prompt, video_path) if _bowling_gemini else "AI feedback unavailable."

    biometrics = {
        "records": raw_df.to_dict(orient="records") if not raw_df.empty else [],
        "summary": display_df.describe().T.to_dict(orient="index") if not display_df.empty else {},
    }

    return biometrics, annotated_url, ai_text, {}, key_frame_url

def _run_batting(
    video_path: str, submission_id: str
) -> tuple[dict, str | None, str, dict, str | None]:
    if not _batting_analyzer:
        raise RuntimeError("Batting engine unavailable (MediaPipe missing)")

    raw_df, display_df, images, annotated_video_path, phase_info = _batting_analyzer.process_video(video_path)
    if display_df.empty:
        raise ValueError("No batter detected — ensure full body is visible.")

    # Move + upload annotated video
    annotated_tmp = os.path.join(tempfile.gettempdir(), f"sub_{submission_id}_batting_annotated.mp4")
    shutil.move(annotated_video_path, annotated_tmp)

    annotated_blob_name = f"annotated_videos/sub_{submission_id}_batting.mp4"
    annotated_url: str | None = None
    if _bucket:
        ann_blob = _bucket.blob(annotated_blob_name)
        ann_blob.upload_from_filename(annotated_tmp)
        annotated_url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{annotated_blob_name}"
        os.remove(annotated_tmp)

    # Key frame (impact)
    impact_frame = phase_info.get("impact")
    key_frame_url = None
    if images:
        first_label = list(images.keys())[0]
        img_arr = images[first_label]
        frame_tmp = os.path.join(tempfile.gettempdir(), f"{submission_id}.jpg")
        cv2.imwrite(frame_tmp, cv2.cvtColor(img_arr, cv2.COLOR_RGB2BGR))
        frame_blob_name = f"key_frames/{submission_id}.jpg"
        if _bucket:
            frame_blob = _bucket.blob(frame_blob_name)
            frame_blob.upload_from_filename(frame_tmp)
            key_frame_url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{frame_blob_name}"
            os.remove(frame_tmp)

    # AI feedback
    prompt = (
        "You are a professional elite cricket batting coach and biomechanics analyst.\n"
        "Analyze this batter's technique using the provided biomechanical metrics.\n\n"
        f"METRICS SUMMARY:\n{display_df.describe().to_string()}\n\n"
        "PHASE DETECTION:\n"
        f"  Stance End: Frame {phase_info.get('stance_end')}\n"
        f"  Stride Peak: Frame {phase_info.get('stride_peak')}\n"
        f"  Impact: Frame {phase_info.get('impact')}\n"
        f"  Follow-Through: Frame {phase_info.get('followthrough_start')}\n\n"
        "REQUIRED STRUCTURE:\n\n"
        "**OVERALL ASSESSMENT**\n2-3 sentence executive summary.\n\n"
        "**PHASE-BY-PHASE ANALYSIS**\n\n"
        "**SPECIFIC CORRECTIONS & DRILLS**\n"
        "**PERFORMANCE SUMMARY**\n\n"
        "Tone: Direct, professional, encouraging but honest."
    )
    ai_text = _batting_gemini.call_gemini(prompt, video_path) if _batting_gemini else "AI feedback unavailable."

    biometrics = {
        "records": raw_df.to_dict(orient="records") if not raw_df.empty else [],
        "summary": display_df.describe().T.to_dict(orient="index") if not display_df.empty else {},
    }

    return biometrics, annotated_url, ai_text, phase_info, key_frame_url


# PDF generation + upload to GCS
def _upload_pdf(
    sub: VideoSubmission,
    ai_text: str,
    raw_biometrics: dict,
) -> str | None:
    """Generate the analysis PDF and upload it to GCS.  Returns the blob name or None."""
    try:
        metrics_df = pd.DataFrame()
        if raw_biometrics and "records" in raw_biometrics:
            metrics_df = pd.DataFrame(raw_biometrics["records"])

        if sub.analysis_type == "BOWLING" and BOWLING_ENGINE_AVAILABLE:
            pdf_bytes = create_pdf(ai_text, metrics_df, {})
        elif BATTING_ENGINE_AVAILABLE:
            pdf_bytes = create_batting_pdf(ai_text, metrics_df, {}, phase_info=sub.phase_info or {})
        else:
            pdf_bytes = _simple_pdf(ai_text, sub.analysis_type)

        # Write to /tmp/ then upload
        report_name = f"submission_report_{sub.id}.pdf"
        tmp_report = os.path.join(tempfile.gettempdir(), report_name)
        with open(tmp_report, "wb") as f:
            f.write(pdf_bytes)

        blob_name = f"reports/{report_name}"
        if _bucket:
            pdf_blob = _bucket.blob(blob_name)
            pdf_blob.upload_from_filename(tmp_report, content_type="application/pdf")
            os.remove(tmp_report)
            pdf_public_url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{blob_name}"
            logger.info("PDF uploaded → %s", pdf_public_url)
            return pdf_public_url
        return None

    except Exception as exc:
        logger.exception("PDF generation/upload failed: %s", exc)
        return None


def _simple_pdf(text: str, analysis_type: str) -> bytes:
    """Fallback PDF when engine-specific generators are unavailable."""
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 15, f"{analysis_type.title()} Analysis Report", 0, 1, "C")
    pdf.ln(10)
    pdf.set_font("Helvetica", "", 12)
    for line in text.split("\n"):
        safe = line.encode("latin-1", "replace").decode("latin-1")
        pdf.multi_cell(0, 7, safe)
    return bytes(pdf.output())
