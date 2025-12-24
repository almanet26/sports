"""
Video processing API routes.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
import logging

from src.engine import (
    download_video,
    fetch_match_data,
    generate_highlights,
    create_highlight_reel,
)
from utils.config import settings
from utils.auth import get_current_user
from database.models.user import User

router = APIRouter(prefix="/videos", tags=["videos"])
logger = logging.getLogger(__name__)


class VideoProcessRequest(BaseModel):
    """Request model for video processing."""

    video_url: HttpUrl
    match_id: str  # Required: Match ID from Cricsheet, Sportmonks, etc.
    data_source: str = "cricsheet"  # cricsheet (FREE), sportmonks, cricapi, rapidapi, espncricinfo
    merge_threshold: float = 10.0


class VideoProcessResponse(BaseModel):
    """Response model for video processing."""

    job_id: str
    status: str
    message: str


class HighlightClip(BaseModel):
    """Model for a highlight clip."""

    filename: str
    duration: float
    event_types: List[str]
    start_time: float
    end_time: float


class HighlightsResponse(BaseModel):
    """Response model for generated highlights."""

    video_id: str
    total_clips: int
    clips: List[HighlightClip]


def process_video_task(
    job_id: str,
    video_url: str,
    match_id: str,
    data_source: str,
    merge_threshold: float,
    user_id: int,
):
    """Background task for processing video and generating highlights."""
    from database.config import get_db
    from database.models.session import ProcessingJob, JobStatus
    from datetime import datetime
    
    db = next(get_db())
    
    try:
        logger.info(f"Starting video processing job {job_id} for user {user_id}: {video_url}")
        
        # Update job status to processing
        job = db.query(ProcessingJob).filter(ProcessingJob.job_id == job_id).first()
        if job:
            job.status = JobStatus.PROCESSING
            job.started_at = datetime.utcnow()
            db.commit()

        # Step 1: Download video
        logger.info(f"[Job {job_id}] Step 1/3: Downloading video...")
        video_info = download_video(video_url, settings.STORAGE_RAW_PATH)
        video_id = video_info["video_id"]
        logger.info(f"[Job {job_id}] Downloaded video: {video_id}")

        # Step 2: Fetch match data from API (NO MOCK DATA)
        logger.info(f"[Job {job_id}] Step 2/3: Fetching ball-by-ball data from {data_source}...")
        events = fetch_match_data(match_id, source=data_source)
        
        if not events:
            raise ValueError(
                f"No events found for match_id '{match_id}' from source '{data_source}'. "
                f"Please verify the match ID is correct. "
                f"For Cricsheet: Browse https://cricsheet.org/matches/ for available matches."
            )

        logger.info(f"[Job {job_id}] Fetched {len(events)} events from {data_source}")

        # Step 3: Generate highlights
        logger.info(f"[Job {job_id}] Step 3/3: Generating highlight clips...")
        clips = generate_highlights(
            video_id=video_id,
            events=events,
            raw_folder=settings.STORAGE_RAW_PATH,
            output_folder=settings.STORAGE_TRIMMED_PATH,
            merge_threshold=merge_threshold,
        )

        logger.info(f"[Job {job_id}] Generated {len(clips)} clips for video {video_id}")

        # Update database with success status
        if job:
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            job.video_id = video_id
            job.total_clips = len(clips)
            job.total_events = len(events)
            job.result_data = {
                "clips": clips,
                "events": len(events),
                "data_source": data_source,
                "match_id": match_id
            }
            db.commit()
            logger.info(f"[Job {job_id}] Completed successfully")

    except Exception as e:
        logger.error(f"[Job {job_id}] Error processing video: {str(e)}", exc_info=True)
        
        # Update database with error status
        if job:
            job.status = JobStatus.FAILED
            job.completed_at = datetime.utcnow()
            job.error_message = str(e)
            db.commit()
            logger.error(f"[Job {job_id}] Failed with error: {str(e)}")
    
    finally:
        db.close()


@router.post("/process", response_model=VideoProcessResponse)
async def process_video(
    request: VideoProcessRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """
    Process a video to generate highlights.
    Workflow:
    1. Downloads video from URL
    2. Fetches ball-by-ball data from specified API source
    3. Generates highlight clips with intelligent merging
    4. Returns job ID for tracking progress
    """
    try:
        # Generate job ID
        import uuid

        job_id = str(uuid.uuid4())

        # Create job record in database
        from database.config import get_db
        from database.models.session import ProcessingJob, JobStatus
        from datetime import datetime
        
        db = next(get_db())
        job = ProcessingJob(
            job_id=job_id,
            user_id=current_user.id,
            video_url=str(request.video_url),
            match_id=request.match_id,
            data_source=request.data_source,
            status=JobStatus.QUEUED,
            created_at=datetime.utcnow()
        )
        db.add(job)
        db.commit()
        db.close()

        # Add background task
        background_tasks.add_task(
            process_video_task,
            job_id,
            str(request.video_url),
            request.match_id,
            request.data_source,
            request.merge_threshold,
            current_user.id,
        )

        logger.info(f"Queued video processing job {job_id} for user {current_user.id}")

        return VideoProcessResponse(
            job_id=job_id,
            status="queued",
            message="Video processing started. Check status using the job ID.",
        )

    except Exception as e:
        logger.error(f"Error queuing video processing: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/highlights/{video_id}", response_model=HighlightsResponse)
async def get_highlights(video_id: str, current_user: User = Depends(get_current_user)):
    """
    Get generated highlights for a video.
    Returns list of clips with metadata.
    """
    try:
        import json
        from pathlib import Path

        manifest_path = (
            Path(settings.STORAGE_TRIMMED_PATH) / f"{video_id}_manifest.json"
        )

        if not manifest_path.exists():
            raise HTTPException(status_code=404, detail="Highlights not found")

        with open(manifest_path, "r") as f:
            data = json.load(f)

        return HighlightsResponse(**data)

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Highlights not found")
    except Exception as e:
        logger.error(f"Error fetching highlights: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{job_id}")
async def get_job_status(job_id: str, current_user: User = Depends(get_current_user)):
    """
    Get the status of a video processing job.
    Returns job status and progress information.
    """
    from database.config import get_db
    from database.models.session import ProcessingJob
    
    db = next(get_db())
    
    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.job_id == job_id).first()
        
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
        
        # Verify user owns this job
        if job.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied to this job")
        
        response = {
            "job_id": job.job_id,
            "status": job.status.value,
            "video_url": job.video_url,
            "match_id": job.match_id,
            "data_source": job.data_source,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        }
        
        # Add additional fields based on status
        if job.status.value == "completed":
            response["video_id"] = job.video_id
            response["total_clips"] = job.total_clips
            response["total_events"] = job.total_events
            response["result_data"] = job.result_data
            response["message"] = f"Processing complete! Generated {job.total_clips} clips from {job.total_events} events."
        elif job.status.value == "failed":
            response["error_message"] = job.error_message
            response["message"] = f"Processing failed: {job.error_message}"
        elif job.status.value == "processing":
            response["message"] = "Video is currently being processed..."
        else:  # queued
            response["message"] = "Job is queued and will start processing soon."
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching job status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.post("/create-reel")
async def create_reel(
    video_id: str,
    events: List[dict],
    merge_threshold: float = 10.0,
    current_user: User = Depends(get_current_user),
):
    """
    Create a single consolidated highlight reel from events.
    - video_id: Video ID (must exist in storage/raw/)
    - events: List of event dicts with 'time' and 'type' keys
    - merge_threshold: Merge events within this many seconds (default: 10.0)
    Returns path to the generated highlight reel.
    """
    try:
        from pathlib import Path

        # Construct video path
        video_path = Path(settings.STORAGE_RAW_PATH) / f"{video_id}.mp4"

        if not video_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Video not found: {video_id}. Please upload/process the video first.",
            )

        logger.info(
            f"Creating highlight reel for video {video_id} with {len(events)} events"
        )

        # Create the highlight reel
        reel_path = create_highlight_reel(
            video_path=str(video_path), events=events, merge_threshold=merge_threshold
        )

        reel_file = Path(reel_path)
        file_size_mb = reel_file.stat().st_size / (1024 * 1024)

        return {
            "success": True,
            "video_id": video_id,
            "reel_path": str(reel_path),
            "file_size_mb": round(file_size_mb, 2),
            "total_events": len(events),
            "message": "Highlight reel created successfully",
        }

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating highlight reel: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
