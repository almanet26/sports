"""
Jobs API routes for triggering and monitoring OCR processing.
"""

import logging
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.user import User
from database.models.video import Video, HighlightJob, VideoStatus
from schemas.video import JobTriggerRequest, JobStatusResponse, JobResultResponse
from services.ocr_task import run_ocr_processing
from utils.auth import get_current_user, require_role
from dependencies.feature_gate import require_feature, get_active_subscription
from dependencies.quota_gate import quota_check, increment_usage_atomic

router = APIRouter(prefix="/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)

# Cloud Tasks config — all three must be set to enable Cloud Tasks dispatch.
_GCP_PROJECT = os.getenv("GCP_PROJECT_ID", "")
_CT_LOCATION  = os.getenv("CLOUD_TASKS_LOCATION", "asia-south1")
_WORKER_URL   = os.getenv("WORKER_URL", "")   # e.g. https://worker-xxxx.run.app

# Roles that get expedited processing via the priority queue.
_PRIORITY_ROLES = {"coach_platinum"}

_CLOUD_TASKS_ENABLED = bool(_GCP_PROJECT and _WORKER_URL)


def _enqueue_ocr_task(
    video_id: str,
    config: Optional[dict],
    user_role: str,
    background_tasks: BackgroundTasks,
) -> None:
    """
    Dispatch an OCR job.

    When Cloud Tasks is fully configured (GCP_PROJECT_ID + WORKER_URL set),
    enqueues to:
      • "ocr-priority"  — coach_pro / academy  (higher concurrency)
      • "ocr-standard"  — all other coach tiers

    Both queues call the same worker endpoint: POST {WORKER_URL}/internal/worker/ocr-task

    Falls back to FastAPI BackgroundTasks when running locally (Cloud Tasks not configured).

    gcloud queue creation commands:
      # Standard queue — 5 concurrent dispatches
      gcloud tasks queues create ocr-standard \
        --location=asia-south1 \
        --max-concurrent-dispatches=5 \
        --max-dispatches-per-second=2

      # Priority queue — 20 concurrent dispatches
      gcloud tasks queues create ocr-priority \
        --location=asia-south1 \
        --max-concurrent-dispatches=20 \
        --max-dispatches-per-second=10
    """
    if not _CLOUD_TASKS_ENABLED:
        background_tasks.add_task(run_ocr_processing, video_id, config)
        return

    queue_name = "ocr-priority" if user_role in _PRIORITY_ROLES else "ocr-standard"

    try:
        from services.cloud_tasks_service import CloudTasksManager
        import json

        manager = CloudTasksManager(_GCP_PROJECT, _CT_LOCATION, queue_name)
        worker_endpoint = f"{_WORKER_URL}/internal/worker/ocr-task"

        payload = json.dumps({"video_id": video_id, "config": config or {}}).encode()

        from google.cloud import tasks_v2
        manager.client.create_task(
            request={
                "parent": manager.queue_path,
                "task": {
                    "http_request": {
                        "http_method": tasks_v2.HttpMethod.POST,
                        "url": worker_endpoint,
                        "headers": {"Content-Type": "application/json"},
                        "body": payload,
                        # OIDC token so Cloud Run rejects unauthenticated calls.
                        "oidc_token": {
                            "service_account_email": os.getenv(
                                "WORKER_SERVICE_ACCOUNT", ""
                            )
                        },
                    }
                },
            }
        )
        logger.info(
            "Enqueued video=%s to Cloud Tasks queue=%s (role=%s)",
            video_id,
            queue_name,
            user_role,
        )
    except Exception as exc:
        logger.error(
            "Cloud Tasks enqueue failed for video=%s, falling back to BackgroundTasks: %s",
            video_id,
            exc,
        )
        background_tasks.add_task(run_ocr_processing, video_id, config)


@router.post("/trigger", response_model=JobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_ocr_job(
    request: JobTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_feature("ocr_highlights")),
    _quota: tuple = Depends(quota_check("ocr_highlights")),
):
    """
    Trigger OCR processing for a video.

    Access: coach_starter tier and above (require_feature gate).
    Quota:  ocr_hours_used tracked monthly (quota_check gate).

    Reserves estimated OCR hours at dispatch time based on video duration;
    the worker reconciles actual consumption via POST /internal/usage/report.
    """
    # Fetch video
    video = db.query(Video).filter(Video.id == request.video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    # Ownership check — only the uploader may trigger processing.
    if video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to process this video",
        )

    # Refuse to re-queue a job that is actively running.
    existing_job = db.query(HighlightJob).filter(HighlightJob.video_id == video.id).first()
    if existing_job and existing_job.status == VideoStatus.PROCESSING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Video is already being processed",
        )

    # Create or reset job record.
    if existing_job:
        existing_job.status = VideoStatus.PENDING.value
        existing_job.progress_percent = 0
        existing_job.error_message = None
        existing_job.events_detected = None
        existing_job.supercut_path = None
        existing_job.boundaries_supercut_path = None
        existing_job.wickets_supercut_path = None
        job = existing_job
    else:
        job = HighlightJob(
            video_id=video.id,
            status=VideoStatus.PENDING.value,
        )
        db.add(job)

    db.commit()
    db.refresh(job)

    # Get subscription tier for queue routing (not account type)
    sub = get_active_subscription(current_user, db)
    sub_role = sub.role if sub else "free"

    logger.info("Triggering OCR job — video=%s user=%s sub_role=%s", video.id, current_user.email, sub_role)

    # Dispatch OCR task — routes to priority queue for coach_pro / academy.
    _enqueue_ocr_task(video.id, request.config, sub_role, background_tasks)

    # Reserve estimated OCR hours immediately at dispatch.
    # Uses the atomic check-and-increment so two simultaneous trigger requests cannot both succeed when the user is near their monthly OCR limit.
    # A custom start_time/end_time window only scans that slice of the video, so bill for the requested window rather than the full source duration.
    window_start = request.config.get("start_time") if request.config else None
    window_end = request.config.get("end_time") if request.config else None
    if window_start is not None and window_end is not None:
        estimated_hours = max(0.0, float(window_end) - float(window_start)) / 3600.0
    else:
        estimated_hours = (video.duration_seconds or 0) / 3600.0
    if estimated_hours > 0 and current_user.role != "ADMIN":
        charged = increment_usage_atomic(
            current_user.id, "ocr_hours_used", "max_ocr_hours_per_month", estimated_hours, db
        )
        if not charged:
            # Undo the already-committed job record reset and reject.
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "quota_exceeded",
                    "reason": "Monthly OCR hours limit reached (concurrent request).",
                },
            )
        logger.info(
            "Reserved %.4f OCR hours for user=%s video=%s",
            estimated_hours,
            current_user.id,
            video.id,
        )

    return JobStatusResponse(
        id=job.id,
        video_id=job.video_id,
        status=job.status,
        progress_percent=job.progress_percent,
        frames_processed=job.frames_processed or 0,
        ocr_success_rate=job.ocr_success_rate,
        error_message=job.error_message,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


@router.get("/{video_id}/status/poll")
def poll_job_status(
    video_id: str,
    db: Session = Depends(get_db),
):
    """
    Lightweight job status polling endpoint (no auth required).
    
    Used for frequent status checks during OCR processing.
    Returns minimal data with retry logic for transient DB errors.
    """
    max_retries = 3
    last_error = None
    
    for attempt in range(max_retries):
        try:
            job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
            if not job:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No processing job found for this video"
                )
            
            return {
                "status": job.status,
                "progress_percent": job.progress_percent or 0,
                "frames_processed": job.frames_processed or 0,
                "error_message": job.error_message,
            }
        except HTTPException:
            raise
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                import time
                time.sleep(0.3 * (attempt + 1))
                try:
                    db.rollback()
                except Exception:
                    pass
            continue
    
    # Return a fallback response instead of failing
    return {
        "status": "PROCESSING",
        "progress_percent": 0,
        "frames_processed": 0,
        "error_message": None,
        "_db_error": "Temporary database issue, please retry"
    }


