import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, Download, Clock, Filter } from 'lucide-react';
import { videosApi } from '../lib/api';

interface VideoDetail {
  id: string;
  title: string;
  description?: string;
  teams?: string;
  venue?: string;
  match_date?: string;
  duration_seconds?: number;
  total_events: number;
  total_fours: number;
  total_sixes: number;
  total_wickets: number;
  status: string;
  visibility: string;
  created_at: string;
  file_path?: string;
  supercut_path?: string;
}

interface HighlightEvent {
  id: string;
  event_type: 'FOUR' | 'SIX' | 'WICKET';
  timestamp_seconds: number;
  score_before?: string;
  score_after?: string;
  overs?: string;
  clip_path?: string;
}

type EventFilter = 'all' | 'FOUR' | 'SIX' | 'WICKET';

export default function VideoDetailPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [events, setEvents] = useState<HighlightEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');

  useEffect(() => {
    const loadVideo = async () => {
      if (!videoId) return;
      setLoading(true);
      try {
        const [videoResponse, eventsResponse] = await Promise.all([
          videosApi.getById(videoId),
          videosApi.getEvents(videoId),
        ]);
        setVideo(videoResponse.data);
        setEvents(eventsResponse.data.events || []);
      } catch (error) {
        console.error('Failed to fetch video details:', error);
      } finally {
        setLoading(false);
      }
    };
    loadVideo();
  }, [videoId]);



  const fetchFilteredEvents = async (filter: EventFilter) => {
    setEventFilter(filter);
    try {
      const response = await videosApi.getEvents(
        videoId!,
        filter === 'all' ? undefined : filter
      );
      setEvents(response.data.events || []);
    } catch (error) {
      console.error('Failed to fetch filtered events:', error);
    }
  };

  const formatTimestamp = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'FOUR': return 'text-blue-400 bg-blue-500/20';
      case 'SIX': return 'text-emerald-400 bg-emerald-500/20';
      case 'WICKET': return 'text-red-400 bg-red-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-medium text-white mb-2">Video not found</h2>
        <Link to="/highlights" className="text-emerald-400 hover:underline">
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        to="/highlights"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to library
      </Link>

      {/* Video Header */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        {/* Video Player */}
        <div className="aspect-video bg-slate-900">
          {video.supercut_path ? (
            <video
              className="w-full h-full"
              controls
              preload="metadata"
              src={videosApi.getSupercutUrl(video.id)}
            >
              <source src={videosApi.getSupercutUrl(video.id)} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : video.status === 'completed' ? (
            <video
              className="w-full h-full"
              controls
              preload="metadata"
              src={videosApi.getStreamUrl(video.id)}
            >
              <source src={videosApi.getStreamUrl(video.id)} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : video.status === 'processing' ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
              <p className="text-slate-400">Processing video... Highlights will be available soon</p>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Play className="w-16 h-16 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400">Video not available</p>
              </div>
            </div>
          )}
        </div>

        {/* Video Info */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">{video.title}</h1>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span>{video.teams || 'Unknown Teams'}</span>
                <span>•</span>
                <span>{video.venue || 'Unknown Venue'}</span>
                <span>•</span>
                <span>{formatDate(video.match_date)}</span>
              </div>
            </div>
            
            {/* Download Supercut Button */}
            {video.supercut_path && (
              <a
                href={videosApi.getSupercutUrl(video.id)}
                download={`${video.title}_highlights.mp4`}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Supercut
              </a>
            )}
          </div>

          {/* Event Stats */}
          <div className="flex items-center gap-6 mt-6 pt-6 border-t border-slate-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{video.total_fours}</div>
              <div className="text-sm text-slate-400">Fours</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{video.total_sixes}</div>
              <div className="text-sm text-slate-400">Sixes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{video.total_wickets}</div>
              <div className="text-sm text-slate-400">Wickets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{video.total_events}</div>
              <div className="text-sm text-slate-400">Total Events</div>
            </div>
          </div>

          {video.description && (
            <p className="mt-4 text-slate-300">{video.description}</p>
          )}
        </div>
      </div>

      {/* Events Timeline */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Events Timeline</h2>
          
          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={eventFilter}
              onChange={(e) => fetchFilteredEvents(e.target.value as EventFilter)}
              className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Events</option>
              <option value="FOUR">Fours Only</option>
              <option value="SIX">Sixes Only</option>
              <option value="WICKET">Wickets Only</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-slate-700">
          {events.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">
              No events found
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Event Type Badge */}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEventColor(event.event_type)}`}>
                    {event.event_type}
                  </span>
                  
                  {/* Timestamp */}
                  <span className="flex items-center gap-1 text-slate-300">
                    <Clock className="w-4 h-4 text-slate-500" />
                    {formatTimestamp(event.timestamp_seconds)}
                  </span>
                  
                  {/* Score */}
                  {event.score_before && event.score_after && (
                    <span className="text-slate-400">
                      {event.score_before} → {event.score_after}
                    </span>
                  )}
                  
                  {/* Overs */}
                  {event.overs && (
                    <span className="text-sm text-slate-500">
                      Over {event.overs}
                    </span>
                  )}
                </div>

                {/* Download Clip Button */}
                {event.clip_path && (
                  <button className="flex items-center gap-1 px-3 py-1 text-sm text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors">
                    <Download className="w-4 h-4" />
                    Download Clip
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

