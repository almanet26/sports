"""
YouTube video download utilities using yt-dlp.
"""

import logging
import uuid
from pathlib import Path
from typing import Dict, Optional
import yt_dlp

logger = logging.getLogger(__name__)


def download_youtube_video(
    url: str,
    output_dir: Path,
    video_id: Optional[str] = None,
) -> Dict[str, any]:
    """
    Download a YouTube video using yt-dlp.
    
    Args:
        url: YouTube video URL
        output_dir: Directory to save the downloaded video
        video_id: Optional custom video ID (generates UUID if not provided)
    
    Returns:
        Dictionary containing:
        - video_id: Unique identifier
        - file_path: Path to downloaded video
        - title: Video title from YouTube
        - duration: Video duration in seconds
        - file_size: File size in bytes
    
    Raises:
        Exception: If download fails
    """
    if not video_id:
        video_id = str(uuid.uuid4())
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Configure yt-dlp options
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': str(output_dir / f'{video_id}.%(ext)s'),
        'quiet': False,
        'no_warnings': False,
        'extract_flat': False,
        'merge_output_format': 'mp4',
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',
        }],
        # Download restrictions
        'max_filesize': 2 * 1024 * 1024 * 1024,  # 2GB max
    }
    
    try:
        logger.info(f"Downloading YouTube video: {url}")
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract info without downloading first (to validate and get metadata)
            info = ydl.extract_info(url, download=False)
            
            if not info:
                raise ValueError("Could not extract video information")
            
            title = info.get('title', 'Unknown Title')
            duration = info.get('duration', 0)
            
            logger.info(f"Video info: {title} ({duration}s)")
            
            # Check duration (optional: skip very long videos)
            if duration > 14400:  # 4 hours
                raise ValueError("Video is too long (max 4 hours)")
            
            # Now download
            ydl.download([url])
        
        # Find the downloaded file (yt-dlp may add different extensions)
        downloaded_files = list(output_dir.glob(f"{video_id}.*"))
        
        if not downloaded_files:
            raise FileNotFoundError(f"Downloaded file not found for video_id: {video_id}")
        
        file_path = downloaded_files[0]
        file_size = file_path.stat().st_size
        
        logger.info(f"Successfully downloaded: {file_path} ({file_size} bytes)")
        
        return {
            'video_id': video_id,
            'file_path': str(file_path),
            'title': title,
            'duration': duration,
            'file_size': file_size,
        }
    
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        logger.error(f"yt-dlp download error: {error_msg}")
        
        # Provide user-friendly error messages
        if 'unavailable' in error_msg.lower():
            raise Exception("Video is unavailable or private. Please check the URL.")
        elif 'copyright' in error_msg.lower():
            raise Exception("Video cannot be downloaded due to copyright restrictions.")
        elif 'age' in error_msg.lower():
            raise Exception("Age-restricted video cannot be downloaded.")
        else:
            raise Exception(f"Failed to download video: {error_msg}")
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise Exception(str(e))
    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        raise Exception("Downloaded video file not found. Please try again.")
    except Exception as e:
        logger.error(f"YouTube download failed: {e}")
        raise Exception(f"Unexpected error during download: {str(e)}")


def validate_youtube_url(url: str) -> bool:
    """
    Validate if a URL is a valid YouTube URL.
    
    Args:
        url: URL string to validate
    
    Returns:
        True if valid YouTube URL, False otherwise
    """
    import re
    
    youtube_regex = (
        r'(https?://)?(www\.)?'
        r'(youtube|youtu|youtube-nocookie)\.(com|be)/'
        r'(watch\?v=|embed/|v/|.+\?v=)?([^&=%\?]{11})'
    )
    
    match = re.match(youtube_regex, url)
    return bool(match)


def extract_video_id_from_url(url: str) -> Optional[str]:
    """
    Extract the YouTube video ID from a URL.
    
    Args:
        url: YouTube URL
    
    Returns:
        YouTube video ID or None if not found
    """
    import re
    
    # Pattern to match various YouTube URL formats
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'(?:embed\/)([0-9A-Za-z_-]{11})',
        r'(?:watch\?v=)([0-9A-Za-z_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None