@router.get("/{video_id}/status", response_model=JobStatusResponse)
def get_job_status(
    video_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the current status of an OCR processing job.
    
    Returns progress percentage, status, and any error messages.
    """
    # Fetch video first to check permissions
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )
    
    # Check access (own video or public or admin)
    if (video.visibility == "private" and 
        video.uploaded_by != current_user.id and 
        current_user.role != "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Fetch job
    job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No processing job found for this video"
        )
    
    return JobStatusResponse(
        id=job.id,
        video_id=job.video_id,
        status=job.status,
        progress_percent=job.progress_percent,
        frames_processed=job.frames_processed or 0,
        ocr_success_rate=job.ocr_success_rate,
        error_message=job.error_message,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


@router.get("/{video_id}/result", response_model=JobResultResponse)
def get_job_result(
    video_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the results of a completed OCR processing job.
    
    Returns detected events and supercut path.
    """
    # Fetch video first to check permissions
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )
    
    # Check access
    if (video.visibility == "private" and 
        video.uploaded_by != current_user.id and 
        current_user.role != "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Fetch job
    job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No processing job found for this video"
        )
    
    if job.status != VideoStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job is not completed. Current status: {job.status}"
        )
    
    return JobResultResponse(
        id=job.id,
        video_id=job.video_id,
        status=job.status,
        events_detected=job.events_detected,
        supercut_path=job.supercut_path,
        boundaries_supercut_path=job.boundaries_supercut_path,
        wickets_supercut_path=job.wickets_supercut_path,
        ocr_success_rate=job.ocr_success_rate,
        completed_at=job.completed_at,
    )


