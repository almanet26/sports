import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useThemeStore } from "../store/themeStore";
import { submissionsApi, api, type CoachAthlete } from "../lib/api";
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

export default function CoachDashboard() {
  const { theme } = useThemeStore();

  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [athletesLoading, setAthletesLoading] = useState(true);
  const [reviewStats, setReviewStats] = useState<{ average_rating: number; total_reviews: number } | null>(null);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    submissionsApi.coachAthletes()
      .then(({ data }) => setAthletes(data.athletes))
      .catch(() => {})
      .finally(() => setAthletesLoading(false));
    
    // Fetch review stats and recent reviews
    Promise.all([
      api.get('/coach/reviews/stats'),
      api.get('/coach/reviews')
    ])
      .then(([statsRes, reviewsRes]) => {
        setReviewStats(statsRes.data);
        setRecentReviews(reviewsRes.data.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));

    // Fetch notifications
    api.get('/notifications')
      .then((r: any) => { setNotifications(r.data.notifications); setUnreadCount(r.data.unread_count); })
      .catch(() => {});
  }, []);

  // Close bell dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = async (id: string) => {
    await api.put(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await api.put('/notifications/mark-all-read');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const myAthletes = athletes;
  const athletesSectionRef = useRef<HTMLDivElement>(null);

  const scrollToAthletes = () => {
    athletesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stats = useMemo(
    () => [
      { title: "My Athletes", value: String(athletes.length), icon: "fas fa-running", color: "from-blue-500 to-cyan-500", change: "Players accepted" },
      { title: "Training Sessions", value: "156", icon: "fas fa-dumbbell", color: "from-green-500 to-emerald-500", change: "+12 this month" },
      { title: "Avg Improvement", value: "18%", icon: "fas fa-chart-line", color: "from-purple-500 to-pink-500", change: "+5% vs last month" },
      { title: "Active Programs", value: "8", icon: "fas fa-clipboard-list", color: "from-orange-500 to-red-500", change: "2 new programs" },
    ],
    [athletes.length]
  );

  const athleteProgress = useMemo(
    () => [
      { week: "Week 1", performance: 65, technique: 70, fitness: 60 },
      { week: "Week 2", performance: 68, technique: 72, fitness: 65 },
      { week: "Week 3", performance: 72, technique: 75, fitness: 68 },
      { week: "Week 4", performance: 75, technique: 78, fitness: 72 },
      { week: "Week 5", performance: 78, technique: 80, fitness: 75 },
      { week: "Week 6", performance: 82, technique: 83, fitness: 78 },
    ],
    []
  );

  const sportsAnalysis = useMemo(
    () => [
      { sport: "Batting", sessions: 45, improvement: 22 },
      { sport: "Bowling", sessions: 38, improvement: 18 },
      { sport: "Fielding", sessions: 32, improvement: 15 },
      { sport: "Fitness", sessions: 28, improvement: 20 },
      { sport: "Mental", sessions: 13, improvement: 16 },
    ],
    []
  );

  const skillsRadar = useMemo(
    () => [
      { skill: "Technique", A: 85, B: 78, fullMark: 100 },
      { skill: "Speed", A: 78, B: 82, fullMark: 100 },
      { skill: "Strength", A: 82, B: 75, fullMark: 100 },
      { skill: "Endurance", A: 75, B: 88, fullMark: 100 },
      { skill: "Mental", A: 88, B: 70, fullMark: 100 },
      { skill: "Tactical", A: 80, B: 85, fullMark: 100 },
    ],
    []
  );

  const trainingSessions = useMemo(
    () => [
      { id: 1, title: "Batting Practice", athlete: "Alex Rodriguez", date: "Today", time: "10:00 AM", status: "Present" },
      { id: 2, title: "Bowling Drills", athlete: "Maya Patel", date: "Today", time: "2:00 PM", status: "Pending" },
      { id: 3, title: "Fitness Training", athlete: "James Wilson", date: "Tomorrow", time: "9:00 AM", status: "Pending" },
      { id: 4, title: "Wicketkeeping", athlete: "Sofia Chen", date: "Tomorrow", time: "11:00 AM", status: "Pending" },
    ],
    []
  );

  const leaderboard = useMemo(
    () => [
      { rank: 1, name: "Sofia Chen", score: 91, improvement: "+12%", badge: "🥇" },
      { rank: 2, name: "Alex Rodriguez", score: 85, improvement: "+8%", badge: "🥈" },
      { rank: 3, name: "Maya Patel", score: 72, improvement: "+15%", badge: "🥉" },
      { rank: 4, name: "James Wilson", score: 58, improvement: "+18%", badge: "⭐" },
    ],
    []
  );

  return (
    <>
      <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`rounded-3xl p-6 mb-8 border ${
          theme === 'dark'
            ? 'glass border-white/20'
            : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-chalkboard-teacher text-green-400"></i>
              Coach Dashboard
            </h1>
            <p className={`mt-2 text-sm ${
              theme === 'dark' ? 'text-white/70' : 'text-gray-600'
            }`}>
              Athlete management, training analytics, and performance insights
            </p>
          </div>

          <div className="flex gap-3 items-center">
            {/* Bell Icon - only */}
            <div ref={bellRef} className="relative">
              <button
                onClick={() => setBellOpen(o => !o)}
                className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                  theme === 'dark' ? 'glass border-white/20 hover:bg-white/10' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                }`}
              >
                <i className="fas fa-bell text-sm"></i>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            whileHover={{ scale: 1.05, y: -5 }}
            onClick={s.title === "My Athletes" ? scrollToAthletes : undefined}
            className={`rounded-2xl p-6 border transition-all duration-300 group cursor-pointer ${
              theme === 'dark'
                ? 'glass border-white/20 hover:border-white/30'
                : 'bg-white border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${s.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <i className={`${s.icon} text-white text-lg`}></i>
              </div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <p className={`text-sm mb-2 ${
              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`}>{s.title}</p>
            <p className="text-2xl font-bold mb-2">{s.value}</p>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-white/50' : 'text-gray-500'
            }`}>{s.change}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Athlete Progress */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className={`lg:col-span-2 rounded-3xl p-6 border transition-all duration-300 ${
            theme === 'dark'
              ? 'glass border-white/20 hover:border-white/30'
              : 'bg-white border-gray-200 hover:border-gray-300 shadow-lg'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
              <i className="fas fa-chart-line text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Athlete Progress Tracking</p>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>Weekly performance, technique, and fitness metrics</p>
            </div>
          </div>

          <div className="h-72" style={{ minHeight: '288px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={athleteProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="week" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    color: 'white'
                  }}
                />
                <Line type="monotone" dataKey="performance" stroke="#3B82F6" strokeWidth={3} name="Performance" />
                <Line type="monotone" dataKey="technique" stroke="#10B981" strokeWidth={3} name="Technique" />
                <Line type="monotone" dataKey="fitness" stroke="#F59E0B" strokeWidth={3} name="Fitness" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Skills Radar */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className={`rounded-3xl p-6 border transition-all duration-300 ${
            theme === 'dark'
              ? 'glass border-white/20 hover:border-white/30'
              : 'bg-white border-gray-200 hover:border-gray-300 shadow-lg'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <i className="fas fa-spider text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Skills Analysis</p>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>Top athletes comparison</p>
            </div>
          </div>

          <div className="h-64" style={{ minHeight: '256px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={skillsRadar}>
                <PolarGrid stroke="rgba(255,255,255,0.2)" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }} />
                <PolarRadiusAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                <Radar name="Athlete A" dataKey="A" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                <Radar name="Athlete B" dataKey="B" stroke="#10B981" fill="#10B981" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Sports Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`rounded-3xl p-6 border mb-8 ${
          theme === 'dark'
            ? 'glass border-white/20'
            : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-xl">
            <i className="fas fa-chart-bar text-white"></i>
          </div>
          <div>
            <p className="font-semibold text-lg">Training Focus Analysis</p>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`}>Sessions conducted and improvement rates by skill</p>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sportsAnalysis}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="sport" stroke="rgba(255,255,255,0.6)" />
              <YAxis stroke="rgba(255,255,255,0.6)" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  color: 'white'
                }}
              />
              <Bar dataKey="sessions" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Sessions" />
              <Bar dataKey="improvement" fill="#10B981" radius={[4, 4, 0, 0]} name="Improvement %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Training Schedule & Reviews */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Training Schedule */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className={`rounded-3xl p-6 border ${
            theme === 'dark'
              ? 'glass border-white/20'
              : 'bg-white border-gray-200 shadow-lg'
          }`}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
              <i className="fas fa-calendar-alt text-white"></i>
            </div>
            <div>
              <p className="font-semibold text-lg">Training Schedule</p>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>Upcoming sessions</p>
            </div>
          </div>

          <div className="space-y-3">
            {trainingSessions.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-xl p-4 border transition-all ${
                  theme === 'dark'
                    ? 'glass border-white/10 hover:border-blue-500/30'
                    : 'bg-gray-50 border-gray-200 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">{session.title}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    session.status === 'Present' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {session.status}
                  </span>
                </div>
                <p className={`text-sm mb-2 ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>{session.athlete}</p>
                <div className={`flex items-center gap-4 text-xs ${
                  theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                }`}>
                  <span><i className="fas fa-calendar mr-1"></i>{session.date}</span>
                  <span><i className="fas fa-clock mr-1"></i>{session.time}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Reviews */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={`rounded-3xl p-6 border ${
            theme === 'dark'
              ? 'glass border-white/20'
              : 'bg-white border-gray-200 shadow-lg'
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
                <i className="fas fa-star text-white"></i>
              </div>
              <div>
                <p className="font-semibold text-lg">Recent Reviews</p>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                }`}>
                  {reviewsLoading ? 'Loading...' : reviewStats ? `${reviewStats.average_rating.toFixed(1)} ⭐ (${reviewStats.total_reviews} reviews)` : 'No reviews yet'}
                </p>
              </div>
            </div>
            <Link
              to="/coach/reviews"
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'border-white/20 text-white/60 hover:text-white hover:bg-white/10'
                  : 'border-gray-300 text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {reviewsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
              </div>
            ) : recentReviews.length === 0 ? (
              <div className={`text-center py-8 rounded-2xl border border-dashed ${
                theme === 'dark' ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-400'
              }`}>
                <i className="fas fa-star text-3xl mb-2 block"></i>
                <p className="text-sm">No reviews yet. Players will leave reviews after sessions.</p>
              </div>
            ) : recentReviews.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-xl p-4 border transition-all ${
                  theme === 'dark'
                    ? 'glass border-white/10 hover:border-yellow-500/30'
                    : 'bg-gray-50 border-gray-200 hover:border-yellow-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {review.player_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm truncate">{review.player_name}</p>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <i
                            key={star}
                            className={`fas fa-star text-xs ${
                              star <= review.rating ? 'text-yellow-400' : theme === 'dark' ? 'text-white/20' : 'text-gray-300'
                            }`}
                          ></i>
                        ))}
                      </div>
                    </div>
                    <p className={`text-xs line-clamp-2 ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`}>
                      {review.comment || 'No comment provided'}
                    </p>
                    <p className={`text-xs mt-1 ${
                      theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                    }`}>
                      {new Date(review.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`rounded-3xl p-6 border mb-8 ${
          theme === 'dark'
            ? 'glass border-white/20'
            : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
            <i className="fas fa-trophy text-white"></i>
          </div>
          <div>
            <p className="font-semibold text-lg">Top Performers</p>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`}>Athletes with highest improvement this month</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {leaderboard.map((player, i) => (
            <motion.div
              key={player.rank}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-xl p-4 border transition-all text-center ${
                theme === 'dark'
                  ? 'glass border-white/10 hover:border-purple-500/30'
                  : 'bg-gray-50 border-gray-200 hover:border-purple-400'
              }`}
            >
              <span className="text-4xl mb-2 block">{player.badge}</span>
              <p className="font-medium text-sm mb-1">{player.name}</p>
              <p className="text-lg font-bold text-yellow-400 mb-1">{player.score}</p>
              <p className="text-xs text-green-400">{player.improvement}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* My Athletes */}
      <motion.div
        ref={athletesSectionRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`rounded-3xl p-6 border ${
          theme === 'dark'
            ? 'glass border-white/20'
            : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-xl">
              <i className="fas fa-users text-white"></i>
            </div>
            <div>
              <p className="font-semibold text-lg">My Athletes</p>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>
                {athletesLoading ? 'Loading…' : `${athletes.length} athlete${athletes.length !== 1 ? 's' : ''} accepted`}
              </p>
            </div>
          </div>
          <Link
            to="/coach/submissions"
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              theme === 'dark'
                ? 'border-white/20 text-white/60 hover:text-white hover:bg-white/10'
                : 'border-gray-300 text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <i className="fas fa-inbox mr-1"></i>View Inbox
          </Link>
        </div>

        <div className="space-y-3">
          {athletesLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : myAthletes.length === 0 ? (
            <div className={`text-center py-8 rounded-2xl border border-dashed ${
              theme === 'dark' ? 'border-white/10 text-white/30' : 'border-gray-200 text-gray-400'
            }`}>
              <i className="fas fa-users text-3xl mb-2 block"></i>
              <p className="text-sm">No athletes yet. Accept submissions from your inbox.</p>
            </div>
          ) : myAthletes.map((athlete, i) => (
            <Link key={athlete.id} to={`/coach/player/${athlete.id}`} className="block">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className={`rounded-2xl p-4 border transition-all duration-300 cursor-pointer ${
                  theme === 'dark'
                    ? 'glass border-white/10 hover:border-blue-500/50'
                    : 'bg-gray-50 border-gray-200 hover:border-blue-400 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      {athlete.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{athlete.name}</p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                        {athlete.team || athlete.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-green-400">{athlete.published_reports}</p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>Reports</p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold">{athlete.total_submissions}</p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>Submissions</p>
                    </div>
                    <i className={`fas fa-chevron-right text-xs ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}></i>
                  </div>
                </div>
                {/* Progress bar: published / total */}
                {athlete.total_submissions > 0 && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>Report completion</span>
                      <span className={`text-xs font-medium ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
                        {Math.round((athlete.published_reports / athlete.total_submissions) * 100)}%
                      </span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((athlete.published_reports / athlete.total_submissions) * 100)}%` }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                        className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>
      </div>

    {/* Notification Dropdown — fixed overlay so it never overlaps page content */}
    <AnimatePresence>
      {bellOpen && (
        <motion.div
          ref={bellRef}
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={`fixed top-20 right-6 w-80 rounded-2xl border shadow-2xl z-[999] overflow-hidden ${
            theme === 'dark' ? 'bg-[#0d1117] border-white/20 text-white' : 'bg-white border-gray-200 text-gray-900'
          }`}
        >
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            theme === 'dark' ? 'border-white/10' : 'border-gray-100'
          }`}>
            <p className="font-semibold text-sm">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className={`p-6 text-center text-sm ${
                theme === 'dark' ? 'text-white/40' : 'text-gray-400'
              }`}>
                <i className="fas fa-bell-slash text-2xl mb-2 block"></i>
                No notifications yet
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
                className={`flex gap-3 px-4 py-3 border-b cursor-pointer transition-all ${
                  theme === 'dark' ? 'border-white/5 hover:bg-white/5' : 'border-gray-50 hover:bg-gray-50'
                } ${!n.is_read ? theme === 'dark' ? 'bg-blue-500/5' : 'bg-blue-50' : ''}`}
              >
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
                  n.type === 'submission' ? 'bg-blue-500/20 text-blue-400' :
                  n.type === 'review' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  <i className={`fas ${
                    n.type === 'submission' ? 'fa-paper-plane' :
                    n.type === 'review' ? 'fa-star' : 'fa-bell'
                  } text-xs`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{n.title}</p>
                  <p className={`text-xs mt-0.5 line-clamp-2 ${
                    theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                  }`}>{n.message}</p>
                  <p className={`text-[10px] mt-1 ${
                    theme === 'dark' ? 'text-white/30' : 'text-gray-400'
                  }`}>{new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
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
