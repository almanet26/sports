"""
YouTube video download utilities using yt-dlp.
"""

import logging
import uuid
import os
import base64
import re
import tempfile
from pathlib import Path
from typing import Dict, Optional
import yt_dlp

logger = logging.getLogger(__name__)


def normalize_youtube_url(url: str) -> str:
    """
    Normalize YouTube URL to standard watch format.
    Converts /live/ URLs to /watch?v= format for better compatibility.
    
    Args:
        url: YouTube URL in any format
        
    Returns:
        Normalized URL in /watch?v= format
    """
    # Extract video ID from various YouTube URL formats
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/live/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com/embed/([a-zA-Z0-9_-]{11})',
        r'youtube\.com/v/([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            video_id = match.group(1)
            return f'https://www.youtube.com/watch?v={video_id}'
    
    # If no match, return original URL
    return url


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
    # Normalize URL to standard format
    url = normalize_youtube_url(url)
    logger.info(f"Normalized URL: {url}")
    
    if not video_id:
        video_id = str(uuid.uuid4())
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Resolve optional YouTube cookie source for bot-protected videos.
    cookie_file_path: Optional[Path] = None
    cleanup_cookie_file = False

    cookies_file = os.getenv('YOUTUBE_COOKIES_FILE', '').strip()
    if cookies_file:
        candidate = Path(cookies_file).expanduser()
        if candidate.exists() and candidate.is_file():
            cookie_file_path = candidate
            logger.info("Loaded YouTube cookies from YOUTUBE_COOKIES_FILE")
        else:
            logger.warning("YOUTUBE_COOKIES_FILE is set but file was not found: %s", candidate)

    if cookie_file_path is None:
        cookies_b64 = os.getenv('YOUTUBE_COOKIES_B64', '').strip()
        if cookies_b64:
            try:
                temp_dir = Path(tempfile.gettempdir())
                cookie_file_path = temp_dir / 'youtube_cookies.txt'
                cookie_data = base64.b64decode(cookies_b64)
                cookie_file_path.write_bytes(cookie_data)
                cleanup_cookie_file = True
                logger.info("Loaded YouTube cookies from YOUTUBE_COOKIES_B64")
            except Exception as e:
                logger.warning("Failed to decode YOUTUBE_COOKIES_B64: %s", e)
                cookie_file_path = None
    
    # Base yt-dlp configuration (NO cookies here - added per-attempt)
    base_ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best',  # Best video + audio merged
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
        'max_filesize': 12 * 1024 * 1024 * 1024,  # 12GB max for cricket matches
        
        # Additional anti-bot measures
        'nocheckcertificate': True,
        'socket_timeout': 60,
        'ignoreerrors': False,
        'http_headers': {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-us,en;q=0.5',
            'Sec-Fetch-Mode': 'navigate',
        },
    }
    
    try:
        logger.info(f"Downloading YouTube video: {url}")
        
        # Try multiple methods in sequence with different client emulations
        download_attempts = [
            # Attempt 1: Android client (BEST - bypasses SABR streaming & 403 errors)
            {
                **base_ydl_opts,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android'],
                    }
                },
            },
            # Attempt 2: Android with cookies (production) or Chrome cookies (local dev)
            {
                **base_ydl_opts,
                **(
                    {'cookiefile': str(cookie_file_path)} if cookie_file_path 
                    else {}  # Skip browser cookies if they fail
                ),
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android'],
                    }
                },
                'user_agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 12; US) gzip',
            },
            # Attempt 3: Android TV client (more lenient than mobile)
            {
                **base_ydl_opts,
                'user_agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 12; US) gzip',
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android_creator', 'android_embedded'],
                        'player_skip': ['webpage'],
                    }
                },
            },
            # Attempt 4: iOS client
            {
                **base_ydl_opts,
                'user_agent': 'com.google.ios.youtube/19.09.3 (iPhone14,5; U; CPU iOS 15_6 like Mac OS X)',
                'extractor_args': {
                    'youtube': {
                        'player_client': ['ios'],
                        'player_skip': ['webpage', 'configs'],
                    }
                },
            },
            # Attempt 5: TV embedded client (works for many restricted videos)
            {
                **base_ydl_opts,
                'user_agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 TV Safari/537.36',
                'extractor_args': {
                    'youtube': {
                        'player_client': ['tv_embedded'],
                        'player_skip': ['webpage', 'configs'],
                    }
                },
            },
        ]
        
        last_error = None
        for attempt_num, attempt_opts in enumerate(download_attempts, 1):
            try:
                logger.info(f"Download attempt {attempt_num}/{len(download_attempts)}")
                
                with yt_dlp.YoutubeDL(attempt_opts) as ydl:
                    # Extract info without downloading first (to validate and get metadata)
                    info = ydl.extract_info(url, download=False)
                    
                    if not info:
                        raise ValueError("Could not extract video information")
                    
                    title = info.get('title', 'Unknown Title')
                    duration = info.get('duration', 0)
                    
                    logger.info(f"Video info: {title} ({duration}s)")
                    
                    # Check duration (cricket matches can be very long)
                    if duration > 28800:  # 8 hours max
                        raise ValueError("Video is too long (max 8 hours). Consider trimming before upload.")
                    
                    # Now download
                    ydl.download([url])
                    
                    # If we reach here, download succeeded
                    break
                    
            except Exception as e:
                last_error = e
                logger.warning(f"Attempt {attempt_num} failed: {str(e)}")
                if attempt_num < len(download_attempts):
                    continue
                else:
                    # All attempts failed, raise the last error
                    raise last_error
        
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
    finally:
        if cleanup_cookie_file and cookie_file_path is not None:
            try:
                cookie_file_path.unlink(missing_ok=True)
            except Exception as cleanup_err:
                logger.debug("Failed to cleanup temporary YouTube cookies file: %s", cleanup_err)


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