@router.post("/{video_id}/retry", response_model=JobStatusResponse)
def retry_failed_job(
    video_id: str,
    config: Optional[dict] = None,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "COACH"])),
):
    """
    Retry a failed OCR processing job.
    
    **Access Control:** ADMIN and COACH only.
    
    Maximum retry attempts: 3
    """
    # Fetch video
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )
    
    # Check ownership
    if current_user.role != "ADMIN" and video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to retry this job"
        )
    
    # Fetch job
    job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No processing job found for this video"
        )
    
    if job.status != VideoStatus.FAILED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Can only retry failed jobs. Current status: {job.status}"
        )
    
    if job.retry_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum retry attempts (3) exceeded"
        )
    
    # Reset job
    job.status = VideoStatus.PENDING.value
    job.progress_percent = 0
    job.error_message = None
    video.status = VideoStatus.PENDING.value
    video.processing_error = None
    
    db.commit()
    db.refresh(job)
    
    logger.info(f"Retrying OCR job for video {video.id} (attempt {job.retry_count + 1})")
    
    # Trigger background processing
    if background_tasks:
        background_tasks.add_task(run_ocr_processing, video.id, config)
    
    return JobStatusResponse(
        id=job.id,
        video_id=job.video_id,
        status=job.status,
        progress_percent=job.progress_percent,
        frames_processed=job.frames_processed or 0,
        ocr_success_rate=job.ocr_success_rate,
        error_message=job.error_message,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


@router.get("/pending", response_model=list[JobStatusResponse])
def list_pending_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"])),
):
    """
    List all pending and processing jobs.
    
    **Access Control:** ADMIN only.
    """
    jobs = db.query(HighlightJob).filter(
        HighlightJob.status.in_([VideoStatus.PENDING.value, VideoStatus.PROCESSING.value])
    ).all()
    
    return [
        JobStatusResponse(
            id=job.id,
            video_id=job.video_id,
            status=job.status,
            progress_percent=job.progress_percent,
            frames_processed=job.frames_processed or 0,
            ocr_success_rate=job.ocr_success_rate,
            error_message=job.error_message,
            created_at=job.created_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
        )
        for job in jobs
    ]
