"""
Generates V4 Signed URLs so the React frontend uploads heavy video files
straight to Google Cloud Storage, completely bypassing FastAPI's RAM.

Flow:
  1. Frontend calls  GET /api/v1/storage/upload-url?filename=x&content_type=y
  2. Backend returns  { signed_url, blob_name, submission_id }m
  3. Frontend PUTs the file to signed_url (direct GCS upload)
  4. Frontend calls  POST /api/v1/storage/confirm-upload with submission_id to flip the status from UPLOADING → PENDING.

Environment Variables Required:
  GCS_BUCKET_NAME                — Target bucket (e.g. "cricket-videos-prod")
  GOOGLE_APPLICATION_CREDENTIALS — Path to service-account JSON key file (OR use Workload Identity on Cloud Run)
"""

import logging
import os
import threading
import uuid
import urllib.parse
from datetime import datetime, timedelta
from pathlib import Path

import google.auth
import google.auth.transport.requests
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.user import User
from database.models.submission import VideoSubmission, SubmissionStatus
from database.models.video import Video, HighlightJob, VideoVisibility, VideoStatus
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# GCS client (singleton — initialised once at import time)
GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "")

_storage_client = None
_bucket = None

try:
    from google.cloud import storage as gcs

    if GCS_BUCKET_NAME:
        _storage_client = gcs.Client()
        _bucket = _storage_client.bucket(GCS_BUCKET_NAME)
        logger.info("GCS storage client initialised for bucket '%s'", GCS_BUCKET_NAME)
    else:
        logger.warning("GCS_BUCKET_NAME not set — signed-URL endpoint will return 503")
except ImportError:
    logger.warning("google-cloud-storage not installed — signed-URL endpoint disabled")
except Exception as exc:
    logger.error("Failed to initialise GCS client: %s", exc)

GCS_AVAILABLE: bool = _bucket is not None

# Allowed MIME types for video uploads
_ALLOWED_CONTENT_TYPES = frozenset(
    {
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/webm",
    }
)

# Signed URL validity
_SIGNED_URL_EXPIRY = timedelta(minutes=15)

# Local upload root (used for automatic fallback in local/dev)
LOCAL_UPLOAD_ROOT = Path("storage/uploads")
LOCAL_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


# Response schemas (kept local — tiny & endpoint-specific)
class SignedUrlResponse(BaseModel):
    signed_url: str
    blob_name: str
    submission_id: str


class ResumableSessionRequest(BaseModel):
    filename: str
    content_type: str
    analysis_type: str = "FULL_MATCH"
    size_bytes: int | None = None


class ResumableSessionResponse(BaseModel):
    session_uri: str
    blob_name: str
    submission_id: str


class ConfirmUploadResponse(BaseModel):
    submission_id: str
    status: str
    blob_name: str


def _build_local_upload_url(request: Request, blob_name: str) -> str:
    """Build a local PUT URL for direct upload to FastAPI when GCS signing is unavailable."""
    encoded_blob = urllib.parse.quote(blob_name, safe="/")
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/v1/storage/local-upload/{encoded_blob}"


