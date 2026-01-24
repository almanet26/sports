"""
Video processing API routes.

Handles:
- Video upload (file + metadata)
- Public library browsing
- Private dashboard management
- Event filtering
- Legacy processing endpoints
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from pathlib import Path
from datetime import datetime
import logging
import shutil
import uuid

from utils.config import settings
from utils.auth import get_current_user, get_optional_user, require_role
from utils.youtube import download_youtube_video, validate_youtube_url
from database.config import get_db
from database.models.user import User
from database.models.video import Video, HighlightEvent, HighlightJob, VideoStatus, VideoVisibility
from schemas.video import (
    VideoUploadRequest, VideoUpdateRequest, VideoResponse, VideoListResponse,
    HighlightEventResponse, VideoEventsResponse
)
from sqlalchemy.orm import Session

# Lazy import for legacy engine functions
def get_engine_functions():
    from src.engine import (
        download_video,
        fetch_match_data,
        generate_highlights,
        create_highlight_reel,
    )
    return download_video, fetch_match_data, generate_highlights, create_highlight_reel

router = APIRouter(prefix="/videos", tags=["videos"])
logger = logging.getLogger(__name__)

# ============ Storage Configuration ============
UPLOAD_DIR = Path("storage/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ============ NEW: Video Upload Endpoints ============

@router.post("/upload", response_model=VideoResponse, status_code=201)
async def upload_video(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    match_date: Optional[str] = Form(None),
    teams: Optional[str] = Form(None),
    venue: Optional[str] = Form(None),
    visibility: str = Form("private"),
    padding_before: float = Form(12.0),
    padding_after: float = Form(8.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "COACH"])),
):
    """
    Upload a video file with metadata.
    
    **Access Control:** 
    - ADMIN: Can upload to public library
    - COACH (Premium): Can upload to private dashboard
    - PLAYER (Free): Cannot upload
    
    **File Constraints:**
    - Max size: 2GB
    - Formats: mp4, mkv, avi, mov, webm
    """
    # Validate file type
    allowed_extensions = {".mp4", ".mkv", ".avi", ".mov", ".webm"}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Enforce visibility rules
    if visibility == "public" and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Only admins can upload to public library"
        )
    
    # Generate unique filename
    video_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{video_id}{file_ext}"
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_size = file_path.stat().st_size
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save video file")
    
    # Parse match_date if provided
    parsed_date = None
    if match_date:
        try:
            parsed_date = datetime.fromisoformat(match_date)
        except ValueError:
            pass
    
    # Create video record
    video = Video(
        id=video_id,
        title=title,
        description=description,
        file_path=str(file_path),
        file_size_bytes=file_size,
        match_date=parsed_date,
        teams=teams,
        venue=venue,
        visibility=visibility,
        uploaded_by=current_user.id,
        status=VideoStatus.PENDING.value,
    )
    
    db.add(video)
    db.commit()
    db.refresh(video)
    
    logger.info(f"Video uploaded: {video.id} by {current_user.email}")
    
    return VideoResponse(
        id=video.id,
        title=video.title,
        description=video.description,
        duration_seconds=video.duration_seconds,
        match_date=video.match_date,
        teams=video.teams,
        venue=video.venue,
        visibility=video.visibility,
        status=video.status,
        total_events=video.total_events or 0,
        total_fours=video.total_fours or 0,
        total_sixes=video.total_sixes or 0,
        total_wickets=video.total_wickets or 0,
        uploaded_by=video.uploaded_by,
        created_at=video.created_at,
    )


@router.post("/upload/youtube", response_model=VideoResponse, status_code=201)
async def upload_youtube_video(
    url: str = Form(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    match_date: Optional[str] = Form(None),
    teams: Optional[str] = Form(None),
    venue: Optional[str] = Form(None),
    visibility: str = Form("private"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN", "COACH"])),
):
    """
    Upload a video from YouTube URL.
    
    **Access Control:** 
    - ADMIN: Can upload to public library
    - COACH (Premium): Can upload to private dashboard
    - PLAYER (Free): Cannot upload
    
    **Process:**
    1. Validates YouTube URL
    2. Downloads video using yt-dlp
    3. Stores in uploads directory
    4. Creates video record with metadata
    """
    # Validate YouTube URL
    if not validate_youtube_url(url):
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL. Please provide a valid YouTube video link."
        )
    
    # Enforce visibility rules
    if visibility == "public" and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Only admins can upload to public library"
        )
    
    # Generate unique video ID
    video_id = str(uuid.uuid4())
    
    # Download video from YouTube
    try:
        logger.info(f"Downloading YouTube video: {url}")
        download_result = download_youtube_video(
            url=url,
            output_dir=UPLOAD_DIR,
            video_id=video_id,
        )
        
        file_path = Path(download_result['file_path'])
        file_size = download_result['file_size']
        duration = download_result['duration']
        youtube_title = download_result['title']
        
        # Use provided title or fall back to YouTube title
        final_title = title if title else youtube_title
        
    except Exception as e:
        logger.error(f"Failed to download YouTube video: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download video from YouTube: {str(e)}"
        )
    
    # Parse match_date if provided
    parsed_date = None
    if match_date:
        try:
            parsed_date = datetime.fromisoformat(match_date)
        except ValueError:
            pass
    
    # Create video record
    video = Video(
        id=video_id,
        title=final_title,
        description=description,
        file_path=str(file_path),
        file_size_bytes=file_size,
        duration_seconds=duration,
        match_date=parsed_date,
        teams=teams,
        venue=venue,
        visibility=visibility,
        uploaded_by=current_user.id,
        status=VideoStatus.PENDING.value,
    )
    
    db.add(video)
    db.commit()
    db.refresh(video)
    
    logger.info(f"YouTube video uploaded: {video.id} from {url} by {current_user.email}")
    
    return VideoResponse(
        id=video.id,
        title=video.title,
        description=video.description,
        duration_seconds=video.duration_seconds,
        match_date=video.match_date,
        teams=video.teams,
        venue=video.venue,
        visibility=video.visibility,
        status=video.status,
        total_events=video.total_events or 0,
        total_fours=video.total_fours or 0,
        total_sixes=video.total_sixes or 0,
        total_wickets=video.total_wickets or 0,
        uploaded_by=video.uploaded_by,
        created_at=video.created_at,
    )


@router.get("/all", response_model=VideoListResponse)
def list_all_videos(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    visibility: Optional[str] = Query(None, description="Filter by visibility: PUBLIC, PRIVATE"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"])),
):
    """
    List ALL videos (Admin only).
    
    **Access Control:** ADMIN only.
    """
    offset = (page - 1) * per_page
    
    query = db.query(Video).filter(Video.deleted_at.is_(None))
    
    if visibility:
        query = query.filter(Video.visibility == visibility)
    
    total = query.count()
    videos = query.order_by(Video.created_at.desc()).offset(offset).limit(per_page).all()
    
    return VideoListResponse(
        videos=[VideoResponse(
            id=v.id,
            title=v.title,
            description=v.description,
            duration_seconds=v.duration_seconds,
            match_date=v.match_date,
            teams=v.teams,
            venue=v.venue,
            visibility=v.visibility,
            status=v.status,
            total_events=v.total_events or 0,
            total_fours=v.total_fours or 0,
            total_sixes=v.total_sixes or 0,
            total_wickets=v.total_wickets or 0,
            uploaded_by=v.uploaded_by,
            created_at=v.created_at,
            file_path=v.file_path,
            supercut_path=v.highlight_job.supercut_path if v.highlight_job else None,
        ) for v in videos],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/public", response_model=VideoListResponse)
def list_public_videos(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    List all public videos (Public Library).
    
    **Access:** Open to all users (including unauthenticated).
    """
    offset = (page - 1) * per_page
    
    query = db.query(Video).filter(
        Video.visibility == VideoVisibility.PUBLIC.value,
        Video.deleted_at.is_(None),
    )
    
    total = query.count()
    videos = query.order_by(Video.created_at.desc()).offset(offset).limit(per_page).all()
    
    return VideoListResponse(
        videos=[VideoResponse(
            id=v.id,
            title=v.title,
            description=v.description,
            duration_seconds=v.duration_seconds,
            match_date=v.match_date,
            teams=v.teams,
            venue=v.venue,
            visibility=v.visibility,
            status=v.status,
            total_events=v.total_events or 0,
            total_fours=v.total_fours or 0,
            total_sixes=v.total_sixes or 0,
            total_wickets=v.total_wickets or 0,
            uploaded_by=v.uploaded_by,
            created_at=v.created_at,
            file_path=v.file_path,
            supercut_path=v.highlight_job.supercut_path if v.highlight_job else None,
        ) for v in videos],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/private", response_model=VideoListResponse)
def list_private_videos(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["COACH"])),
):
    """
    List user's private videos (Premium Dashboard).
    
    **Access Control:** COACH (Premium) only.
    """
    offset = (page - 1) * per_page
    
    query = db.query(Video).filter(
        Video.uploaded_by == current_user.id,
        Video.visibility == VideoVisibility.PRIVATE.value,
        Video.deleted_at.is_(None),
    )
    
    total = query.count()
    videos = query.order_by(Video.created_at.desc()).offset(offset).limit(per_page).all()
    
    return VideoListResponse(
        videos=[VideoResponse(
            id=v.id,
            title=v.title,
            description=v.description,
            duration_seconds=v.duration_seconds,
            match_date=v.match_date,
            teams=v.teams,
            venue=v.venue,
            visibility=v.visibility,
            status=v.status,
            total_events=v.total_events or 0,
            total_fours=v.total_fours or 0,
            total_sixes=v.total_sixes or 0,
            total_wickets=v.total_wickets or 0,
            uploaded_by=v.uploaded_by,
            created_at=v.created_at,
            file_path=v.file_path,
            supercut_path=v.highlight_job.supercut_path if v.highlight_job else None,
        ) for v in videos],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{video_id}", response_model=VideoResponse)
def get_video(
    video_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Get video details by ID.
    
    **Access Control:**
    - Public videos: accessible to all (no auth required)
    - Private videos: owner or ADMIN only
    """
    video = db.query(Video).filter(Video.id == video_id, Video.deleted_at.is_(None)).first()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check access - public videos are accessible to everyone
    if video.visibility == VideoVisibility.PRIVATE.value:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required for private videos")
        if video.uploaded_by != current_user.id and current_user.role != "ADMIN":
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Get supercut_path from highlight_job if available
    supercut_path = None
    if video.highlight_job and video.highlight_job.supercut_path:
        supercut_path = video.highlight_job.supercut_path
    
    return VideoResponse(
        id=video.id,
        title=video.title,
        description=video.description,
        duration_seconds=video.duration_seconds,
        match_date=video.match_date,
        teams=video.teams,
        venue=video.venue,
        visibility=video.visibility,
        status=video.status,
        total_events=video.total_events or 0,
        total_fours=video.total_fours or 0,
        total_sixes=video.total_sixes or 0,
        total_wickets=video.total_wickets or 0,
        uploaded_by=video.uploaded_by,
        created_at=video.created_at,
        file_path=video.file_path,
        supercut_path=supercut_path,
    )


@router.get("/{video_id}/stream")
def stream_video(
    video_id: str,
):
    """
    Stream the original video file.
    
    **Access Control:**
    - Public videos: accessible to all (no auth required)
    - Private videos: owner or ADMIN only
    
    Note: Database session is managed manually to prevent connection
    timeout during long video streams.
    """
    # Manually manage DB session to close before streaming
    from database.config import SessionLocal
    db = SessionLocal()
    
    try:
        video = db.query(Video).filter(Video.id == video_id, Video.deleted_at.is_(None)).first()
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # For private videos, we'd need auth - but for simplicity, 
        # only serve public videos without auth on this endpoint
        if video.visibility == VideoVisibility.PRIVATE.value:
            raise HTTPException(status_code=401, detail="Authentication required for private videos")
        
        # Extract needed data before closing session
        file_path_str = video.file_path
        video_title = video.title
    finally:
        db.close()
    
    # Now stream file with DB connection closed
    file_path = Path(file_path_str)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    
    return FileResponse(
        path=str(file_path),
        media_type="video/mp4",
        filename=f"{video_title}.mp4",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    )


@router.get("/{video_id}/supercut")
def stream_supercut(
    video_id: str,
):
    """
    Stream the generated highlight supercut video.
    
    **Access Control:**
    - Public videos: accessible to all (no auth required)
    - Private videos: require authentication (use /stream endpoint with auth)
    
    **Status:**
    - 404 if supercut not yet generated (processing still in progress)
    
    Note: Database session is managed manually to prevent connection
    timeout during long video streams.
    """
    # Manually manage DB session to close before streaming
    from database.config import SessionLocal
    db = SessionLocal()
    
    try:
        video = db.query(Video).filter(Video.id == video_id, Video.deleted_at.is_(None)).first()
        
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # For private videos, require authentication
        if video.visibility == VideoVisibility.PRIVATE.value:
            raise HTTPException(status_code=401, detail="Authentication required for private videos")
        
        # Check if highlight job exists and has supercut
        if not video.highlight_job or not video.highlight_job.supercut_path:
            raise HTTPException(status_code=404, detail="Supercut not yet generated. Processing may still be in progress.")
        
        # Extract needed data before closing session
        supercut_path_str = video.highlight_job.supercut_path
        video_title = video.title
    finally:
        db.close()
    
    # Now stream file with DB connection closed
    supercut_path = Path(supercut_path_str)
    if not supercut_path.exists():
        raise HTTPException(status_code=404, detail="Supercut file not found on disk")
    
    return FileResponse(
        path=str(supercut_path),
        media_type="video/mp4",
        filename=f"{video_title}_highlights.mp4",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    )


@router.get("/{video_id}/events", response_model=VideoEventsResponse)
def get_video_events(
    video_id: str,
    event_type: Optional[str] = Query(None, description="Filter by event type: FOUR, SIX, WICKET"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Get highlight events for a video with optional filtering.
    
    **Filters:**
    - `event_type=FOUR`: Show only fours
    - `event_type=SIX`: Show only sixes
    - `event_type=WICKET`: Show only wickets
    
    **Access Control:**
    - Public videos: accessible to all (no auth required)
    - Private videos: owner or ADMIN only
    """
    video = db.query(Video).filter(Video.id == video_id, Video.deleted_at.is_(None)).first()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check access - public videos are accessible to everyone
    if video.visibility == VideoVisibility.PRIVATE.value:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required for private videos")
        if video.uploaded_by != current_user.id and current_user.role != "ADMIN":
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Query events
    query = db.query(HighlightEvent).filter(HighlightEvent.video_id == video_id)
    
    if event_type:
        event_type = event_type.upper()
        if event_type not in ["FOUR", "SIX", "WICKET"]:
            raise HTTPException(status_code=400, detail="Invalid event_type. Use: FOUR, SIX, WICKET")
        query = query.filter(HighlightEvent.event_type == event_type)
    
    events = query.order_by(HighlightEvent.timestamp_seconds).all()
    
    return VideoEventsResponse(
        video_id=video_id,
        events=[HighlightEventResponse(
            id=e.id,
            event_type=e.event_type,
            timestamp_seconds=e.timestamp_seconds,
            score_before=e.score_before,
            score_after=e.score_after,
            overs=e.overs,
            clip_path=e.clip_path,
            clip_duration_seconds=e.clip_duration_seconds,
        ) for e in events],
        total=len(events),
        filter_applied=event_type,
    )


@router.post("/{video_id}/publish", response_model=VideoResponse)
def publish_video(
    video_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["COACH"])),
):
    """
    Publish a private video to the public library.
    
    **Access Control:** COACH (Premium) only - can publish their own videos.
    """
    video = db.query(Video).filter(
        Video.id == video_id,
        Video.uploaded_by == current_user.id,
        Video.deleted_at.is_(None),
    ).first()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied")
    
    if video.visibility == VideoVisibility.PUBLIC.value:
        raise HTTPException(status_code=400, detail="Video is already public")
    
    if video.status != VideoStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Only processed videos can be published")
    
    video.visibility = VideoVisibility.PUBLIC.value
    db.commit()
    db.refresh(video)
    
    logger.info(f"Video published: {video.id} by {current_user.email}")
    
    return VideoResponse(
        id=video.id,
        title=video.title,
        description=video.description,
        duration_seconds=video.duration_seconds,
        match_date=video.match_date,
        teams=video.teams,
        venue=video.venue,
        visibility=video.visibility,
        status=video.status,
        total_events=video.total_events or 0,
        total_fours=video.total_fours or 0,
        total_sixes=video.total_sixes or 0,
        total_wickets=video.total_wickets or 0,
        uploaded_by=video.uploaded_by,
        created_at=video.created_at,
    )


@router.delete("/{video_id}", status_code=204)
def delete_video(
    video_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft delete a video.
    
    **Access Control:**
    - Users can delete their own private videos
    - ADMIN can delete any video
    """
    video = db.query(Video).filter(Video.id == video_id, Video.deleted_at.is_(None)).first()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Check permission
    if video.uploaded_by != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Soft delete
    video.deleted_at = datetime.utcnow()
    db.commit()
    
    logger.info(f"Video deleted: {video.id} by {current_user.email}")
    
    return None


# ============ LEGACY: Existing Processing Endpoints ============
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
    
    # Import engine functions
    download_video, fetch_match_data, generate_highlights, create_highlight_reel = get_engine_functions()
    
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

        # Import engine functions
        _, _, _, create_highlight_reel = get_engine_functions()

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
