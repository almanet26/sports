"""
Background task service for OCR-based highlight generation.

Integrates with the existing ocr_engine.py to process videos asynchronously.
"""

import logging
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List

from sqlalchemy import text
from sqlalchemy.orm import Session

from database.config import get_background_db, BackgroundSessionLocal
from database.models.video import Video, HighlightJob, HighlightEvent, VideoStatus

logger = logging.getLogger(__name__)


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
    
    try:
        # Fetch video and job
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            logger.error(f"Video {video_id} not found")
            return
        
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
            extract_clips,
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
        
        # Run OCR detection
        video_path = video.file_path
        events = process_video(
            video_path=video_path,
            config=ocr_config,
            sample_interval=1.0,
            min_confidence=0.4,
        )
        
        logger.info(f"Detected {len(events)} events for video {video_id}")
        
        # Update job progress
        job.progress_percent = 50
        
        # Validate connection before commit (long OCR task may have timed out)
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            logger.warning("Database connection lost, creating new session")
            db.rollback()
            db.close()
            db = BackgroundSessionLocal()
            job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
            job.progress_percent = 50
        
        db.commit()
        db.refresh(job)
        
        # Extract clips
        clips_dir = Path("storage/trimmed") / video_id
        clips_dir.mkdir(parents=True, exist_ok=True)
        
        clips = []
        if events:
            clips = extract_clips(
                video_path=video_path,
                events=events,
                output_dir=str(clips_dir),
                before=12,
                after=5,
            )
        
        job.progress_percent = 80
        
        # Validate connection before commit
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            logger.warning("Database connection lost, creating new session")
            db.rollback()
            db.close()
            db = BackgroundSessionLocal()
            job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
            job.progress_percent = 80
        
        db.commit()
        db.refresh(job)
        
        # Create supercut
        supercut_path = None
        if clips:
            supercut_dir = Path("storage/highlight")
            supercut_dir.mkdir(parents=True, exist_ok=True)
            supercut_file = supercut_dir / f"{video_id}_highlights.mp4"
            supercut_path = create_supercut(clips, str(supercut_file))
        
        # Save events to database
        fours = sixes = wickets = 0
        for i, event in enumerate(events):
            highlight_event = HighlightEvent(
                video_id=video_id,
                event_type=event['type'],
                timestamp_seconds=event['timestamp'],
                score_before=event.get('score_before'),
                score_after=event.get('score_after'),
                clip_path=clips[i] if i < len(clips) else None,
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
        
        # Update job with results
        job.status = VideoStatus.COMPLETED.value
        job.progress_percent = 100
        job.completed_at = datetime.utcnow()
        job.events_detected = events
        job.supercut_path = supercut_path
        
        # Validate connection before final commit
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            logger.warning("Database connection lost, creating new session")
            db.rollback()
            db.close()
            db = BackgroundSessionLocal()
            video = db.query(Video).filter(Video.id == video_id).first()
            job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
            
            # Re-apply final updates
            video.status = VideoStatus.COMPLETED.value
            video.processing_completed_at = datetime.utcnow()
            video.total_events = len(events)
            video.total_fours = fours
            video.total_sixes = sixes
            video.total_wickets = wickets
            
            job.status = VideoStatus.COMPLETED.value
            job.progress_percent = 100
            job.completed_at = datetime.utcnow()
            job.events_detected = events
            job.supercut_path = supercut_path
        
        db.commit()
        
        logger.info(f"✅ Completed OCR processing for video {video_id}: "
                    f"{fours} fours, {sixes} sixes, {wickets} wickets")
        
    except Exception as e:
        logger.error(f"❌ OCR processing failed for video {video_id}: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Rollback any pending transaction
        try:
            db.rollback()
        except Exception:
            pass
        
        # Update status to failed with new session if needed
        try:
            # Test if session is still valid
            try:
                db.execute(text("SELECT 1"))
            except Exception:
                # Session is dead, create new one
                logger.warning("Database session invalid, creating new session for error update")
                db.close()
                db = BackgroundSessionLocal()
            
            video = db.query(Video).filter(Video.id == video_id).first()
            job = db.query(HighlightJob).filter(HighlightJob.video_id == video_id).first()
            
            if video:
                video.status = VideoStatus.FAILED.value
                video.processing_error = str(e)[:500]  # Truncate to avoid huge errors
            
            if job:
                job.status = VideoStatus.FAILED.value
                job.error_message = str(e)[:500]
                job.retry_count += 1
            
            db.commit()
        except Exception as db_error:
            logger.error(f"Failed to update error status: {db_error}")
            db.rollback()
    
    finally:
        db.close()


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
