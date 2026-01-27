#!/usr/bin/env python3
"""
Sync Storage to Database Script

Scans storage directories for processed video files and their metadata,
then populates the database with Video, HighlightJob, and HighlightEvent records.

This is a recovery script for videos that were processed via CLI but not
tracked in the database.

Usage:
    python scripts/sync_storage_to_db.py [--dry-run]
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.config import SessionLocal
from database.models.video import (
    Video, HighlightJob, HighlightEvent,
    VideoStatus, VideoVisibility, EventType
)
from database.models.user import User

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

# Storage paths (relative to backend directory)
STORAGE_ROOT = Path(__file__).parent.parent / "storage"
RAW_DIR = STORAGE_ROOT / "raw"
HIGHLIGHT_DIR = STORAGE_ROOT / "highlight"
TRIMMED_DIR = STORAGE_ROOT / "trimmed"


def get_admin_user(db) -> Optional[User]:
    """Get or create an admin user for synced videos."""
    admin = db.query(User).filter(User.role == "ADMIN").first()
    if admin:
        logger.info(f"Using existing admin user: {admin.email}")
        return admin
    
    # Check if any user exists to use as fallback
    any_user = db.query(User).first()
    if any_user:
        logger.warning(f"No admin user found, using fallback user: {any_user.email}")
        return any_user
    
    logger.error("No users found in database. Please create a user first.")
    return None


def find_metadata_files() -> List[Path]:
    """Find all supercut metadata JSON files."""
    if not HIGHLIGHT_DIR.exists():
        logger.warning(f"Highlight directory not found: {HIGHLIGHT_DIR}")
        return []
    
    metadata_files = list(HIGHLIGHT_DIR.glob("*_supercut_metadata.json"))
    logger.info(f"Found {len(metadata_files)} metadata files")
    return metadata_files


def parse_metadata(metadata_path: Path) -> Optional[Dict]:
    """Parse a supercut metadata JSON file."""
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse {metadata_path}: {e}")
        return None
    except Exception as e:
        logger.error(f"Error reading {metadata_path}: {e}")
        return None


def find_raw_video(video_id: str) -> Optional[Path]:
    """Find the raw video file for a given video ID."""
    for ext in ['.mp4', '.mkv', '.webm', '.avi']:
        raw_path = RAW_DIR / f"{video_id}{ext}"
        if raw_path.exists():
            return raw_path
    return None


def find_supercut(video_id: str) -> Optional[Path]:
    """Find the supercut video file."""
    # Check for different naming patterns
    patterns = [
        f"{video_id}_supercut.mp4",
        f"{video_id}_highlights.mp4",
        f"{video_id}_highlights_ocr.mp4",
    ]
    for pattern in patterns:
        path = HIGHLIGHT_DIR / pattern
        if path.exists():
            return path
    return None


def find_clips(video_id: str) -> List[Path]:
    """Find all clip files for a video."""
    clip_dir = TRIMMED_DIR / video_id
    if not clip_dir.exists():
        # Try flat structure
        clips = list(TRIMMED_DIR.glob(f"{video_id}_clip_*.mp4"))
        return clips
    return list(clip_dir.glob("*.mp4"))


def video_exists_in_db(db, video_id: str) -> bool:
    """Check if video already exists in database (by youtube ID in file_path)."""
    existing = db.query(Video).filter(
        Video.file_path.contains(video_id)
    ).first()
    return existing is not None


def sync_video(db, metadata: Dict, admin_user: User, dry_run: bool = False) -> bool:
    """
    Sync a single video and its events to the database.
    
    Returns True if sync was successful.
    """
    video_id = metadata.get("video_id")
    if not video_id:
        logger.error("Metadata missing video_id")
        return False
    
    logger.info(f"Processing video: {video_id}")
    
    # Check if already exists
    if video_exists_in_db(db, video_id):
        logger.info(f"  ⏭️  Video {video_id} already exists in database, skipping")
        return True
    
    # Find raw video
    raw_path = find_raw_video(video_id)
    if not raw_path:
        logger.warning(f"  ⚠️  Raw video not found for {video_id}, skipping")
        return False
    
    # Find supercut
    supercut_path = find_supercut(video_id)
    
    # Find clips
    clips = find_clips(video_id)
    
    # Extract event counts
    event_counts = metadata.get("event_counts", {})
    total_fours = event_counts.get("FOUR", 0)
    total_sixes = event_counts.get("SIX", 0)
    total_wickets = event_counts.get("WICKET", 0)
    total_events = metadata.get("total_events", total_fours + total_sixes + total_wickets)
    
    # Parse generation time
    generated_at_str = metadata.get("generated_at")
    generated_at = None
    if generated_at_str:
        try:
            generated_at = datetime.fromisoformat(generated_at_str)
        except ValueError:
            generated_at = datetime.utcnow()
    else:
        generated_at = datetime.utcnow()
    
    if dry_run:
        logger.info(f"  [DRY RUN] Would create:")
        logger.info(f"    - Video: {video_id} ({total_events} events)")
        logger.info(f"    - HighlightJob with supercut: {supercut_path}")
        logger.info(f"    - {len(metadata.get('segments', []))} HighlightEvents")
        return True
    
    # Create Video record
    video = Video(
        title=f"Match Video - {video_id}",
        description=f"Auto-imported from storage sync on {datetime.utcnow().isoformat()}",
        file_path=str(raw_path),
        visibility=VideoVisibility.PUBLIC.value,
        uploaded_by=admin_user.id,
        status=VideoStatus.COMPLETED.value,
        processing_started_at=generated_at,
        processing_completed_at=generated_at,
        total_events=total_events,
        total_fours=total_fours,
        total_sixes=total_sixes,
        total_wickets=total_wickets,
    )
    db.add(video)
    db.flush()  # Get the video ID
    
    logger.info(f"  ✅ Created Video record: {video.id}")
    
    # Create HighlightJob record
    job = HighlightJob(
        video_id=video.id,
        status=VideoStatus.COMPLETED.value,
        progress_percent=100,
        events_detected=metadata.get("segments", []),
        supercut_path=str(supercut_path) if supercut_path else None,
        started_at=generated_at,
        completed_at=generated_at,
    )
    db.add(job)
    logger.info(f"  ✅ Created HighlightJob record")
    
    # Create HighlightEvent records from segments
    segments = metadata.get("segments", [])
    clip_list = sorted(clips) if clips else []
    
    for i, segment in enumerate(segments):
        event_types = segment.get("event_types", [])
        event_type = event_types[0] if event_types else "FOUR"  # Default
        
        # Match clip to segment
        clip_path = None
        if i < len(clip_list):
            clip_path = str(clip_list[i])
        
        event = HighlightEvent(
            video_id=video.id,
            event_type=event_type,
            timestamp_seconds=segment.get("start_time", 0),
            clip_path=clip_path,
            clip_duration_seconds=segment.get("duration"),
        )
        db.add(event)
    
    logger.info(f"  ✅ Created {len(segments)} HighlightEvent records")
    
    return True


def sync_highlights_only(db, admin_user: User, dry_run: bool = False) -> Dict:
    """
    Alternative sync: Match _highlights.mp4 files with UUIDs already in DB.
    
    This handles the case where videos were uploaded via API (creating records)
    but processing was done manually.
    """
    stats = {"updated": 0, "skipped": 0, "errors": 0}
    
    # Find UUID-style highlight files
    for highlight_file in HIGHLIGHT_DIR.glob("*_highlights.mp4"):
        filename = highlight_file.stem  # e.g., "0ab2d719-88d9-4cda-b33e-1115234d8958_highlights"
        
        # Extract UUID
        if "_highlights" not in filename:
            continue
        
        uuid_part = filename.replace("_highlights", "").replace("_ocr", "")
        
        # Check if this UUID is a video ID in the database
        video = db.query(Video).filter(Video.id == uuid_part).first()
        if not video:
            continue
        
        # Check if job already has supercut path
        job = db.query(HighlightJob).filter(HighlightJob.video_id == video.id).first()
        
        if job and job.supercut_path:
            logger.info(f"  ⏭️  Video {video.id} already has supercut path, skipping")
            stats["skipped"] += 1
            continue
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would update video {video.id} with supercut: {highlight_file}")
            stats["updated"] += 1
            continue
        
        # Update video status
        video.status = VideoStatus.COMPLETED.value
        video.processing_completed_at = datetime.utcnow()
        
        # Update or create job
        if not job:
            job = HighlightJob(
                video_id=video.id,
                status=VideoStatus.COMPLETED.value,
                progress_percent=100,
                supercut_path=str(highlight_file),
                completed_at=datetime.utcnow(),
            )
            db.add(job)
        else:
            job.status = VideoStatus.COMPLETED.value
            job.progress_percent = 100
            job.supercut_path = str(highlight_file)
            job.completed_at = datetime.utcnow()
        
        logger.info(f"  ✅ Updated video {video.id} to COMPLETED with supercut")
        stats["updated"] += 1
    
    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Sync storage directories to database"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Show what would be synced without making changes"
    )
    parser.add_argument(
        "--mode",
        choices=["full", "update-existing"],
        default="full",
        help="full: Create new video records from metadata. "
             "update-existing: Only update existing video records with supercut paths."
    )
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info("Storage to Database Sync Script")
    logger.info("=" * 60)
    
    if args.dry_run:
        logger.info("🔍 DRY RUN MODE - No changes will be made")
    
    logger.info(f"Storage root: {STORAGE_ROOT}")
    logger.info(f"Sync mode: {args.mode}")
    logger.info("")
    
    # Open database session
    db = SessionLocal()
    
    try:
        # Get admin user
        admin_user = get_admin_user(db)
        if not admin_user:
            logger.error("Cannot proceed without a user. Create a user first.")
            sys.exit(1)
        
        stats = {"synced": 0, "skipped": 0, "errors": 0}
        
        if args.mode == "update-existing":
            logger.info("Running in update-existing mode...")
            result = sync_highlights_only(db, admin_user, args.dry_run)
            stats = result
        else:
            # Full sync from metadata files
            metadata_files = find_metadata_files()
            
            for metadata_path in metadata_files:
                metadata = parse_metadata(metadata_path)
                if not metadata:
                    stats["errors"] += 1
                    continue
                
                success = sync_video(db, metadata, admin_user, args.dry_run)
                if success:
                    stats["synced"] += 1
                else:
                    stats["errors"] += 1
        
        # Commit changes
        if not args.dry_run:
            db.commit()
            logger.info("")
            logger.info("✅ Changes committed to database")
        
        # Print summary
        logger.info("")
        logger.info("=" * 60)
        logger.info("SYNC SUMMARY")
        logger.info("=" * 60)
        logger.info(f"  Synced/Updated: {stats.get('synced', 0) + stats.get('updated', 0)}")
        logger.info(f"  Skipped:        {stats.get('skipped', 0)}")
        logger.info(f"  Errors:         {stats.get('errors', 0)}")
        
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
