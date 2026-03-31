"""
Jobs API routes for triggering and monitoring OCR processing.
"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.user import User
from database.models.video import Video, HighlightJob, VideoStatus
from schemas.video import JobTriggerRequest, JobStatusResponse, JobResultResponse
from services.ocr_task import run_ocr_processing
from utils.auth import get_current_user, require_role

router = APIRouter(prefix="/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)


@router.post("/trigger", response_model=JobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
def trigger_ocr_job(
    request: JobTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "COACH"])),
):
    """
    Trigger OCR processing for a video.
    
    **Access Control:** ADMIN and COACH (Premium) only.
    
    This endpoint:
    1. Validates the video exists and belongs to the user (or user is admin)
    2. Creates a HighlightJob record if not exists
    3. Triggers the background OCR processing task
    """
    # Fetch video
    video = db.query(Video).filter(Video.id == request.video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )
    
    # Check ownership (unless admin)
    if current_user.role != "ADMIN" and video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to process this video"
        )
    
    # Check if already processing
    existing_job = db.query(HighlightJob).filter(HighlightJob.video_id == video.id).first()
    if existing_job and existing_job.status == VideoStatus.PROCESSING.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Video is already being processed"
        )
    
    # Create or reset job
    if existing_job:
        existing_job.status = VideoStatus.PENDING.value
        existing_job.progress_percent = 0
        existing_job.error_message = None
        existing_job.events_detected = None
        existing_job.supercut_path = None
        job = existing_job
    else:
        job = HighlightJob(
            video_id=video.id,
            status=VideoStatus.PENDING.value,
        )
        db.add(job)
    
    db.commit()
    db.refresh(job)
    
    logger.info(f"Triggering OCR job for video {video.id} by user {current_user.email}")
    
    # Trigger background processing
    background_tasks.add_task(run_ocr_processing, video.id, request.config)
    
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
