import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useThemeStore } from "../store/themeStore";

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
  const stats = useMemo(
    () => [
      { title: "My Athletes", value: "24", icon: "fas fa-running", color: "from-blue-500 to-cyan-500", change: "+3 this week" },
      { title: "Training Sessions", value: "156", icon: "fas fa-dumbbell", color: "from-green-500 to-emerald-500", change: "+12 this month" },
      { title: "Avg Improvement", value: "18%", icon: "fas fa-chart-line", color: "from-purple-500 to-pink-500", change: "+5% vs last month" },
      { title: "Active Programs", value: "8", icon: "fas fa-clipboard-list", color: "from-orange-500 to-red-500", change: "2 new programs" },
    ],
    []
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

  const myAthletes = useMemo(
    () => [
      { id: "1", name: "Alex Rodriguez", sport: "Batsman", level: "Advanced", progress: 85, lastSession: "2 hours ago", status: "Active" },
      { id: "2", name: "Maya Patel", sport: "Bowler", level: "Intermediate", progress: 72, lastSession: "1 day ago", status: "Active" },
      { id: "3", name: "James Wilson", sport: "All-rounder", level: "Beginner", progress: 58, lastSession: "3 days ago", status: "Needs Attention" },
      { id: "4", name: "Sofia Chen", sport: "Wicketkeeper", level: "Advanced", progress: 91, lastSession: "5 hours ago", status: "Excellent" },
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

          <div className="flex gap-3">
            <Link
              to="/upload"
              className={`px-4 py-2 rounded-xl border transition-all duration-300 text-sm flex items-center gap-2 ${
                theme === 'dark'
                  ? 'glass border-white/20 hover:bg-white/10'
                  : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
              }`}
            >
              <i className="fas fa-cloud-upload-alt"></i>
              Upload Video
            </Link>
            <Link
              to="/library"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 text-sm font-semibold flex items-center gap-2"
            >
              <i className="fas fa-video"></i>
              Library
            </Link>
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

      {/* Training Schedule & Leaderboard */}
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

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className={`rounded-3xl p-6 border ${
            theme === 'dark'
              ? 'glass border-white/20'
              : 'bg-white border-gray-200 shadow-lg'
          }`}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
              <i className="fas fa-trophy text-white"></i>
            </div>
            <div>
              <p className="font-semibold text-lg">Leaderboard</p>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-white/60' : 'text-gray-600'
              }`}>Top performers this month</p>
            </div>
          </div>

          <div className="space-y-3">
            {leaderboard.map((player, i) => (
              <motion.div
                key={player.rank}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-xl p-4 border transition-all ${
                  theme === 'dark'
                    ? 'glass border-white/10 hover:border-yellow-500/30'
                    : 'bg-gray-50 border-gray-200 hover:border-yellow-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{player.badge}</span>
                    <div>
                      <p className="font-medium">{player.name}</p>
                      <p className={`text-xs ${
                        theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                      }`}>Rank #{player.rank}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-yellow-400">{player.score}</p>
                    <p className="text-xs text-green-400">{player.improvement}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* My Athletes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`rounded-3xl p-6 border ${
          theme === 'dark'
            ? 'glass border-white/20'
            : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-xl">
            <i className="fas fa-users text-white"></i>
          </div>
          <div>
            <p className="font-semibold text-lg">My Athletes</p>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-white/60' : 'text-gray-600'
            }`}>Current training roster and progress</p>
          </div>
        </div>

        <div className="space-y-3">
          {myAthletes.map((athlete, i) => (
            <Link
              key={i}
              to={`/coach/players`}
              className="block"
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className={`rounded-2xl p-4 border transition-all duration-300 group cursor-pointer ${
                  theme === 'dark'
                    ? 'glass border-white/10 hover:border-blue-500/50'
                    : 'bg-gray-50 border-gray-200 hover:border-blue-400 shadow-sm hover:shadow-md'
                }`}
              >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                    {athlete.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{athlete.name}</p>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-white/60' : 'text-gray-600'
                    }`}>{athlete.sport} • {athlete.level}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium">{athlete.progress}%</p>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                    }`}>Progress</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}>{athlete.lastSession}</p>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                    }`}>Last Active</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full ${
                    athlete.status === 'Excellent' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    athlete.status === 'Active' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {athlete.status}
                  </span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className={`mt-4 h-2 rounded-full overflow-hidden ${
                theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
              }`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${athlete.progress}%` }}
                  transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                  className={`h-full rounded-full ${
                    athlete.progress >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    athlete.progress >= 60 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                    'bg-gradient-to-r from-yellow-500 to-orange-500'
                  }`}
                />
              </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
