"""Highlight generator module"""
from dataclasses import dataclass
from typing import List, Dict
from moviepy.editor import VideoFileClip, concatenate_videoclips
from .data_fetcher import MatchEvent

@dataclass
class ClipSegment:
    """Video clip segment"""
    start_time: float
    end_time: float
    event_type: str
    description: str

def calculate_clip_segments(events: List[MatchEvent], buffer_before: float = 5.0, buffer_after: float = 3.0) -> List[ClipSegment]:
    """Calculate clip segments from events"""
    segments = []
    for event in events:
        if event.importance >= 7:
            segments.append(ClipSegment(
                start_time=max(0, event.timestamp - buffer_before),
                end_time=event.timestamp + buffer_after,
                event_type=event.event_type,
                description=event.description
            ))
    return segments

def trim_clip(video_path: str, start_time: float, end_time: float, output_path: str) -> str:
    """Trim video clip"""
    with VideoFileClip(video_path) as video:
        clip = video.subclip(start_time, end_time)
        clip.write_videofile(output_path, codec='libx264', audio_codec='aac')
    return output_path

def generate_highlights(video_path: str, segments: List[ClipSegment], output_path: str) -> str:
    """Generate highlights video from segments"""
    clips = []
    with VideoFileClip(video_path) as video:
        for segment in segments:
            clip = video.subclip(segment.start_time, segment.end_time)
            clips.append(clip)
        
        final_clip = concatenate_videoclips(clips)
        final_clip.write_videofile(output_path, codec='libx264', audio_codec='aac')
    
    return output_path

def generate_highlights_manifest(segments: List[ClipSegment]) -> Dict:
    """Generate manifest for highlights"""
    return {
        'total_clips': len(segments),
        'clips': [
            {
                'start': seg.start_time,
                'end': seg.end_time,
                'type': seg.event_type,
                'description': seg.description
            }
            for seg in segments
        ]
    }
