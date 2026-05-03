import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useThemeStore } from "../store/themeStore";
import { api, notificationsApi, type NotificationItem } from "../lib/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

interface DashboardData {
  stats: { total_sessions: number; active_plans: number; avg_improvement: number; total_athletes: number };
  athlete_progress: { week: string; performance: number; technique: number; fitness: number }[];
  sports_analysis: { sport: string; sessions: number; improvement: number }[];
  skills_radar: { skill: string; A: number; B: number; fullMark: number }[];
  training_sessions: { id: string; title: string; athlete: string; date: string; time: string; status: string; type: string }[];
  leaderboard: { id: string; name: string; score: number; badge: string; improvement: string }[];
  recent_reviews: { id: string; player_name: string; rating: number; comment?: string; created_at?: string }[];
  review_stats: { average_rating: number; total_reviews: number };
}

export default function CoachDashboard() {
  const { theme } = useThemeStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const athletesSectionRef = useRef<HTMLDivElement>(null);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white/70 backdrop-blur-xl border-slate-200/60 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-white/60 border-slate-200/50';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-slate-500';
  const tooltipStyle = { backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: 'white' };

  useEffect(() => {
    api.get('/analytics/coach/dashboard')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));

    notificationsApi.getAll()
      .then(r => { setNotifications(r.data.notifications); setUnreadCount(r.data.unread_count); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const stats = data ? [
    { title: "My Athletes", value: String(data.stats.total_athletes), icon: "fas fa-running", color: "from-blue-500 to-cyan-500", change: "Players accepted", onClick: () => athletesSectionRef.current?.scrollIntoView({ behavior: "smooth" }) },
    { title: "Training Sessions", value: String(data.stats.total_sessions), icon: "fas fa-dumbbell", color: "from-green-500 to-emerald-500", change: "Total scheduled" },
    { title: "Avg Completion", value: `${data.stats.avg_improvement}%`, icon: "fas fa-chart-line", color: "from-purple-500 to-pink-500", change: "Reports published" },
    { title: "Active Plans", value: String(data.stats.active_plans), icon: "fas fa-clipboard-list", color: "from-orange-500 to-red-500", change: "Training plans" },
  ] : [];

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      <div className={theme === 'dark' ? 'text-white' : 'text-slate-800'}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl p-6 mb-8 border ${glass}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
                <i className="fas fa-chalkboard-teacher text-green-400"></i>Coach Dashboard
              </h1>
              <p className={`mt-2 text-sm ${sub}`}>Athlete management, training analytics, and performance insights</p>
            </div>
            <div ref={bellRef} className="relative">
              <button onClick={() => setBellOpen(o => !o)}
                className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${theme === 'dark' ? 'glass border-white/20 hover:bg-white/10' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'}`}>
                <i className="fas fa-bell text-sm"></i>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.1 }} whileHover={{ scale: 1.05, y: -5 }}
              onClick={s.onClick} className={`rounded-2xl p-6 border transition-all cursor-pointer group ${cardBg}`}>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${s.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <i className={`${s.icon} text-white text-lg`}></i>
                </div>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              </div>
              <p className={`text-sm mb-2 ${sub}`}>{s.title}</p>
              <p className="text-2xl font-bold mb-2">{s.value}</p>
              <p className={`text-xs ${sub}`}>{s.change}</p>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className={`lg:col-span-2 rounded-3xl p-6 border ${glass}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                <i className="fas fa-chart-line text-white"></i>
              </div>
              <div>
                <p className="font-semibold">Athlete Progress Tracking</p>
                <p className={`text-sm ${sub}`}>Weekly performance, technique, and fitness metrics</p>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.athlete_progress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="week" stroke="rgba(255,255,255,0.6)" />
                  <YAxis stroke="rgba(255,255,255,0.6)" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="performance" stroke="#3B82F6" strokeWidth={3} name="Performance" />
                  <Line type="monotone" dataKey="technique" stroke="#10B981" strokeWidth={3} name="Technique" />
                  <Line type="monotone" dataKey="fitness" stroke="#F59E0B" strokeWidth={3} name="Fitness" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className={`rounded-3xl p-6 border ${glass}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <i className="fas fa-spider text-white"></i>
              </div>
              <div>
                <p className="font-semibold">Skills Analysis</p>
                <p className={`text-sm ${sub}`}>Top athletes comparison</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={data?.skills_radar}>
                  <PolarGrid stroke="rgba(255,255,255,0.2)" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                  <PolarRadiusAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                  <Radar name="Batting" dataKey="A" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                  <Radar name="Bowling" dataKey="B" stroke="#10B981" fill="#10B981" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Training Focus */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl p-6 border mb-8 ${glass}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
              <i className="fas fa-chart-bar text-white"></i>
            </div>
            <div>
              <p className="font-semibold text-lg">Training Focus Analysis</p>
              <p className={`text-sm ${sub}`}>Sessions conducted and completion rates by skill</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.sports_analysis}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="sport" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="sessions" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Submissions" />
                <Bar dataKey="improvement" fill="#10B981" radius={[4, 4, 0, 0]} name="Improvement %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Training Schedule & Reviews */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Training Schedule */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className={`rounded-3xl p-6 border ${glass}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                  <i className="fas fa-calendar-alt text-white"></i>
                </div>
                <div>
                  <p className="font-semibold text-lg">Training Schedule</p>
                  <p className={`text-sm ${sub}`}>Upcoming sessions</p>
                </div>
              </div>
              <Link to="/coach/sessions" className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${theme === 'dark' ? 'border-white/20 text-white/60 hover:text-white hover:bg-white/10' : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                Manage
              </Link>
            </div>
            {!data?.training_sessions.length ? (
              <div className={`text-center py-8 rounded-2xl border border-dashed ${theme === 'dark' ? 'border-white/10 text-white/30' : 'border-slate-200 text-slate-400'}`}>
                <i className="fas fa-calendar text-3xl mb-2 block"></i>
                <p className="text-sm">No sessions scheduled yet.</p>
                <Link to="/coach/sessions" className="text-xs text-blue-400 mt-1 block">+ Add Session</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.training_sessions.map((session, i) => (
                  <motion.div key={session.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    className={`rounded-xl p-4 border ${cardBg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{session.title}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                        {session.type}
                      </span>
                    </div>
                    <div className={`flex items-center gap-4 text-xs ${sub}`}>
                      <span><i className="fas fa-calendar mr-1"></i>{session.date}</span>
                      <span><i className="fas fa-clock mr-1"></i>{session.time}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Recent Reviews */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className={`rounded-3xl p-6 border ${glass}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
                  <i className="fas fa-star text-white"></i>
                </div>
                <div>
                  <p className="font-semibold text-lg">Recent Reviews</p>
                  <p className={`text-sm ${sub}`}>
                    {data?.review_stats.total_reviews
                      ? `${data.review_stats.average_rating} ⭐ (${data.review_stats.total_reviews} reviews)`
                      : 'No reviews yet'}
                  </p>
                </div>
              </div>
              <Link to="/coach/reviews" className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${theme === 'dark' ? 'border-white/20 text-white/60 hover:text-white hover:bg-white/10' : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                View All
              </Link>
            </div>
            {!data?.recent_reviews.length ? (
              <div className={`text-center py-8 rounded-2xl border border-dashed ${theme === 'dark' ? 'border-white/10 text-white/30' : 'border-slate-200 text-slate-400'}`}>
                <i className="fas fa-star text-3xl mb-2 block"></i>
                <p className="text-sm">No reviews yet. Players will leave reviews after sessions.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recent_reviews.map((review, i) => (
                  <motion.div key={review.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    className={`rounded-xl p-4 border ${cardBg}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {review.player_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm truncate">{review.player_name}</p>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(s => <i key={s} className={`fas fa-star text-xs ${s <= review.rating ? 'text-yellow-400' : sub}`}></i>)}
                          </div>
                        </div>
                        <p className={`text-xs line-clamp-2 ${sub}`}>{review.comment || 'No comment'}</p>
                        {review.created_at && <p className={`text-xs mt-1 ${sub}`}>{new Date(review.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Top Performers */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl p-6 border mb-8 ${glass}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <i className="fas fa-trophy text-white"></i>
            </div>
            <div>
              <p className="font-semibold text-lg">Top Performers</p>
              <p className={`text-sm ${sub}`}>Athletes with highest published reports</p>
            </div>
          </div>
          {!data?.leaderboard.length ? (
            <div className={`text-center py-8 rounded-2xl border border-dashed ${theme === 'dark' ? 'border-white/10 text-white/30' : 'border-slate-200 text-slate-400'}`}>
              <i className="fas fa-trophy text-3xl mb-2 block"></i>
              <p className="text-sm">No athlete data yet.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data.leaderboard.map((player, i) => (
                <motion.div key={player.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className={`rounded-xl p-4 border text-center ${cardBg}`}>
                  <span className="text-4xl mb-2 block">{player.badge}</span>
                  <p className="font-medium text-sm mb-1">{player.name}</p>
                  <p className="text-lg font-bold text-yellow-400 mb-1">{player.score}</p>
                  <p className="text-xs text-green-400">{player.improvement}</p>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* My Athletes */}
        <motion.div ref={athletesSectionRef} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl p-6 border ${glass}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                <i className="fas fa-users text-white"></i>
              </div>
              <div>
                <p className="font-semibold text-lg">My Athletes</p>
                <p className={`text-sm ${sub}`}>{data?.stats.total_athletes || 0} athletes accepted</p>
              </div>
            </div>
            <Link to="/coach/submissions" className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${theme === 'dark' ? 'border-white/20 text-white/60 hover:text-white hover:bg-white/10' : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
              <i className="fas fa-inbox mr-1"></i>View Inbox
            </Link>
          </div>
          {!data?.leaderboard.length ? (
            <div className={`text-center py-8 rounded-2xl border border-dashed ${theme === 'dark' ? 'border-white/10 text-white/30' : 'border-slate-200 text-slate-400'}`}>
              <i className="fas fa-users text-3xl mb-2 block"></i>
              <p className="text-sm">No athletes yet. Accept submissions from your inbox.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.leaderboard.map((athlete, i) => (
                <Link key={athlete.id} to={`/coach/player/${athlete.id}`} className="block">
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    className={`rounded-2xl p-4 border transition-all cursor-pointer ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                          {athlete.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold">{athlete.name}</p>
                          <p className={`text-xs ${sub}`}>{athlete.score} published reports</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{athlete.badge}</span>
                        <i className={`fas fa-chevron-right text-xs ${sub}`}></i>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Notification Dropdown */}
      <AnimatePresence>
        {bellOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`fixed top-20 right-6 w-80 rounded-2xl border shadow-2xl z-[999] overflow-hidden ${
              theme === 'dark' ? 'bg-[#0d1117] border-white/20 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className={`flex items-center justify-between px-4 py-3 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>
              <p className="font-semibold text-sm">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className={`p-6 text-center text-sm ${sub}`}>
                  <i className="fas fa-bell-slash text-2xl mb-2 block"></i>No notifications yet
                </div>
              ) : notifications.map(n => (
                <div key={n.id} onClick={() => !n.is_read && handleMarkRead(n.id)}
                  className={`flex gap-3 px-4 py-3 border-b cursor-pointer transition-all ${
                    theme === 'dark' ? 'border-white/5 hover:bg-white/5' : 'border-slate-50 hover:bg-slate-50'
                  } ${!n.is_read ? theme === 'dark' ? 'bg-blue-500/5' : 'bg-blue-50' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                    n.type === 'submission' ? 'bg-blue-500/20 text-blue-400' :
                    n.type === 'review' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    <i className={`fas ${n.type === 'submission' ? 'fa-paper-plane' : n.type === 'review' ? 'fa-star' : 'fa-bell'} text-xs`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{n.title}</p>
                    <p className={`text-xs mt-0.5 line-clamp-2 ${sub}`}>{n.message}</p>
                    <p className={`text-[10px] mt-1 ${sub}`}>{new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1"></div>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
