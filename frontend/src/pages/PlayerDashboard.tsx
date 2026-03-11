import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { requestsApi, videosApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/providers/ThemeProvider';
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
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isDark } = useTheme();
  const [recentVideos, setRecentVideos] = useState<VideoSummary[]>([]);
  const [myRequests, setMyRequests] = useState<UserRequest[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const cardClass = isDark
    ? 'glass border-white/20 hover:border-white/30'
    : 'bg-white/88 border-slate-200 shadow-lg hover:border-slate-300';
  const softCardClass = isDark
    ? 'glass border-white/10 hover:border-white/20'
    : 'bg-slate-50/90 border-slate-200 shadow-sm hover:border-slate-300';
  const mutedText = isDark ? 'text-white/60' : 'text-slate-600';
  const faintText = isDark ? 'text-white/40' : 'text-slate-500';

  const stats = useMemo(
    () => [
      { title: 'Videos Watched', value: recentVideos.length.toString(), icon: 'fas fa-play-circle', color: 'from-blue-500 to-cyan-500' },
      { title: 'Requests Made', value: myRequests.length.toString(), icon: 'fas fa-paper-plane', color: 'from-green-500 to-emerald-500' },
      { title: 'Total 4s Seen', value: recentVideos.reduce((acc, v) => acc + (v.total_fours || 0), 0).toString(), icon: 'fas fa-bullseye', color: 'from-purple-500 to-pink-500' },
      { title: 'Total 6s Seen', value: recentVideos.reduce((acc, v) => acc + (v.total_sixes || 0), 0).toString(), icon: 'fas fa-rocket', color: 'from-orange-500 to-red-500' },
    ],
    [myRequests, recentVideos]
  );

  const lineData = useMemo(
    () => [
      { day: 'Mon', events: 12 },
      { day: 'Tue', events: 18 },
      { day: 'Wed', events: 15 },
      { day: 'Thu', events: 22 },
      { day: 'Fri', events: 28 },
      { day: 'Sat', events: 35 },
      { day: 'Sun', events: 30 },
    ],
    []
  );

  const barData = useMemo(
    () =>
      recentVideos.slice(0, 5).map((video) => ({
        name: video.title?.substring(0, 10) || 'Video',
        fours: video.total_fours || 0,
        sixes: video.total_sixes || 0,
        wickets: video.total_wickets || 0,
      })),
    [recentVideos]
  );

  useEffect(() => {
    void fetchRecentVideos();
    void fetchMyRequests();
  }, []);

  async function fetchRecentVideos() {
    try {
      const response = await videosApi.listPublic({ page: 1, per_page: 5 });
      setRecentVideos(response.data.videos || []);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoadingVideos(false);
    }
  }

  async function fetchMyRequests() {
    try {
      const response = await requestsApi.list(1, 10);
      setMyRequests(response.data.requests || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  }

  function handleRequestSubmitted() {
    setShowRequestModal(false);
    void fetchMyRequests();
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30 dark:text-yellow-400',
      approved: 'bg-blue-500/20 text-blue-500 border-blue-500/30 dark:text-blue-400',
      processing: 'bg-purple-500/20 text-purple-500 border-purple-500/30 dark:text-purple-400',
      completed: 'bg-green-500/20 text-green-500 border-green-500/30 dark:text-green-400',
      rejected: 'bg-red-500/20 text-red-500 border-red-500/30 dark:text-red-400',
    };
    const icons: Record<string, string> = {
      pending: 'fas fa-clock',
      approved: 'fas fa-check',
      processing: 'fas fa-spinner fa-spin',
      completed: 'fas fa-check-circle',
      rejected: 'fas fa-times-circle',
    };

    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${styles[status] || styles.pending}`}>
        <i className={icons[status] || icons.pending}></i>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  const chartGrid = isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1';
  const chartAxis = isDark ? 'rgba(255,255,255,0.6)' : '#64748b';
  const tooltipStyle = {
    backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1',
    borderRadius: '12px',
    color: isDark ? 'white' : '#0f172a',
  };

  return (
    <div className="space-y-8 text-slate-900 dark:text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`rounded-3xl border p-6 ${cardClass}`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Welcome back!</h1>
            <p className={`mt-2 text-sm ${mutedText}`}>
              {user?.email ? `Signed in as ${user.email}` : 'Your cricket highlights dashboard'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:from-blue-600 hover:to-purple-700"
            >
              <i className="fas fa-plus"></i>
              Request Match
            </motion.button>
            <Link
              to="/library"
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-all duration-300 ${softCardClass}`}
            >
              <i className="fas fa-video"></i>
              Library
            </Link>
            <button
              onClick={() => navigate('/profile')}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-all duration-300 ${softCardClass}`}
            >
              <i className="fas fa-user-edit"></i>
              Profile
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            whileHover={{ scale: 1.03, y: -4 }}
            className={`group cursor-pointer rounded-2xl border p-6 transition-all duration-300 ${cardClass}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r ${stat.color}`}>
                <i className={`${stat.icon} text-lg text-white`}></i>
              </div>
              <div className="h-2 w-2 rounded-full bg-green-400"></div>
            </div>
            <p className={`mb-2 text-sm ${mutedText}`}>{stat.title}</p>
            <p className="mb-3 text-2xl font-bold">{loadingVideos || loadingRequests ? '...' : stat.value}</p>
            <div className={`h-1 overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${stat.color}`}
                initial={{ width: 0 }}
                animate={{ width: '75%' }}
                transition={{ duration: 1, delay: index * 0.15 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className={`rounded-3xl border p-6 transition-all duration-300 ${cardClass}`}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500">
              <i className="fas fa-chart-line text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Weekly Activity</p>
              <p className={`text-sm ${mutedText}`}>Your highlight viewing trend</p>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="day" stroke={chartAxis} />
                <YAxis stroke={chartAxis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="events"
                  stroke="url(#playerLineGradient)"
                  strokeWidth={3}
                  dot={{ fill: '#60A5FA', strokeWidth: 2, r: 6 }}
                  activeDot={{ r: 8, fill: '#3B82F6' }}
                />
                <defs>
                  <linearGradient id="playerLineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className={`rounded-3xl border p-6 transition-all duration-300 ${cardClass}`}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-pink-500">
              <i className="fas fa-chart-bar text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Recent Videos Stats</p>
              <p className={`text-sm ${mutedText}`}>4s, 6s, and wickets distribution</p>
            </div>
          </div>

          <div className="h-72">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                  <XAxis dataKey="name" stroke={chartAxis} />
                  <YAxis stroke={chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="fours" fill="#3B82F6" radius={[4, 4, 0, 0]} name="4s" />
                  <Bar dataKey="sixes" fill="#10B981" radius={[4, 4, 0, 0]} name="6s" />
                  <Bar dataKey="wickets" fill="#EF4444" radius={[4, 4, 0, 0]} name="Wickets" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={`flex h-full items-center justify-center ${faintText}`}>
                <div className="text-center">
                  <i className="fas fa-chart-bar mb-3 text-4xl"></i>
                  <p>No video data yet</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={`rounded-3xl border p-6 lg:col-span-2 ${cardClass}`}
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-xl">
                <i className="fas fa-play text-white"></i>
              </div>
              <div>
                <p className="text-lg font-semibold">Recent Highlights</p>
                <p className={`text-sm ${mutedText}`}>Latest processed videos</p>
              </div>
            </div>
            <Link to="/library" className="text-sm text-blue-500 transition-colors hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">
              View all
            </Link>
          </div>

          {loadingVideos ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className={`animate-pulse rounded-2xl border p-4 ${softCardClass}`}>
                  <div className={`mb-2 h-4 w-3/4 rounded ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}></div>
                  <div className={`h-3 w-1/2 rounded ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}></div>
                </div>
              ))}
            </div>
          ) : recentVideos.length === 0 ? (
            <div className="py-12 text-center">
              <i className={`fas fa-video mb-4 text-4xl ${faintText}`}></i>
              <p className={mutedText}>No highlights available yet</p>
              <p className={`mt-1 text-sm ${faintText}`}>Request a match to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentVideos.slice(0, 4).map((video, index) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    to={`/video/${video.id}`}
                    className={`group flex items-center justify-between rounded-2xl border p-4 transition-all duration-300 ${softCardClass}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-blue-400 to-purple-500 font-bold text-white">
                        <i className="fas fa-play text-sm"></i>
                      </div>
                      <div>
                        <p className="font-medium transition-colors group-hover:text-blue-500 dark:group-hover:text-blue-400">{video.title}</p>
                        <p className={`text-xs ${faintText}`}>{video.teams || 'Cricket Match'}</p>
                      </div>
                    </div>
                    <div className="hidden items-center gap-4 text-xs sm:flex">
                      <span className="text-blue-500 dark:text-blue-400">{video.total_fours} 4s</span>
                      <span className="text-green-500 dark:text-green-400">{video.total_sixes} 6s</span>
                      <span className="text-red-500 dark:text-red-400">{video.total_wickets} W</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className={`rounded-3xl border p-6 ${cardClass}`}
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-xl">
              <i className="fas fa-bolt text-white"></i>
            </div>
            <div>
              <p className="text-lg font-semibold">Quick Actions</p>
              <p className={`text-sm ${mutedText}`}>Common tasks</p>
            </div>
          </div>

          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowRequestModal(true)}
              className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 ${softCardClass}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 to-purple-600">
                  <i className="fas fa-plus text-white"></i>
                </div>
                <div>
                  <p className="font-medium">Request Match</p>
                  <p className={`text-xs ${faintText}`}>Submit a YouTube URL</p>
                </div>
              </div>
            </motion.button>

            <Link
              to="/library"
              className={`block rounded-2xl border p-4 transition-all duration-300 ${softCardClass}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-green-500 to-emerald-500">
                  <i className="fas fa-video text-white"></i>
                </div>
                <div>
                  <p className="font-medium">Browse Library</p>
                  <p className={`text-xs ${faintText}`}>View all highlights</p>
                </div>
              </div>
            </Link>

            <Link
              to="/requests"
              className={`block rounded-2xl border p-4 transition-all duration-300 ${softCardClass}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-purple-500 to-pink-500">
                  <i className="fas fa-comment-dots text-white"></i>
                </div>
                <div>
                  <p className="font-medium">View Requests</p>
                  <p className={`text-xs ${faintText}`}>Vote on matches</p>
                </div>
              </div>
            </Link>
          </div>

          {myRequests.length > 0 && (
            <div className={`mt-6 border-t pt-6 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <p className={`mb-3 text-sm font-medium ${mutedText}`}>Your Requests</p>
              <div className="space-y-2">
                {myRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="flex items-center justify-between text-xs">
                    <span className={`max-w-[120px] truncate ${isDark ? 'text-white/80' : 'text-slate-700'}`}>
                      {request.match_title || 'Match'}
                    </span>
                    {getStatusBadge(request.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <RequestMatchModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSuccess={handleRequestSubmitted}
      />
    </div>
  );
}
