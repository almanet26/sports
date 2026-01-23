import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { videosApi, requestsApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import RequestMatchModal from '../components/RequestMatchModal';

interface VideoSummary {
  id: string;
  title: string;
  teams?: string;
  total_events: number;
  total_fours: number;
  total_sixes: number;
  total_wickets: number;
  status: string;
  created_at: string;
}

interface UserRequest {
  id: string;
  match_title?: string;
  youtube_url: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed';
  upvotes: number;
  created_at: string;
}

export default function PlayerDashboard() {
  const { user } = useAuthStore();
  const [recentVideos, setRecentVideos] = useState<VideoSummary[]>([]);
  const [myRequests, setMyRequests] = useState<UserRequest[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Stats data for cards
  const stats = useMemo(() => [
    { title: "Videos Watched", value: recentVideos.length.toString(), icon: "fas fa-play-circle", color: "from-blue-500 to-cyan-500" },
    { title: "Requests Made", value: myRequests.length.toString(), icon: "fas fa-paper-plane", color: "from-green-500 to-emerald-500" },
    { title: "Total 4s Seen", value: recentVideos.reduce((acc, v) => acc + (v.total_fours || 0), 0).toString(), icon: "fas fa-bullseye", color: "from-purple-500 to-pink-500" },
    { title: "Total 6s Seen", value: recentVideos.reduce((acc, v) => acc + (v.total_sixes || 0), 0).toString(), icon: "fas fa-rocket", color: "from-orange-500 to-red-500" },
  ], [recentVideos, myRequests]);

  // Chart data
  const lineData = useMemo(() => [
    { day: "Mon", events: 12 },
    { day: "Tue", events: 18 },
    { day: "Wed", events: 15 },
    { day: "Thu", events: 22 },
    { day: "Fri", events: 28 },
    { day: "Sat", events: 35 },
    { day: "Sun", events: 30 },
  ], []);

  const barData = useMemo(() => {
    return recentVideos.slice(0, 5).map((v) => ({
      name: v.title?.substring(0, 10) || 'Video',
      fours: v.total_fours || 0,
      sixes: v.total_sixes || 0,
      wickets: v.total_wickets || 0,
    }));
  }, [recentVideos]);

  useEffect(() => {
    fetchRecentVideos();
    fetchMyRequests();
  }, []);

  const fetchRecentVideos = async () => {
    try {
      const response = await videosApi.listPublic({ page: 1, per_page: 5 });
      setRecentVideos(response.data.videos || []);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoadingVideos(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const response = await requestsApi.list(1, 10);
      setMyRequests(response.data.requests || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleRequestSubmitted = () => {
    setShowRequestModal(false);
    fetchMyRequests();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      processing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    const icons: Record<string, string> = {
      pending: 'fas fa-clock',
      approved: 'fas fa-check',
      processing: 'fas fa-spinner fa-spin',
      completed: 'fas fa-check-circle',
      rejected: 'fas fa-times-circle',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border ${styles[status] || styles.pending}`}>
        <i className={icons[status] || icons.pending}></i>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="text-white space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass rounded-3xl p-6 border border-white/20"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Welcome back!</h1>
            <p className="text-white/70 mt-2 text-sm">
              {user?.email ? `Signed in as ${user.email}` : 'Your cricket highlights dashboard'}
            </p>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowRequestModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 text-sm font-semibold flex items-center gap-2"
            >
              <i className="fas fa-plus"></i>
              Request Match
            </motion.button>
            <Link
              to="/library"
              className="px-4 py-2 rounded-xl glass border border-white/20 hover:bg-white/10 transition-all duration-300 text-sm flex items-center gap-2"
            >
              <i className="fas fa-video"></i>
              Library
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            whileHover={{ scale: 1.05, y: -5 }}
            className="glass rounded-2xl p-6 border border-white/20 hover:border-white/30 transition-all duration-300 group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${s.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <i className={`${s.icon} text-white text-lg`}></i>
              </div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <p className="text-sm text-white/60 mb-2">{s.title}</p>
            <p className="text-2xl font-bold mb-3">{loadingVideos || loadingRequests ? '...' : s.value}</p>
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div 
                className={`h-full bg-gradient-to-r ${s.color} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: "75%" }}
                transition={{ duration: 1, delay: i * 0.2 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activity Trend */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="glass rounded-3xl p-6 border border-white/20 hover:border-white/30 transition-all duration-300"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
              <i className="fas fa-chart-line text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Weekly Activity</p>
              <p className="text-sm text-white/60">Your highlight viewing trend</p>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    color: 'white'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="events" 
                  stroke="url(#lineGradient)" 
                  strokeWidth={3}
                  dot={{ fill: '#60A5FA', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, fill: '#3B82F6' }}
                />
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Video Stats Bar Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass rounded-3xl p-6 border border-white/20 hover:border-white/30 transition-all duration-300"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <i className="fas fa-chart-bar text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Recent Videos Stats</p>
              <p className="text-sm text-white/60">4s, 6s, and Wickets distribution</p>
            </div>
          </div>

          <div className="h-72">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.6)" />
                  <YAxis stroke="rgba(255,255,255,0.6)" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '12px',
                      color: 'white'
                    }}
                  />
                  <Bar dataKey="fours" fill="#3B82F6" radius={[4, 4, 0, 0]} name="4s" />
                  <Bar dataKey="sixes" fill="#10B981" radius={[4, 4, 0, 0]} name="6s" />
                  <Bar dataKey="wickets" fill="#EF4444" radius={[4, 4, 0, 0]} name="Wickets" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-white/40">
                <div className="text-center">
                  <i className="fas fa-chart-bar text-4xl mb-3"></i>
                  <p>No video data yet</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Highlights & Requests */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-2 glass rounded-3xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-xl">
                <i className="fas fa-play text-white"></i>
              </div>
              <div>
                <p className="font-semibold text-lg">Recent Highlights</p>
                <p className="text-sm text-white/60">Latest processed videos</p>
              </div>
            </div>
            <Link to="/library" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View all →
            </Link>
          </div>

          {loadingVideos ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass rounded-2xl p-4 border border-white/10 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-white/10 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : recentVideos.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-video text-4xl text-white/20 mb-4"></i>
              <p className="text-white/60">No highlights available yet</p>
              <p className="text-sm text-white/40 mt-1">Request a match to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentVideos.slice(0, 4).map((video, i) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    to={`/video/${video.id}`}
                    className="glass rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                        <i className="fas fa-play text-sm"></i>
                      </div>
                      <div>
                        <p className="font-medium group-hover:text-blue-400 transition-colors">{video.title}</p>
                        <p className="text-xs text-white/50">{video.teams || 'Cricket Match'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-blue-400">{video.total_fours} 4s</span>
                      <span className="text-green-400">{video.total_sixes} 6s</span>
                      <span className="text-red-400">{video.total_wickets} W</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Actions & Requests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass rounded-3xl p-6 border border-white/20"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-xl">
              <i className="fas fa-bolt text-white"></i>
            </div>
            <div>
              <p className="font-semibold text-lg">Quick Actions</p>
              <p className="text-sm text-white/60">Common tasks</p>
            </div>
          </div>

          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowRequestModal(true)}
              className="w-full glass rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center gap-3 text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <i className="fas fa-plus text-white"></i>
              </div>
              <div>
                <p className="font-medium">Request Match</p>
                <p className="text-xs text-white/50">Submit a YouTube URL</p>
              </div>
            </motion.button>

            <Link
              to="/library"
              className="w-full glass rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <i className="fas fa-video text-white"></i>
              </div>
              <div>
                <p className="font-medium">Browse Library</p>
                <p className="text-xs text-white/50">View all highlights</p>
              </div>
            </Link>

            <Link
              to="/requests"
              className="w-full glass rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <i className="fas fa-comment-dots text-white"></i>
              </div>
              <div>
                <p className="font-medium">View Requests</p>
                <p className="text-xs text-white/50">Vote on matches</p>
              </div>
            </Link>
          </div>

          {/* Recent Requests Mini */}
          {myRequests.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-sm font-medium text-white/60 mb-3">Your Requests</p>
              <div className="space-y-2">
                {myRequests.slice(0, 3).map((req) => (
                  <div key={req.id} className="flex items-center justify-between text-xs">
                    <span className="text-white/80 truncate max-w-[120px]">
                      {req.match_title || 'Match'}
                    </span>
                    {getStatusBadge(req.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Request Match Modal */}
      <RequestMatchModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSuccess={handleRequestSubmitted}
      />
    </div>
  );
}
