import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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
          event_type: eventFilter === 'all' ? undefined : eventFilter,
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

    if (eventFilter === 'FOUR' && video.total_fours > 0) return matchesSearch;
    if (eventFilter === 'SIX' && video.total_sixes > 0) return matchesSearch;
    if (eventFilter === 'WICKET' && video.total_wickets > 0) return matchesSearch;

    return false;
  });

  return (
    <div className="text-white">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass rounded-3xl p-6 mb-8 border border-white/20"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-film text-blue-400"></i>
              Video Library
            </h1>
            <p className="text-white/70 mt-2 text-sm">Browse and filter cricket highlights</p>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4 mb-8"
      >
        {/* Search */}
        <div className="relative flex-1">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-white/40"></i>
          <input
            type="text"
            placeholder="Search matches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 glass border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 bg-transparent"
          />
        </div>

        {/* Event Filter */}
        <div className="flex items-center gap-2">
          <i className="fas fa-filter text-white/40"></i>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value as EventFilter)}
            className="px-4 py-3 glass border border-white/20 rounded-2xl text-white focus:outline-none focus:border-blue-500 bg-transparent"
          >
            <option value="all" className="bg-gray-900">All Events</option>
            <option value="FOUR" className="bg-gray-900">Fours Only</option>
            <option value="SIX" className="bg-gray-900">Sixes Only</option>
            <option value="WICKET" className="bg-gray-900">Wickets Only</option>
          </select>
        </div>
      </motion.div>

      {/* Video Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass rounded-2xl animate-pulse border border-white/10">
              <div className="aspect-video bg-white/5 rounded-t-2xl" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <i className="fas fa-play text-2xl text-white/40"></i>
          </div>
          <h3 className="text-lg font-medium text-white mb-1">No highlights found</h3>
          <p className="text-white/60">Try adjusting your search or filters</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video, i) => (
            <HighlightCard key={video.id} video={video} index={i} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center gap-3 mt-8"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-6 py-2 glass border border-white/20 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
          >
            <i className="fas fa-chevron-left mr-2"></i>
            Previous
          </motion.button>
          <span className="px-4 py-2 text-white/60">
            Page {page} of {totalPages}
          </span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-6 py-2 glass border border-white/20 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
          >
            Next
            <i className="fas fa-chevron-right ml-2"></i>
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

// Highlight Card Component
function HighlightCard({ video, index }: { video: Video; index: number }) {
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Link
        to={`/video/${video.id}`}
        className="block glass rounded-2xl border border-white/20 overflow-hidden hover:border-blue-500/50 transition-all group"
      >
        {/* Thumbnail */}
        <div className="aspect-video bg-gradient-to-br from-blue-500/20 to-purple-500/20 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all">
              <i className="fas fa-play text-white text-xl ml-1"></i>
            </div>
          </div>
          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-xs text-white flex items-center gap-1">
            <i className="fas fa-clock text-xs"></i>
            {formatDuration(video.duration_seconds)}
          </div>
          {/* Status badge */}
          {video.status === 'processing' && (
            <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500/80 rounded-lg text-xs text-white flex items-center gap-1">
              <i className="fas fa-spinner animate-spin"></i>
              Processing
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-medium text-white mb-1 line-clamp-1 group-hover:text-blue-400 transition-colors">
            {video.title}
          </h3>
          <p className="text-sm text-white/60 mb-3">
            {video.teams || 'Unknown Teams'} • {formatDate(video.match_date)}
          </p>

          {/* Event Stats */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-blue-400">
              <i className="fas fa-circle text-[6px]"></i>
              {video.total_fours} Fours
            </span>
            <span className="flex items-center gap-1 text-green-400">
              <i className="fas fa-circle text-[6px]"></i>
              {video.total_sixes} Sixes
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <i className="fas fa-circle text-[6px]"></i>
              {video.total_wickets} Wickets
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
