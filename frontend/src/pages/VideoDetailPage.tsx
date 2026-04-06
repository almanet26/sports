import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, Download, Clock, MapPin, Calendar, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { resolveMediaUrl, videosApi } from '../lib/api';

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
  const [playbackUrl, setPlaybackUrl] = useState<string>("");

  const needsPolling = (item: VideoDetail | null): boolean => {
    if (!item) return false;
    const status = String(item.status || '').toLowerCase();
    return status === 'processing' || status === 'pending' || (status === 'completed' && !item.supercut_path);
  };

  useEffect(() => {
    let pollTimer: number | undefined;

    const loadVideo = async () => {
      if (!videoId) return;
      setLoading(true);
      try {
        const [videoResponse, eventsResponse] = await Promise.all([
          videosApi.getById(videoId),
          videosApi.getEvents(videoId),
        ]);
        const videoData = videoResponse.data as VideoDetail;
        setVideo(videoData);
        setEvents(eventsResponse.data.events || []);

        if (needsPolling(videoData)) {
          pollTimer = window.setInterval(async () => {
            try {
              const latestVideoResponse = await videosApi.getById(videoId);
              const latestVideo = latestVideoResponse.data as VideoDetail;
              setVideo(latestVideo);

              if (latestVideo.total_events > 0 || String(latestVideo.status || '').toLowerCase() === 'completed') {
                const latestEvents = await videosApi.getEvents(
                  videoId,
                  eventFilter === 'all' ? undefined : eventFilter,
                );
                setEvents(latestEvents.data.events || []);
              }

              if (!needsPolling(latestVideo) && pollTimer !== undefined) {
                window.clearInterval(pollTimer);
              }
            } catch (pollError) {
              console.error('Polling video details failed:', pollError);
            }
          }, 10000);
        }
      } catch (error) {
        console.error('Failed to fetch video details:', error);
      } finally {
        setLoading(false);
      }
    };
    loadVideo();

    return () => {
      if (pollTimer !== undefined) {
        window.clearInterval(pollTimer);
      }
    };
  }, [videoId, eventFilter]);

  useEffect(() => {
    setPlaybackUrl("");

    if (!video?.id || String(video.status || "").toLowerCase() !== "completed") {
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
      console.error("No access token found for video playback");
      return;
    }

    setPlaybackUrl(videosApi.getStreamUrl(video.id, token));
  }, [video?.id, video?.status]);



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
      <div className="flex items-center justify-center h-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin"></div>
          </div>
          <p className="text-white/60">Loading video details...</p>
        </motion.div>
      </div>
    );
  }

  if (!video) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20"
      >
        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center">
          <i className="fas fa-exclamation-triangle text-3xl text-red-400"></i>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Video not found</h2>
        <p className="text-white/60 mb-6">The video you're looking for doesn't exist or has been removed.</p>
        <Link
          to="/highlights"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to library
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 pb-12"
    >
      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Link
          to="/highlights"
          className="inline-flex items-center gap-2 px-4 py-2 glass border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-blue-500/50 transition-all group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to library
        </Link>
      </motion.div>

      {/* Video Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-3xl border border-white/20 overflow-hidden shadow-2xl"
      >
        {/* Video Player */}
        <div className="aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
          {/* Ambient background effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 animate-gradient"></div>
          {video.supercut_path ? (
            <video
              className="w-full h-full relative z-10"
              controls
              preload="metadata"
              src={getSupercutPlaybackUrl(video)}
            >
              <source src={getSupercutPlaybackUrl(video)} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : String(video.status || '').toLowerCase() === 'completed' ? (
            playbackUrl ? (
              <video
                className="w-full h-full relative z-10"
                controls
                preload="metadata"
                src={playbackUrl}
              >
                <source src={playbackUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center relative z-10 text-white">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 mb-6"
                ></motion.div>
                <h3 className="text-xl font-semibold mb-2">Loading video...</h3>
                <p className="text-white/60">Preparing secure playback</p>
              </div>
            )
          ) : video.status === 'processing' ? (
            <div className="w-full h-full flex flex-col items-center justify-center relative z-10">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 mb-6"
              ></motion.div>
              <h3 className="text-xl font-semibold text-white mb-2">Processing your highlights...</h3>
              <p className="text-white/60">This may take a few minutes. The page will auto-refresh.</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-white/40">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                Analyzing video content
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center relative z-10">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                  <Play className="w-10 h-10 text-slate-500" />
                </div>
                <p className="text-white/60 font-medium">Video not available</p>
                <p className="text-white/40 text-sm mt-1">The video is currently unavailable or being processed</p>
              </div>
            </div>
          )}
        </div>

        {/* Video Info */}
        <div className="p-8 relative">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-3 gradient-text">{video.title}</h1>

              {/* Match Info Cards */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl border border-white/20">
                  <i className="fas fa-users text-blue-400"></i>
                  <span className="text-white font-medium">{video.teams || 'Unknown Teams'}</span>
                </div>
                {video.venue && (
                  <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl border border-white/20">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span className="text-white/80">{video.venue}</span>
                  </div>
                )}
                {video.match_date && (
                  <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl border border-white/20">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span className="text-white/80">{formatDate(video.match_date)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Download Supercut Button */}
            {video.supercut_path && (
              <motion.a
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href={getSupercutPlaybackUrl(video)}
                download={`${video.title}_highlights.mp4`}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/30"
              >
                <Download className="w-5 h-5" />
                Download Highlights
              </motion.a>
            )}
          </div>

          {/* Event Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-white/10">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm"
            >
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <i className="fas fa-circle text-white text-sm"></i>
              </div>
              <div className="text-3xl font-bold text-blue-400 mb-1">{video.total_fours}</div>
              <div className="text-sm text-white/60 uppercase tracking-wide">Fours</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm"
            >
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <i className="fas fa-circle text-white text-sm"></i>
              </div>
              <div className="text-3xl font-bold text-emerald-400 mb-1">{video.total_sixes}</div>
              <div className="text-sm text-white/60 uppercase tracking-wide">Sixes</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center p-4 rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm"
            >
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                <i className="fas fa-bolt text-white text-sm"></i>
              </div>
              <div className="text-3xl font-bold text-red-400 mb-1">{video.total_wickets}</div>
              <div className="text-sm text-white/60 uppercase tracking-wide">Wickets</div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-center p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 backdrop-blur-sm"
            >
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-purple-400 mb-1">{video.total_events}</div>
              <div className="text-sm text-white/60 uppercase tracking-wide">Total Events</div>
            </motion.div>
          </div>

          {video.description && (
            <div className="mt-6 p-4 rounded-2xl glass border border-white/20">
              <p className="text-white/80 leading-relaxed">{video.description}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Events Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-3xl border border-white/20 overflow-hidden shadow-xl"
      >
        <div className="px-8 py-6 border-b border-white/10 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
                <i className="fas fa-list-timeline text-blue-400"></i>
                Events Timeline
              </h2>
              <p className="text-white/60 text-sm">
                {events.length} {eventFilter === 'all' ? 'events' : `${eventFilter.toLowerCase()}s`} detected
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              {(['all', 'FOUR', 'SIX', 'WICKET'] as EventFilter[]).map((filter) => (
                <motion.button
                  key={filter}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fetchFilteredEvents(filter)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${eventFilter === filter
                    ? filter === 'FOUR'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                      : filter === 'SIX'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50'
                        : filter === 'WICKET'
                          ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                          : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'glass border border-white/20 text-white/70 hover:text-white hover:border-white/40'
                    }`}
                >
                  {filter === 'all' ? 'All' : filter}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {events.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                <i className="fas fa-inbox text-2xl text-white/40"></i>
              </div>
              <p className="text-white/60 font-medium">No events found</p>
              <p className="text-white/40 text-sm mt-1">Try changing the filter above</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {events.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 glass rounded-2xl border border-white/20 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Event Type Badge */}
                    <div className={`px-4 py-2 rounded-xl text-sm font-semibold ${getEventColor(event.event_type)} shadow-md`}>
                      {event.event_type === 'FOUR' && <i className="fas fa-circle mr-2"></i>}
                      {event.event_type === 'SIX' && <i className="fas fa-circle mr-2"></i>}
                      {event.event_type === 'WICKET' && <i className="fas fa-bolt mr-2"></i>}
                      {event.event_type}
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 px-3 py-1.5 glass rounded-lg">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="text-white font-mono text-sm">{formatTimestamp(event.timestamp_seconds)}</span>
                    </div>

                    {/* Score Change */}
                    {event.score_before && event.score_after && (
                      <div className="flex items-center gap-2 px-3 py-1.5 glass rounded-lg">
                        <span className="text-white/60 font-mono text-sm">{event.score_before}</span>
                        <i className="fas fa-arrow-right text-blue-400 text-xs"></i>
                        <span className="text-white font-mono text-sm font-semibold">{event.score_after}</span>
                      </div>
                    )}

                    {/* Overs */}
                    {event.overs && (
                      <div className="px-3 py-1.5 glass rounded-lg">
                        <span className="text-white/60 text-sm">
                          <i className="fas fa-baseball-ball text-purple-400 mr-1.5"></i>
                          Over {event.overs}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Download Clip Button */}
                  {event.clip_path && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/30"
                    >
                      <Download className="w-4 h-4" />
                      Clip
                    </motion.button>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

