"""
Background task service for OCR-based highlight generation.

Integrates with the existing ocr_engine.py to process videos asynchronously.
"""

import logging
import traceback
import os
import tempfile
import time
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List

import google.auth
import google.auth.transport.requests
from sqlalchemy import text
from sqlalchemy.orm import Session

from database.config import get_background_db, BackgroundSessionLocal
from database.models.video import Video, HighlightJob, HighlightEvent, VideoStatus

logger = logging.getLogger(__name__)

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")

# Mirrors LOCAL_UPLOAD_ROOT in api/routes/storage.py — duplicated here (rather than imported) to avoid a circular import, since storage.py imports from this module.
_USE_TMP = os.getenv("CLOUD_RUN", "").lower() in ("1", "true", "yes")
LOCAL_UPLOAD_ROOT = Path(tempfile.gettempdir()) / "uploads" if _USE_TMP else Path("storage/uploads")

_gcs_bucket = None
try:
    from google.cloud import storage as gcs

    if GCS_BUCKET_NAME:
        _gcs_bucket = gcs.Client().bucket(GCS_BUCKET_NAME)
except Exception as gcs_err:
    logger.warning("OCR task GCS init failed: %s", gcs_err)


def _extract_gcs_blob_name(video_path: str) -> str | None:
    if video_path.startswith("gs://"):
        without_scheme = video_path[5:]
        bucket, _, blob_name = without_scheme.partition("/")
        if bucket == GCS_BUCKET_NAME and blob_name:
            return blob_name
        return None

    marker = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/"
    if video_path.startswith(marker):
        return video_path[len(marker) :]

    if video_path.startswith("http://") or video_path.startswith("https://"):
        return None

    if "/" in video_path and Path(video_path).suffix:
        return video_path
    return None


def _generate_gcs_read_url(blob_name: str, hours: int = 6) -> str:
    if _gcs_bucket is None:
        raise RuntimeError("GCS bucket is not configured")

    blob = _gcs_bucket.blob(blob_name)
    auth_request = google.auth.transport.requests.Request()
    credentials, _ = google.auth.default()
    credentials.refresh(auth_request)

    service_account_email = getattr(credentials, "service_account_email", None)
    if not service_account_email:
        raise RuntimeError("Current ADC credentials are not service-account credentials")

    return blob.generate_signed_url(
        version="v4",
        expiration=datetime.utcnow() + timedelta(hours=hours),
        method="GET",
        service_account_email=service_account_email,
        access_token=credentials.token,
    )


def resolve_video_source(video_path: str) -> tuple[str, bool]:
    """Resolve a processable source and whether it should use streaming mode."""
    if Path(video_path).exists():
        return video_path, False

    local_candidate = LOCAL_UPLOAD_ROOT / video_path
    if local_candidate.exists():
        return str(local_candidate), False

    blob_name = _extract_gcs_blob_name(video_path)
    if blob_name and _gcs_bucket is not None:
        try:
            return _generate_gcs_read_url(blob_name), True
        except Exception as sign_err:
            logger.warning("Failed to sign read URL for %s: %s", blob_name, sign_err)
            return f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{blob_name}", True

    if video_path.startswith("http://") or video_path.startswith("https://"):
        return video_path, True

    return video_path, False


def _store_supercut(video_id: str, local_supercut_path: str, kind: str = "highlights") -> str:
    """Persist a generated supercut and return the URL/path stored in DB.

    ``kind`` distinguishes the combined reel ("highlights", the default - kept for backward compatibility with existing stored paths) from the split batting ("boundaries") and bowling ("wickets") reels.
    """
    if _gcs_bucket is not None:
        highlight_blob = f"highlights/{video_id}_{kind}.mp4"
        blob = _gcs_bucket.blob(highlight_blob)
        blob.upload_from_filename(local_supercut_path)
        return f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{highlight_blob}"

    highlight_dir = Path("storage/highlight")
    highlight_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{video_id}_{kind}.mp4"
    target = highlight_dir / filename
    with open(local_supercut_path, "rb") as src, open(target, "wb") as dst:
        dst.write(src.read())
    return f"/static/highlights/{filename}"


