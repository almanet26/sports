import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Play, Clock, Target } from 'lucide-react';
import { videosApi } from '../lib/api';

interface Video {
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
  created_at: string;
}

type EventFilter = 'all' | 'FOUR' | 'SIX' | 'WICKET';

export default function HighlightsPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const response = await videosApi.listPublic({ 
          page, 
          per_page: 12, 
          search: searchQuery || undefined, 
          event_type: eventFilter === 'all' ? undefined : eventFilter 
        });
        setVideos(response.data.videos || []);
        setTotalPages(Math.ceil((response.data.total || 0) / 12));
      } catch (error) {
        console.error('Failed to fetch videos:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, [page, searchQuery, eventFilter]);

  // Filter videos based on search and event type
  const filteredVideos = videos.filter((video) => {
    const matchesSearch = 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.teams?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (eventFilter === 'all') return matchesSearch;
    
    // Filter by event type (show videos that have events of this type)
    if (eventFilter === 'FOUR' && video.total_fours > 0) return matchesSearch;
    if (eventFilter === 'SIX' && video.total_sixes > 0) return matchesSearch;
    if (eventFilter === 'WICKET' && video.total_wickets > 0) return matchesSearch;
    
    return false;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Public Library</h1>
        <p className="text-slate-400">Browse and filter cricket highlights</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search matches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Event Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value as EventFilter)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Events</option>
            <option value="FOUR">Fours Only</option>
            <option value="SIX">Sixes Only</option>
            <option value="WICKET">Wickets Only</option>
          </select>
        </div>
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-slate-800/50 rounded-xl animate-pulse">
              <div className="aspect-video bg-slate-700 rounded-t-xl" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <Play className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">No highlights found</h3>
          <p className="text-slate-400">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <HighlightCard key={video.id} video={video} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// Highlight Card Component
function HighlightCard({ video }: { video: Video }) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Link
      to={`/video/${video.id}`}
      className="block bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:border-emerald-500/50 transition-all group"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-slate-900 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <Play className="w-12 h-12 text-slate-600 group-hover:text-emerald-500 transition-colors" />
        </div>
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs text-white flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDuration(video.duration_seconds)}
        </div>
        {/* Status badge */}
        {video.status === 'processing' && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-amber-500/80 rounded text-xs text-white">
            Processing...
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-white mb-1 line-clamp-1 group-hover:text-emerald-400 transition-colors">
          {video.title}
        </h3>
        <p className="text-sm text-slate-400 mb-3">
          {video.teams || 'Unknown Teams'} • {formatDate(video.match_date)}
        </p>

        {/* Event Stats */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-blue-400">
            <Target className="w-3 h-3" />
            {video.total_fours} Fours
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <Target className="w-3 h-3" />
            {video.total_sixes} Sixes
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <Target className="w-3 h-3" />
            {video.total_wickets} Wickets
          </span>
        </div>
      </div>
    </Link>
  );
}