def _build_submission(
    db: Session,
    current_user: User,
    filename: str,
    analysis_type: str,
    blob_name: str,
) -> VideoSubmission:
    """Create a submission row for either cloud or local upload flows."""
    submission = VideoSubmission(
        player_id=current_user.id,
        coach_id=current_user.id,
        original_filename=filename,
        video_url=blob_name,
        analysis_type=analysis_type,
        status=SubmissionStatus.UPLOADING,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


def _build_submission_with_fallback(
    db: Session,
    current_user: User,
    filename: str,
    analysis_type: str,
    blob_name: str,
) -> VideoSubmission:
    """Create UPLOADING submission, with safe fallback for legacy DB enum definitions."""
    try:
        return _build_submission(
            db=db,
            current_user=current_user,
            filename=filename,
            analysis_type=analysis_type,
            blob_name=blob_name,
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.warning("UPLOADING state insert failed, falling back to PENDING: %s", exc)
        submission = VideoSubmission(
            player_id=current_user.id,
            coach_id=current_user.id,
            original_filename=filename,
            video_url=blob_name,
            analysis_type=analysis_type,
            status=SubmissionStatus.PENDING,
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        return submission


def _resolve_local_upload_path(blob_name: str) -> Path:
    """Resolve and validate local upload path under storage/uploads."""
    candidate = (LOCAL_UPLOAD_ROOT / blob_name).resolve()
    root_resolved = LOCAL_UPLOAD_ROOT.resolve()
    if root_resolved not in candidate.parents and candidate != root_resolved:
        raise HTTPException(status_code=400, detail="Invalid upload path.")
    return candidate


def _ensure_library_video_entry(db: Session, sub: VideoSubmission) -> tuple[Video, HighlightJob | None]:
    """Ensure OCR uploads are represented in the public video library."""
    video = (
        db.query(Video)
        .filter(
            Video.file_path == sub.video_url,
            Video.uploaded_by == sub.player_id,
            Video.deleted_at.is_(None),
        )
        .first()
    )

    if video is None:
        video = Video(
            title=sub.original_filename,
            description=f"OCR highlights source for submission {sub.id}",
            file_path=sub.video_url,
            visibility=VideoVisibility.PUBLIC.value,
            uploaded_by=sub.player_id,
            status=VideoStatus.PENDING.value,
        )
        db.add(video)
        db.commit()
        db.refresh(video)

    if video.visibility != VideoVisibility.PUBLIC.value:
        video.visibility = VideoVisibility.PUBLIC.value

    job = db.query(HighlightJob).filter(HighlightJob.video_id == video.id).first()
    if job is None:
        job = HighlightJob(video_id=video.id, status=VideoStatus.PENDING.value)
        db.add(job)

    db.commit()
    if job is not None:
        db.refresh(job)
    db.refresh(video)
    return video, job


def _process_submission_locally(submission_id: str) -> None:
    """Background local processor for local-upload fallback flow."""
    from database.config import get_background_db
    from database.crud.submission import save_analysis_results

    db = get_background_db()
    try:
        sub = db.query(VideoSubmission).filter(VideoSubmission.id == submission_id).first()
        if sub is None:
            logger.error("Local worker: submission not found: %s", submission_id)
            return

        local_video = _resolve_local_upload_path(sub.video_url)
        if not local_video.exists():
            raise FileNotFoundError(f"Local worker: video not found at {local_video}")

        # Import lazily to avoid route import cycles at module import time.
        from api.routes.submissions import _run_batting_analysis, _run_bowling_analysis

        if (sub.analysis_type or "").upper() == "FULL_MATCH":
            raise RuntimeError("FULL_MATCH submissions must use OCR highlights pipeline")

        if sub.analysis_type == "BOWLING":
            raw_biometrics, annotated_url, ai_draft, phase_info, key_frame_url = _run_bowling_analysis(
                str(local_video),
                sub.id,
            )
        else:
            raw_biometrics, annotated_url, ai_draft, phase_info, key_frame_url = _run_batting_analysis(
                str(local_video),
                sub.id,
            )

        save_analysis_results(
            db,
            sub,
            raw_biometrics=raw_biometrics,
            phase_info=phase_info or {},
            ai_draft_text=ai_draft,
            annotated_video_url=annotated_url,
            key_frame_url=key_frame_url,
        )

        # Generate local PDF so player flow has an immediate downloadable report.
        try:
            import pandas as pd
            from scripts.bowling_engine import create_pdf
            from scripts.batting_engine import create_batting_pdf

            metrics_df = pd.DataFrame(raw_biometrics.get("records", [])) if isinstance(raw_biometrics, dict) else pd.DataFrame()
            if sub.analysis_type == "BOWLING":
                pdf_bytes = create_pdf(ai_draft, metrics_df, {})
            else:
                pdf_bytes = create_batting_pdf(ai_draft, metrics_df, {}, phase_info=phase_info or {})

            reports_dir = Path("storage/reports")
            reports_dir.mkdir(parents=True, exist_ok=True)
            report_filename = f"submission_report_{sub.id}.pdf"
            report_path = reports_dir / report_filename
            report_path.write_bytes(pdf_bytes)

            sub.pdf_report_url = f"/static/reports/{report_filename}"
            db.commit()
        except Exception as pdf_exc:
            logger.warning("Local worker: PDF generation skipped for %s: %s", sub.id, pdf_exc)

        logger.info("Local worker finished — submission=%s → DRAFT_REVIEW", sub.id)
    except Exception as exc:
        logger.exception("Local worker failed for submission %s: %s", submission_id, exc)
        try:
            sub = db.query(VideoSubmission).filter(VideoSubmission.id == submission_id).first()
            if sub and sub.status == SubmissionStatus.PROCESSING:
                sub.status = SubmissionStatus.PENDING
                db.commit()
        except Exception:
            logger.exception("Failed to rollback submission state for %s", submission_id)
    finally:
        db.close()


def _process_submission_ocr_fallback(submission_id: str) -> None:
    """Fallback OCR processing path when Cloud Tasks enqueue is unavailable."""
    from database.config import get_background_db
    from services.ocr_task import run_ocr_processing

    db = get_background_db()
    try:
        sub = db.query(VideoSubmission).filter(VideoSubmission.id == submission_id).first()
        if sub is None:
            logger.error("OCR fallback: submission not found: %s", submission_id)
            return

        video = (
            db.query(Video)
            .filter(
                Video.file_path == sub.video_url,
                Video.uploaded_by == sub.player_id,
                Video.deleted_at.is_(None),
            )
            .first()
        )

        if video is None:
            video = Video(
                title=sub.original_filename,
                description=f"OCR highlights source for submission {sub.id}",
                file_path=sub.video_url,
                visibility=VideoVisibility.PUBLIC.value,
                uploaded_by=sub.player_id,
                status=VideoStatus.PENDING.value,
            )
            db.add(video)
            db.commit()
            db.refresh(video)

        if video.visibility != VideoVisibility.PUBLIC.value:
            video.visibility = VideoVisibility.PUBLIC.value

        job = db.query(HighlightJob).filter(HighlightJob.video_id == video.id).first()
        if job is None:
            job = HighlightJob(video_id=video.id, status=VideoStatus.PENDING.value)
            db.add(job)

        sub.status = SubmissionStatus.PROCESSING
        video.status = VideoStatus.PROCESSING.value
        job.status = VideoStatus.PROCESSING.value
        db.commit()

        run_ocr_processing(video.id, config={"padding_before": 12, "padding_after": 10})

        db.expire_all()
        sub = db.query(VideoSubmission).filter(VideoSubmission.id == submission_id).first()
        video = db.query(Video).filter(Video.id == video.id).first()
        job = db.query(HighlightJob).filter(HighlightJob.video_id == video.id).first()

        if sub and video and video.status == VideoStatus.COMPLETED.value and job and job.supercut_path:
            sub.status = SubmissionStatus.DRAFT_REVIEW
            sub.annotated_video_url = job.supercut_path
            sub.ai_draft_text = "OCR highlights generated successfully."
            db.commit()
            logger.info("OCR fallback completed — submission=%s video=%s", submission_id, video.id)
            return

        if sub:
            failure = (video.processing_error if video else None) or (job.error_message if job else None) or "OCR fallback failed"
            sub.status = SubmissionStatus.PENDING
            sub.ai_draft_text = f"OCR highlight generation failed: {failure}"
            db.commit()
            logger.error("OCR fallback failed — submission=%s error=%s", submission_id, failure)
    except Exception as exc:
        logger.exception("OCR fallback crashed for submission %s: %s", submission_id, exc)
        try:
            sub = db.query(VideoSubmission).filter(VideoSubmission.id == submission_id).first()
            if sub and sub.status == SubmissionStatus.PROCESSING:
                sub.status = SubmissionStatus.PENDING
                db.commit()
        except Exception:
            logger.exception("Failed to rollback fallback state for %s", submission_id)
    finally:
        db.close()


# GET /upload-url
@router.get("/upload-url", response_model=SignedUrlResponse)
def generate_upload_url(
    request: Request,
    filename: str = Query(..., min_length=1, description="Original file name"),
    content_type: str = Query(..., description="MIME type, e.g. video/mp4"),
    analysis_type: str = Query("FULL_MATCH", description="FULL_MATCH, BATTING or BOWLING"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SignedUrlResponse:
    """
    Return a V4 Signed URL that lets the frontend PUT a video file
    directly into GCS.  Also creates a ``video_submissions`` row in
    UPLOADING state so we can track the upload lifecycle.
    """
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type '{content_type}'. "
            f"Allowed: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}",
        )

    analysis_type = analysis_type.upper()
    if analysis_type not in ("FULL_MATCH", "BATTING", "BOWLING"):
        raise HTTPException(status_code=400, detail="analysis_type must be FULL_MATCH, BATTING or BOWLING")

    # unique blob path
    unique_id = uuid.uuid4().hex[:12]
    safe_name = filename.replace(" ", "_")
    blob_name = f"raw_videos/{unique_id}_{safe_name}"

    signed_url: str
    upload_mode = "LOCAL"

    # Prefer GCS signed URLs when possible; auto-fallback to local upload when unavailable.
    if GCS_AVAILABLE:
        blob = _bucket.blob(blob_name)  # type: ignore[union-attr]
        try:
            _auth_request = google.auth.transport.requests.Request()
            _credentials, _ = google.auth.default()
            _credentials.refresh(_auth_request)

            service_account_email = getattr(_credentials, "service_account_email", None)
            if not service_account_email:
                raise RuntimeError("Current ADC credentials are not service-account credentials")

            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=_SIGNED_URL_EXPIRY,
                method="PUT",
                content_type=content_type,
                service_account_email=service_account_email,
                access_token=_credentials.token,
            )
            upload_mode = "GCS"
        except Exception as exc:
            logger.warning(
                "Failed to generate GCS signed URL, falling back to local upload: %s",
                exc,
            )
            signed_url = _build_local_upload_url(request, blob_name)
    else:
        signed_url = _build_local_upload_url(request, blob_name)

    submission = _build_submission_with_fallback(
        db=db,
        current_user=current_user,
        filename=filename,
        analysis_type=analysis_type,
        blob_name=blob_name,
    )

    logger.info(
        "Upload URL generated (%s) — user=%s blob=%s submission=%s",
        upload_mode,
        current_user.id,
        blob_name,
        submission.id,
    )

    return SignedUrlResponse(
        signed_url=signed_url,
        blob_name=blob_name,
        submission_id=submission.id,
    )


@router.put("/local-upload/{blob_path:path}")
async def local_upload(blob_path: str, request: Request):
    """Receive direct file bytes for local/dev upload fallback."""
    relative = Path(blob_path)
    if relative.is_absolute() or ".." in relative.parts:
        raise HTTPException(status_code=400, detail="Invalid upload path.")

    destination = (LOCAL_UPLOAD_ROOT / relative).resolve()
    root_resolved = LOCAL_UPLOAD_ROOT.resolve()

    if root_resolved not in destination.parents and destination != root_resolved:
        raise HTTPException(status_code=400, detail="Invalid upload path.")

    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = await request.body()
    if not payload:
        raise HTTPException(status_code=400, detail="Empty upload body.")

    try:
        destination.write_bytes(payload)
    except Exception as exc:
        logger.error("Local upload write failed for %s: %s", destination, exc)
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.") from exc

    logger.info("Local upload saved: %s (%d bytes)", destination, len(payload))
    return {"ok": True, "blob_name": blob_path, "bytes": len(payload)}


@router.post("/resumable-session", response_model=ResumableSessionResponse)
def create_resumable_session(
    payload: ResumableSessionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResumableSessionResponse:
    """Create a GCS resumable upload session and a submission row for heavy uploads."""
    if payload.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type '{payload.content_type}'. "
            f"Allowed: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}",
        )

    analysis_type = (payload.analysis_type or "FULL_MATCH").upper()
    if analysis_type not in ("FULL_MATCH", "BATTING", "BOWLING"):
        raise HTTPException(status_code=400, detail="analysis_type must be FULL_MATCH, BATTING or BOWLING")

    if not GCS_AVAILABLE:
        raise HTTPException(status_code=503, detail="GCS is not configured for resumable uploads.")

    safe_name = payload.filename.replace(" ", "_")
    upload_prefix = "raw_matches" if analysis_type == "FULL_MATCH" else "raw_videos"
    blob_name = f"{upload_prefix}/{uuid.uuid4().hex[:12]}_{safe_name}"

    submission = _build_submission_with_fallback(
        db=db,
        current_user=current_user,
        filename=payload.filename,
        analysis_type=analysis_type,
        blob_name=blob_name,
    )

    try:
        blob = _bucket.blob(blob_name)  # type: ignore[union-attr]
        request_origin = request.headers.get("origin")
        upload_size = payload.size_bytes if payload.size_bytes and payload.size_bytes > 0 else None
        session_uri = blob.create_resumable_upload_session(
            content_type=payload.content_type,
            size=upload_size,
            origin=request_origin,
        )
    except Exception as exc:
        logger.exception("Failed to create resumable session for %s: %s", blob_name, exc)
        raise HTTPException(status_code=500, detail="Failed to create resumable upload session.") from exc

    logger.info(
        "Resumable session created — user=%s submission=%s blob=%s",
        current_user.id,
        submission.id,
        blob_name,
    )

    return ResumableSessionResponse(
        session_uri=session_uri,
        blob_name=blob_name,
        submission_id=submission.id,
    )


# POST /confirm-upload  (optional — frontend calls after PUT succeeds)
@router.post("/confirm-upload", response_model=ConfirmUploadResponse)
def confirm_upload(
    submission_id: str = Query(..., description="Submission ID returned by /upload-url"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConfirmUploadResponse:
    """
    Mark a submission's upload as complete.  The frontend calls this after
    the direct GCS PUT returns 200.
    """
    sub: VideoSubmission | None = (
        db.query(VideoSubmission)
        .filter(
            VideoSubmission.id == submission_id,
            VideoSubmission.player_id == current_user.id,
        )
        .first()
    )

    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    if sub.status not in (SubmissionStatus.UPLOADING, SubmissionStatus.PENDING):
        raise HTTPException(
            status_code=409,
            detail=f"Submission is already in '{sub.status.value}' state.",
        )

    # Verify upload exists in whichever backend was used for this upload.
    # In local fallback mode, GCS may be configured but actual bytes are local.
    local_exists = False
    try:
        local_exists = _resolve_local_upload_path(sub.video_url).exists()
    except HTTPException:
        local_exists = False

    gcs_exists = False
    if GCS_AVAILABLE:
        try:
            blob = _bucket.blob(sub.video_url)  # type: ignore[union-attr]
            gcs_exists = bool(blob.exists())
        except Exception as exc:
            logger.warning("GCS existence check failed for %s: %s", sub.video_url, exc)

    if not (local_exists or gcs_exists):
        raise HTTPException(
            status_code=400,
            detail="Upload not found in storage. Please retry the upload.",
        )

    if sub.status == SubmissionStatus.UPLOADING:
        sub.status = SubmissionStatus.PENDING

    db.commit()
    db.refresh(sub)

    logger.info("Upload confirmed — submission=%s blob=%s", sub.id, sub.video_url)

    return ConfirmUploadResponse(
        submission_id=sub.id,
        status=sub.status.value,
        blob_name=sub.video_url,
    )


# Response schema for start-processing
class StartProcessingResponse(BaseModel):
    submission_id: str
    status: str
    task_name: str | None = None


# POST /start-processing  (triggers Cloud Tasks ML pipeline)
@router.post("/start-processing", response_model=StartProcessingResponse)
def start_processing(
    request: Request,
    submission_id: str = Query(..., description="Submission ID to process"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StartProcessingResponse:
    """
    Queue background ML processing for a confirmed upload.

    Works for both:
      - Self-service flow (player uploads via Bowling/Batting page)
      - Coach-mediated flow (coach triggers analysis)

    On Cloud Run (Cloud Tasks available):
      Enqueues a task → returns immediately with status=PROCESSING.
    On local dev (no Cloud Tasks):
      Marks PROCESSING and returns — caller must use the old sync
      ``/submissions/{id}/analyze`` endpoint separately.
    """
    sub: VideoSubmission | None = (
        db.query(VideoSubmission)
        .filter(VideoSubmission.id == submission_id)
        .first()
    )

    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found.")

    # Auth: owner (player or coach) or admin
    is_owner = sub.player_id == current_user.id or sub.coach_id == current_user.id
    is_admin = current_user.role == "ADMIN"
    if not (is_owner or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to process this submission.")

    if sub.status != SubmissionStatus.PENDING:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot process — current status is '{sub.status.value}'. Only PENDING submissions can be queued.",
        )

    # If uploaded to local fallback storage, process locally even when Cloud Tasks is configured.
    local_video_exists = False
    try:
        local_video_exists = _resolve_local_upload_path(sub.video_url).exists()
    except HTTPException:
        local_video_exists = False

    if local_video_exists:
        sub.status = SubmissionStatus.PROCESSING
        db.commit()

        processor = _process_submission_ocr_fallback if (sub.analysis_type or "").upper() == "FULL_MATCH" else _process_submission_locally
        thread = threading.Thread(
            target=processor,
            args=(sub.id,),
            daemon=True,
        )
        thread.start()

        logger.info(
            "Local processing started in background thread — submission=%s",
            sub.id,
        )
        return StartProcessingResponse(
            submission_id=sub.id,
            status="PROCESSING",
            task_name=None,
        )

    # Import Cloud Tasks utility
    from utils.cloud_tasks import queue_processing_task, CLOUD_TASKS_AVAILABLE

    analysis_mode = (sub.analysis_type or "").upper()
    pipeline = "ocr_highlights" if analysis_mode == "FULL_MATCH" else "submission_analysis"

    # Local development path: process OCR highlights in-process so local DB/UI update correctly. In local runs, Cloud Tasks often targets remote worker/deployment, which leaves local library rows stuck in PROCESSING.
    is_cloud_run = bool(os.getenv("K_SERVICE"))
    if pipeline == "ocr_highlights" and not is_cloud_run:
        _ensure_library_video_entry(db, sub)
        sub.status = SubmissionStatus.PROCESSING
        db.commit()

        thread = threading.Thread(
            target=_process_submission_ocr_fallback,
            args=(sub.id,),
            daemon=True,
        )
        thread.start()

        logger.info(
            "Local OCR processing started in fallback thread — submission=%s",
            sub.id,
        )
        return StartProcessingResponse(
            submission_id=sub.id,
            status="PROCESSING",
            task_name=None,
        )

    if CLOUD_TASKS_AVAILABLE:
        library_video: Video | None = None
        library_job: HighlightJob | None = None
        if pipeline == "ocr_highlights":
            library_video, library_job = _ensure_library_video_entry(db, sub)

        task_name = queue_processing_task(sub.id, sub.video_url, pipeline=pipeline)
        if not task_name:
            if pipeline == "ocr_highlights":
                sub.status = SubmissionStatus.PROCESSING
                db.commit()

                thread = threading.Thread(
                    target=_process_submission_ocr_fallback,
                    args=(sub.id,),
                    daemon=True,
                )
                thread.start()

                logger.warning(
                    "Cloud Tasks enqueue failed; started OCR fallback thread — submission=%s",
                    sub.id,
                )
                return StartProcessingResponse(
                    submission_id=sub.id,
                    status="PROCESSING",
                    task_name=None,
                )

            raise HTTPException(status_code=500, detail="Failed to enqueue processing task.")

        if pipeline == "ocr_highlights" and library_video is not None:
            library_video.status = VideoStatus.PROCESSING.value
            library_video.processing_started_at = datetime.utcnow()
            if library_job is not None:
                library_job.status = VideoStatus.PROCESSING.value
                library_job.started_at = datetime.utcnow()
                library_job.progress_percent = 0

        # Mark PROCESSING so frontend sees the correct state immediately
        sub.status = SubmissionStatus.PROCESSING
        db.commit()

        logger.info(
            "Processing queued via Cloud Tasks — submission=%s task=%s pipeline=%s",
            sub.id,
            task_name,
            pipeline,
        )
        return StartProcessingResponse(
            submission_id=sub.id,
            status="PROCESSING",
            task_name=task_name,
        )
    else:
        # Local dev: no Cloud Tasks — just mark PROCESSING.
        sub.status = SubmissionStatus.PROCESSING
        db.commit()

        logger.warning(
            "Cloud Tasks unavailable — submission %s marked PROCESSING but not queued. "
            "Use /submissions/{id}/analyze for local processing.",
            sub.id,
        )
        return StartProcessingResponse(
            submission_id=sub.id,
            status="PROCESSING",
            task_name=None,
        )
