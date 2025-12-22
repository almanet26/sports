"""
Engine package initialization
"""
from .downloader import download_video, extract_video_id, get_video_info
from .data_fetcher import (
    fetch_match_data, 
    load_mock_match_data, 
    map_events_to_video_timeline,
    MatchEvent
)
from .highlight_generator import (
    generate_highlights,
    generate_highlights_manifest,
    calculate_clip_segments,
    trim_clip,
    ClipSegment
)

__all__ = [
    # Downloader
    'download_video',
    'extract_video_id',
    'get_video_info',
    
    # Data Fetcher
    'fetch_match_data',
    'load_mock_match_data',
    'map_events_to_video_timeline',
    'MatchEvent',
    
    # Highlight Generator
    'generate_highlights',
    'generate_highlights_manifest',
    'calculate_clip_segments',
    'trim_clip',
    'ClipSegment',
]
