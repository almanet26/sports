"""Match data fetcher module"""
from dataclasses import dataclass
from typing import List, Dict
import requests

@dataclass
class MatchEvent:
    """Match event data structure"""
    timestamp: float
    event_type: str
    description: str
    importance: int

def fetch_match_data(match_id: str, api_url: str) -> List[MatchEvent]:
    """Fetch match data from API"""
    response = requests.get(f"{api_url}/matches/{match_id}")
    response.raise_for_status()
    data = response.json()
    return [MatchEvent(**event) for event in data.get('events', [])]

def load_mock_match_data() -> List[MatchEvent]:
    """Load mock match data for testing"""
    return [
        MatchEvent(timestamp=120.0, event_type='goal', description='Goal scored', importance=10),
        MatchEvent(timestamp=450.0, event_type='yellow_card', description='Yellow card', importance=5),
        MatchEvent(timestamp=1800.0, event_type='goal', description='Goal scored', importance=10),
        MatchEvent(timestamp=2700.0, event_type='penalty', description='Penalty kick', importance=9),
    ]

def map_events_to_video_timeline(events: List[MatchEvent], video_start_time: float) -> List[MatchEvent]:
    """Map match events to video timeline"""
    return [
        MatchEvent(
            timestamp=event.timestamp + video_start_time,
            event_type=event.event_type,
            description=event.description,
            importance=event.importance
        )
        for event in events
    ]