def probe_video_duration_seconds(video_path: str) -> Optional[int]:
    """Return rounded media duration in seconds using ffprobe."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return None
        duration = float(result.stdout.strip())
        if duration <= 0:
            return None
        return max(1, int(round(duration)))
    except Exception:
        return None


def _safe_rollback(db: Session) -> None:
    try:
        db.rollback()
    except Exception:
        pass


def _safe_close(db: Session) -> None:
    try:
        db.close()
    except Exception:
        pass


def _reconnect_and_load(db: Session, video_id: str, retries: int = 3, delay_seconds: float = 1.0) -> tuple[Session, Video | None, HighlightJob | None]:
    """Recover from broken DB session and reload video/job state with retries."""
    _safe_rollback(db)
    _safe_close(db)

    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            new_db: Session = BackgroundSessionLocal()
            video = new_db.query(Video).filter(Video.id == video_id).first()
            job = new_db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
            return new_db, video, job
        except Exception as exc:
            last_error = exc
            if attempt < retries - 1:
                time.sleep(delay_seconds * (attempt + 1))

    raise RuntimeError(f"Unable to reconnect DB session for video {video_id}: {last_error}")


def run_ocr_processing(video_id: str, config: Optional[Dict] = None) -> None:
    """
    Background task that runs the OCR engine on a video.
    
    This function is designed to be called from FastAPI's BackgroundTasks
    or a Celery worker.
    
    Args:
        video_id: UUID of the video to process
        config: Optional OCR configuration overrides (ROI settings, etc.)
    """
    # Use background session to avoid polluting the main connection pool
    db: Session = get_background_db()
    temp_video_path: str | None = None
    
    try:
        # Fetch video and job
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            logger.error(f"Video {video_id} not found")
            return

        source_video_path = video.file_path
        
        job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
        if not job:
            logger.error(f"HighlightJob for video {video_id} not found")
            return
        
        # Update status to processing
        video.status = VideoStatus.PROCESSING.value
        video.processing_started_at = datetime.utcnow()
        job.status = VideoStatus.PROCESSING.value
        job.started_at = datetime.utcnow()
        job.config = config
        
        # Commit and refresh connection
        db.commit()
        db.refresh(video)
        db.refresh(job)
        
        logger.info(f"Starting OCR processing for video: {video.title} ({video_id})")
        
        # Import OCR engine (lazy import to avoid circular dependencies)
        from scripts.ocr_engine import (
            ScoreboardConfig,
            process_video,
            process_video_streaming,
            process_video_optimized,
            extract_clips,
            extract_clips_parallel,
            create_supercut,
        )
        
        # Initialize OCR config
        ocr_config = ScoreboardConfig()
        
        # Apply custom config overrides if provided
        if config:
            if 'roi_x' in config:
                ocr_config.roi_x = config['roi_x']
            if 'roi_y' in config:
                ocr_config.roi_y = config['roi_y']
            if 'roi_width' in config:
                ocr_config.roi_width = config['roi_width']
            if 'roi_height' in config:
                ocr_config.roi_height = config['roi_height']
            if 'use_gpu' in config:
                ocr_config.use_gpu = config['use_gpu']
            if 'start_time' in config:
                ocr_config.start_time = config['start_time']
            if 'end_time' in config:
                ocr_config.end_time = config['end_time']
        
        # Run OCR detection - choose best mode based on source type
        video_source, use_streaming = resolve_video_source(video.file_path)
        
        # Check if parallel optimization is enabled (default: True for large videos)
        use_parallel = config.get('use_parallel', True) if config else True
        
        if use_streaming:
            # Streaming mode for remote sources (GCS signed URLs)
            logger.info("Using STREAMING mode (remote source)")
            events = process_video_streaming(
                video_source=video_source,
                config=ocr_config,
                sample_interval=1.0,
                min_confidence=0.4,
            )
        elif use_parallel:
            # Optimized parallel mode for local files (auto-detects video size)
            logger.info("Using OPTIMIZED mode (auto-selects parallel/sequential)")
            events = process_video_optimized(
                video_path=video_source,
                config=ocr_config,
                sample_interval=1.0,
                min_confidence=0.4,
                auto_parallel=True
            )
        else:
            # Legacy sequential mode (backward compatibility)
            logger.info("Using SEQUENTIAL mode (legacy)")
            events = process_video(
                video_path=video_source,
                config=ocr_config,
                sample_interval=1.0,
                min_confidence=0.4,
            )
        
        # Safety net: guarantee events fall within the requested timeline regardless of which processing mode ran (parallel chunking / streaming / sequential each enforce the cutoff independently, but this keeps the contract airtight).
        if config and ('start_time' in config or 'end_time' in config):
            range_start = float(config.get('start_time') or 0.0)
            range_end = config.get('end_time')
            events = [
                e for e in events
                if e['timestamp'] >= range_start and (range_end is None or e['timestamp'] <= float(range_end))
            ]

        logger.info(f"Detected {len(events)} events for video {video_id}")

        # Update job progress
        job.progress_percent = 50
        
        # Validate connection before commit (long OCR task may have timed out)
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            logger.warning("Database connection lost, creating new session")
            db, _, job = _reconnect_and_load(db, video_id)
            if job is None:
                raise RuntimeError(f"HighlightJob {video_id} not found during DB recovery")
            job.progress_percent = 50
        
        db.commit()
        db.refresh(job)
        
        # Extract clips using HTTP range requests from the same source and keep
        # temporary clips only inside a transient work directory.
        clip_before = config.get('padding_before', 12) if config else 12
        clip_after = config.get('padding_after', 8) if config else 8
        use_parallel_clips = config.get('parallel_clips', True) if config else True

        logger.info(f"Extracting clips with padding: before={clip_before}s, after={clip_after}s")

        # Batting highlights = FOUR/SIX events, bowling highlights = WICKET events - generated as separate reels alongside the existing combined supercut.
        boundary_events = [e for e in events if e['type'] in ('FOUR', 'SIX')]
        wicket_events = [e for e in events if e['type'] == 'WICKET']

        def _extract_reel(event_subset: List[Dict], output_root: Path, kind: str) -> Optional[str]:
            """Extract clips for a filtered subset of events and stitch them into a separately stored reel."""
            if not event_subset:
                return None

            reel_clips_dir = output_root / f"clips_{kind}"
            reel_clips_dir.mkdir(parents=True, exist_ok=True)

            if use_parallel_clips and len(event_subset) > 5:
                reel_clips = extract_clips_parallel(
                    video_path=video_source,
                    events=event_subset,
                    output_dir=str(reel_clips_dir),
                    before=clip_before,
                    after=clip_after,
                    max_workers=4
                )
            else:
                reel_clips = extract_clips(
                    video_path=video_source,
                    events=event_subset,
                    output_dir=str(reel_clips_dir),
                    before=clip_before,
                    after=clip_after,
                )

            if not reel_clips:
                return None

            reel_tmp = output_root / f"{video_id}_{kind}.mp4"
            reel_local = create_supercut(reel_clips, str(reel_tmp))
            return _store_supercut(video_id, reel_local, kind=kind) if reel_local else None

        clips: List[str] = []
        supercut_path: str | None = None
        supercut_duration_seconds: Optional[int] = None
        boundaries_supercut_path: str | None = None
        wickets_supercut_path: str | None = None
        with tempfile.TemporaryDirectory(prefix=f"ocr_{video_id}_") as work_dir:
            work_root = Path(work_dir)
            clips_dir = work_root / "clips"
            clips_dir.mkdir(parents=True, exist_ok=True)

            if events:
                if use_parallel_clips and len(events) > 5:
                    logger.info("Using PARALLEL clip extraction")
                    clips = extract_clips_parallel(
                        video_path=video_source,
                        events=events,
                        output_dir=str(clips_dir),
                        before=clip_before,
                        after=clip_after,
                        max_workers=4
                    )
                else:
                    logger.info("Using SEQUENTIAL clip extraction")
                    clips = extract_clips(
                        video_path=video_source,
                        events=events,
                        output_dir=str(clips_dir),
                        before=clip_before,
                        after=clip_after,
                    )

            # Create final supercut in the temp workspace and persist only the final artifact.
            if clips:
                supercut_tmp = work_root / f"{video_id}_highlights.mp4"
                supercut_local = create_supercut(clips, str(supercut_tmp))
                if supercut_local:
                    supercut_duration_seconds = probe_video_duration_seconds(supercut_local)
                    supercut_path = _store_supercut(video_id, supercut_local)

            boundaries_supercut_path = _extract_reel(boundary_events, work_root, "boundaries")
            wickets_supercut_path = _extract_reel(wicket_events, work_root, "wickets")
        
        job.progress_percent = 80
        
        # Validate connection before commit
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            logger.warning("Database connection lost, creating new session")
            db, _, job = _reconnect_and_load(db, video_id)
            if job is None:
                raise RuntimeError(f"HighlightJob {video_id} not found during DB recovery")
            job.progress_percent = 80
        
        db.commit()
        db.refresh(job)
        
        # Save events to database
        fours = sixes = wickets = 0
        for i, event in enumerate(events):
            highlight_event = HighlightEvent(
                video_id=video_id,
                event_type=event['type'],
                timestamp_seconds=event['timestamp'],
                score_before=event.get('score_before'),
                score_after=event.get('score_after'),
                clip_path=None,
            )
            db.add(highlight_event)
            
            # Count by type
            if event['type'] == 'FOUR':
                fours += 1
            elif event['type'] == 'SIX':
                sixes += 1
            elif event['type'] == 'WICKET':
                wickets += 1
        
        # Update video statistics
        video.status = VideoStatus.COMPLETED.value
        video.processing_completed_at = datetime.utcnow()
        video.total_events = len(events)
        video.total_fours = fours
        video.total_sixes = sixes
        video.total_wickets = wickets
        if supercut_duration_seconds is not None:
            video.duration_seconds = supercut_duration_seconds
        
        # Update job with results
        job.status = VideoStatus.COMPLETED.value
        job.progress_percent = 100
        job.completed_at = datetime.utcnow()
        job.events_detected = events
        job.supercut_path = supercut_path
        job.boundaries_supercut_path = boundaries_supercut_path
        job.wickets_supercut_path = wickets_supercut_path

        # Optional transient-source cleanup: keep only generated highlight artifact.
        if config and config.get("delete_source_after_processing") and source_video_path:
            source_path = Path(source_video_path)
            if source_path.exists() and source_path.is_file():
                try:
                    source_path.unlink(missing_ok=True)
                    if supercut_path:
                        video.file_path = supercut_path
                    logger.info("Deleted transient source video for %s: %s", video_id, source_video_path)
                except Exception as cleanup_err:
                    logger.warning("Failed to delete transient source %s: %s", source_video_path, cleanup_err)
        
        # Validate connection before final commit
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            logger.warning("Database connection lost, creating new session")
            db, video, job = _reconnect_and_load(db, video_id)
            if video is None or job is None:
                raise RuntimeError(f"Video/job missing during final DB recovery for {video_id}")
            
            # Re-apply final updates
            video.status = VideoStatus.COMPLETED.value
            video.processing_completed_at = datetime.utcnow()
            video.total_events = len(events)
            video.total_fours = fours
            video.total_sixes = sixes
            video.total_wickets = wickets
            if supercut_duration_seconds is not None:
                video.duration_seconds = supercut_duration_seconds
            
            job.status = VideoStatus.COMPLETED.value
            job.progress_percent = 100
            job.completed_at = datetime.utcnow()
            job.events_detected = events
            job.supercut_path = supercut_path
            job.boundaries_supercut_path = boundaries_supercut_path
            job.wickets_supercut_path = wickets_supercut_path

        db.commit()
        
        logger.info(f"Completed OCR processing for video {video_id}: "
                    f"{fours} fours, {sixes} sixes, {wickets} wickets")
        
    except Exception as e:
        logger.error(f"OCR processing failed for video {video_id}: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Rollback any pending transaction
        _safe_rollback(db)
        
        # Update status to failed with retries to survive temporary DNS/network loss.
        error_text = str(e)[:500]
        max_failure_update_retries = 6
        for attempt in range(max_failure_update_retries):
            try:
                try:
                    db.execute(text("SELECT 1"))
                except Exception:
                    logger.warning("Database session invalid, recreating session for error update")
                    db, _, _ = _reconnect_and_load(db, video_id, retries=3, delay_seconds=1.0)

                video = db.query(Video).filter(Video.id == video_id).first()
                job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()

                if video:
                    video.status = VideoStatus.FAILED.value
                    video.processing_error = error_text

                if job:
                    job.status = VideoStatus.FAILED.value
                    job.error_message = error_text
                    job.retry_count += 1

                db.commit()
                logger.info("Marked OCR job as FAILED for video %s after error", video_id)
                break
            except Exception as db_error:
                logger.error(
                    "Failed to update error status for %s (attempt %s/%s): %s",
                    video_id,
                    attempt + 1,
                    max_failure_update_retries,
                    db_error,
                )
                _safe_rollback(db)
                if attempt < max_failure_update_retries - 1:
                    time.sleep(2.0 * (attempt + 1))
                else:
                    logger.error("Giving up marking FAILED state for %s after repeated DB failures", video_id)
    
    finally:
        if temp_video_path and os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except OSError:
                pass
        _safe_close(db)


def get_job_status(video_id: str) -> Optional[Dict]:
    """
    Get the current status of a processing job.
    
    Args:
        video_id: UUID of the video
        
    Returns:
        Job status dictionary or None if not found
    """
    db = BackgroundSessionLocal()
    try:
        job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
        if job:
            return job.to_dict()
        return None
    finally:
        db.close()


def retry_failed_job(video_id: str, config: Optional[Dict] = None) -> bool:
    """
    Retry a failed processing job.
    
    Args:
        video_id: UUID of the video to retry
        config: Optional new configuration
        
    Returns:
        True if retry was initiated, False otherwise
    """
    db = BackgroundSessionLocal()
    try:
        job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
        
        if not job:
            logger.error(f"No job found for video {video_id}")
            return False
        
        if job.status != VideoStatus.FAILED.value:
            logger.warning(f"Job for video {video_id} is not in FAILED state")
            return False
        
        if job.retry_count >= 3:
            logger.error(f"Max retries exceeded for video {video_id}")
            return False
        
        # Reset job status
        job.status = VideoStatus.PENDING.value
        job.progress_percent = 0
        job.error_message = None
        db.commit()
        
        logger.info(f"Retrying job for video {video_id} (attempt {job.retry_count + 1})")
        
        # Trigger processing (would be called via BackgroundTasks in real implementation)
        run_ocr_processing(video_id, config)
        
        return True
        
    finally:
        db.close()
