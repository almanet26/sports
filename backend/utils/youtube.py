"""
YouTube video download utilities using yt-dlp.
"""

import logging
import uuid
import os
import base64
import binascii
import re
import tempfile
from pathlib import Path
from typing import Dict, Optional
import yt_dlp

logger = logging.getLogger(__name__)


def _decode_b64_cookies(value: str) -> bytes:
    """Decode base64 cookie payload resiliently (trims quotes/newlines, fixes padding)."""
    cleaned = value.strip().strip('"').strip("'").replace("\n", "").replace("\r", "")
    missing_padding = len(cleaned) % 4
    if missing_padding:
        cleaned += "=" * (4 - missing_padding)
    try:
        return base64.b64decode(cleaned, validate=True)
    except binascii.Error as e:
        raise ValueError("Invalid base64 cookie payload") from e


def _looks_like_cookie_file_content(value: str) -> bool:
    """Best-effort check for raw Netscape cookie file content."""
    text = value.strip()
    if not text:
        return False
    if text.startswith("# Netscape HTTP Cookie File"):
        return True
    return "youtube.com" in text and "\t" in text


def normalize_youtube_url(url: str) -> str:
    """
    Normalize YouTube URL to standard watch format.
    Converts /live/ URLs to /watch?v= format for better compatibility.

    Args:
        url: YouTube URL in any format

    Returns:
        Normalized URL in /watch?v= format
    """
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
    url = normalize_youtube_url(url)
    logger.info(f"Normalized URL: {url}")

    if not video_id:
        video_id = str(uuid.uuid4())

    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        max_duration_seconds = int(os.getenv("YOUTUBE_MAX_DURATION_SECONDS", "43200"))
    except ValueError:
        max_duration_seconds = 43200

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
                # Secret may contain either raw Netscape cookie text or base64 content.
                if _looks_like_cookie_file_content(cookies_b64):
                    cookie_data = cookies_b64.encode("utf-8")
                else:
                    cookie_data = _decode_b64_cookies(cookies_b64)
                cookie_file_path.write_bytes(cookie_data)
                cleanup_cookie_file = True
                logger.info("Loaded YouTube cookies from YOUTUBE_COOKIES_B64")
            except Exception as e:
                logger.warning("Failed to decode YOUTUBE_COOKIES_B64: %s", e)
                cookie_file_path = None

    cookie_opts = {'cookiefile': str(cookie_file_path)} if cookie_file_path else {}

    # Resolve optional PO token (Proof of Origin) for server-side bot bypass.
    # Generate via: https://github.com/iv-org/youtube-po-token-generator
    # Set env var YOUTUBE_PO_TOKEN=<token>
    po_token = os.getenv('YOUTUBE_PO_TOKEN', '').strip()
    po_token_opts: dict = {}
    if po_token:
        po_token_opts = {
            'extractor_args': {
                'youtube': {
                    'po_token': [f'web+{po_token}'],
                }
            }
        }
        logger.info("Loaded YouTube PO token from YOUTUBE_PO_TOKEN")

    # Base yt-dlp configuration (NO cookies here - added per-attempt)
    base_ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best',
        'outtmpl': str(output_dir / f'{video_id}.%(ext)s'),
        'quiet': False,
        'no_warnings': False,
        'extract_flat': False,
        'merge_output_format': 'mp4',
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',
        }],
        'max_filesize': 12 * 1024 * 1024 * 1024,  # 12GB max for cricket matches

        # Anti-bot / server-friendly settings
        'nocheckcertificate': True,
        'socket_timeout': 60,
        'ignoreerrors': False,
        'retries': 3,
        'extractor_retries': 3,
        'fragment_retries': 3,
        'sleep_interval_requests': 1,  # 1s between requests to avoid rate-limiting
        'http_headers': {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-us,en;q=0.5',
            'Sec-Fetch-Mode': 'navigate',
        },
    }

    # Build po_token extractor_args merged into each attempt's extractor_args
    def _merge_po_token(attempt: dict) -> dict:
        """Merge PO token into attempt's extractor_args if set."""
        if not po_token:
            return attempt
        merged = dict(attempt)
        ea = dict(merged.get('extractor_args', {}))
        yt_ea = dict(ea.get('youtube', {}))
        yt_ea['po_token'] = [f'web+{po_token}']
        ea['youtube'] = yt_ea
        merged['extractor_args'] = ea
        return merged

    try:
        logger.info(f"Downloading YouTube video: {url}")

        # Try multiple methods in sequence with different client emulations.
        # Ordered from most server-friendly to fallback options.
        download_attempts = [
            # Attempt 1: web_creator — best for GCP/server IPs, avoids SABR detection
            _merge_po_token({
                **base_ydl_opts,
                **cookie_opts,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['web_creator'],
                    }
                },
            }),
            # Attempt 2: mweb (mobile web) — lower-profile than desktop, hard to fingerprint
            _merge_po_token({
                **base_ydl_opts,
                **cookie_opts,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['mweb'],
                        'player_skip': ['webpage'],
                    }
                },
            }),
            # Attempt 3: Android client — bypasses SABR streaming & 403 errors
            _merge_po_token({
                **base_ydl_opts,
                **cookie_opts,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android'],
                    }
                },
            }),
            # Attempt 4: iOS client
            _merge_po_token({
                **base_ydl_opts,
                **cookie_opts,
                'user_agent': 'com.google.ios.youtube/19.09.3 (iPhone14,5; U; CPU iOS 15_6 like Mac OS X)',
                'extractor_args': {
                    'youtube': {
                        'player_client': ['ios'],
                        'player_skip': ['webpage', 'configs'],
                    }
                },
            }),
            # Attempt 5: TV embedded client (works for many restricted videos)
            _merge_po_token({
                **base_ydl_opts,
                **cookie_opts,
                'user_agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.146 TV Safari/537.36',
                'extractor_args': {
                    'youtube': {
                        'player_client': ['tv_embedded'],
                        'player_skip': ['webpage', 'configs'],
                    }
                },
            }),
            # Attempt 6: Shotgun — try all available clients
            _merge_po_token({
                **base_ydl_opts,
                **cookie_opts,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['web_creator', 'mweb', 'android', 'ios', 'tv_embedded'],
                        'player_skip': ['webpage', 'configs'],
                    }
                },
            }),
        ]

        last_error = None
        for attempt_num, attempt_opts in enumerate(download_attempts, 1):
            try:
                logger.info(f"Download attempt {attempt_num}/{len(download_attempts)}")

                with yt_dlp.YoutubeDL(attempt_opts) as ydl:
                    info = ydl.extract_info(url, download=False)

                    if not info:
                        raise ValueError("Could not extract video information")

                    title = info.get('title', 'Unknown Title')
                    duration = info.get('duration', 0)

                    logger.info(f"Video info: {title} ({duration}s)")

                    # Check duration (cricket matches can be very long)
                    if duration > max_duration_seconds:
                        max_hours = max_duration_seconds / 3600
                        raise ValueError(
                            f"Video is too long (max {max_hours:.1f} hours). "
                            "Consider trimming before upload or increase YOUTUBE_MAX_DURATION_SECONDS."
                        )

                    ydl.download([url])
                    break

            except Exception as e:
                last_error = e
                logger.warning(f"Attempt {attempt_num} failed: {str(e)}")
                if attempt_num < len(download_attempts):
                    continue
                else:
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
        error_msg_lower = error_msg.lower()
        logger.error(f"yt-dlp download error: {error_msg}")

        # Provide user-friendly error messages
        if (
            "sign in to confirm" in error_msg_lower
            or "not a bot" in error_msg_lower
            or "cookies-from-browser" in error_msg_lower
            or "http error 429" in error_msg_lower
            or "too many requests" in error_msg_lower
            or "confirm you're not a bot" in error_msg_lower
            or "video unavailable" in error_msg_lower and "bot" in error_msg_lower
            or "http error 403" in error_msg_lower
            or "proof of origin" in error_msg_lower
            or "po_token" in error_msg_lower
        ):
            hints = []
            if not cookie_file_path:
                hints.append("set YOUTUBE_COOKIES_B64 with exported browser cookies")
            if not po_token:
                hints.append("set YOUTUBE_PO_TOKEN with a proof-of-origin token")
            hint_str = "; or ".join(hints) if hints else "check your cookie/token configuration"
            raise ValueError(
                f"YouTube blocked this download in server mode. To fix: {hint_str}."
            )
        if 'unavailable' in error_msg_lower:
            raise Exception("Video is unavailable or private. Please check the URL.")
        elif 'copyright' in error_msg_lower:
            raise Exception("Video cannot be downloaded due to copyright restrictions.")
        elif 'age' in error_msg_lower:
            raise Exception("Age-restricted video cannot be downloaded.")
        else:
            raise Exception(f"Failed to download video: {error_msg}")
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise
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
