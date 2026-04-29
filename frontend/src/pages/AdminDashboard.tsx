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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { videosApi, requestsApi, adminApi } from '../lib/api';
import { useUser } from '../store/authStore';

interface DashboardStats {
  totalVideos: number;
  pendingJobs: number;
  pendingRequests: number;
  totalUsers: number;
  totalPlayers: number;
  totalCoaches: number;
  pendingCoaches: number;
  subscription_breakdown?: {
    basic: number;
    silver: number;
    gold: number;
  };
  revenue?: {
    monthly: number;
    yearly: number;
  };
}

interface PendingRequest {
  id: string;
  match_title: string;
  teams: string;
  vote_count: number;
  status: string;
  created_at: string;
}

interface PendingCoach {
  id: string;
  name: string;
  email: string;
  team?: string;
  specialization?: string[];
  certifications?: Array<{name: string; issuer: string; year: string}>;
  created_at: string;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  color: string;
}

export default function AdminDashboard() {
  const user = useUser();
  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    pendingJobs: 0,
    pendingRequests: 0,
    totalUsers: 0,
    totalPlayers: 0,
    totalCoaches: 0,
    pendingCoaches: 0,
  });
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingCoaches, setPendingCoaches] = useState<PendingCoach[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Static chart data
  const userGrowth = useMemo(() => [
    { month: "Jan", users: 120, videos: 45, revenue: 2340 },
    { month: "Feb", users: 145, videos: 52, revenue: 2890 },
    { month: "Mar", users: 168, videos: 61, revenue: 3420 },
    { month: "Apr", users: 192, videos: 78, revenue: 4180 },
    { month: "May", users: 218, videos: 89, revenue: 4950 },
    { month: "Jun", users: 245, videos: 102, revenue: 5680 },
    { month: "Jul", users: 284, videos: 156, revenue: 6890 },
  ], []);

  const subscriptionData = useMemo(() => [
    { name: "Basic", value: stats.subscription_breakdown?.basic || 0, color: "#6B7280" },
    { name: "Silver", value: stats.subscription_breakdown?.silver || 0, color: "#C0C0C0" },
    { name: "Gold", value: stats.subscription_breakdown?.gold || 0, color: "#FFD700" },
  ], [stats.subscription_breakdown]);

  const statCards = useMemo(() => [
    { title: "Total Videos", value: stats.totalVideos.toString(), icon: "fas fa-video", color: "from-blue-500 to-cyan-500", change: "+8%" },
    { title: "Pending Coaches", value: stats.pendingCoaches.toString(), icon: "fas fa-user-clock", color: "from-green-500 to-emerald-500", change: "Needs Review" },
    { title: "Pending Requests", value: stats.pendingRequests.toString(), icon: "fas fa-inbox", color: "from-purple-500 to-pink-500", change: "Needs Review" },
    { title: "System Status", value: "99.9%", icon: "fas fa-server", color: "from-yellow-500 to-orange-500", change: "Healthy" },
  ], [stats]);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const [videosResponse, requestsResponse, statsResponse, coachesResponse, activityResponse] = await Promise.all([
        videosApi.listAll({ page: 1, per_page: 1 }),
        requestsApi.adminDashboard(1, 10),
        adminApi.getStats(),
        adminApi.getPendingCoaches(5),
        adminApi.getActivityFeed(15),
      ]);
      
      setStats({
        totalVideos: videosResponse.data.total || 0,
        pendingJobs: 0,
        pendingRequests: requestsResponse.data.total || 0,
        totalUsers: statsResponse.data.total_users || 0,
        totalPlayers: statsResponse.data.total_players || 0,
        totalCoaches: statsResponse.data.total_coaches || 0,
        pendingCoaches: statsResponse.data.pending_coaches || 0,
        subscription_breakdown: statsResponse.data.subscription_breakdown,
        revenue: statsResponse.data.revenue,
      });
      
      setPendingRequests(requestsResponse.data.requests || []);
      setPendingCoaches(coachesResponse.data.coaches || []);
      setActivities(activityResponse.data.activities || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCoachAction = async (coachId: string, action: 'verified' | 'rejected') => {
    try {
      await adminApi.verifyCoach(coachId, action);
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to update coach:', error);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'approved' | 'rejected') => {
    try {
      await requestsApi.updateStatus(requestId, action);
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to update request:', error);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'registration': return 'fa-user-plus';
      case 'coach_application': return 'fa-user-check';
      case 'upload': return 'fa-cloud-upload-alt';
      case 'system': return 'fa-cog';
      default: return 'fa-bell';
    }
  };

  const getActivityColor = (color: string) => {
    switch (color) {
      case 'blue': return 'from-blue-500 to-cyan-500';
      case 'green': return 'from-green-500 to-emerald-500';
      case 'purple': return 'from-purple-500 to-pink-500';
      case 'orange': return 'from-orange-500 to-red-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

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
              <i className="fas fa-shield-alt text-red-400"></i>
              Admin Dashboard
            </h1>
            <p className="text-white/70 mt-2 text-sm">
              System overview, user management, and platform analytics
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              to="/admin/coaches"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-300 text-sm font-semibold flex items-center gap-2"
            >
              <i className="fas fa-user-check"></i>
              Coach Verification
            </Link>
            <Link
              to="/admin/upload"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 text-sm font-semibold flex items-center gap-2"
            >
              <i className="fas fa-cloud-upload-alt"></i>
              Upload Video
            </Link>
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

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((s, i) => (
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
              <span className={`text-xs px-2 py-1 rounded-full ${
                s.change.includes('+') ? 'bg-green-500/20 text-green-400' : 
                s.change === 'Healthy' ? 'bg-green-500/20 text-green-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {s.change}
              </span>
            </div>
            <p className="text-sm text-white/60 mb-2">{s.title}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Trends */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-2 glass rounded-3xl p-6 border border-white/20 hover:border-white/30 transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                <i className="fas fa-dollar-sign text-white"></i>
              </div>
              <div>
                <p className="font-semibold">Revenue Trends</p>
                <p className="text-sm text-white/60">Monthly recurring revenue growth</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-400">${stats.revenue?.monthly.toLocaleString() || 0}</p>
              <p className="text-xs text-white/60">MRR</p>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    color: 'white'
                  }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} name="Revenue ($)" />
                <Line type="monotone" dataKey="users" stroke="#3B82F6" strokeWidth={2} name="Users" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Subscription Breakdown */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass rounded-3xl p-6 border border-white/20 hover:border-white/30 transition-all duration-300"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
              <i className="fas fa-crown text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Subscription Plans</p>
              <p className="text-sm text-white/60">Active subscribers</p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subscriptionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                >
                  {subscriptionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {subscriptionData.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold">{item.value}</span>
                  <span className="text-xs text-white/60 ml-2">
                    {stats.totalUsers > 0 ? Math.round((item.value / stats.totalUsers) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Summary */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-white/60">Monthly Revenue</span>
              <span className="font-semibold text-green-400">${stats.revenue?.monthly.toLocaleString() || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/60">Yearly Projection</span>
              <span className="font-semibold text-blue-400">${stats.revenue?.yearly.toLocaleString() || 0}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Metrics Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="glass rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <i className="fas fa-users text-white"></i>
            </div>
            <span className="text-sm text-white/60">Total Users</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalUsers}</p>
          <p className="text-xs text-green-400 mt-1">↑ 12% this month</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="glass rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
              <i className="fas fa-running text-white"></i>
            </div>
            <span className="text-sm text-white/60">Total Players</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalPlayers}</p>
          <p className="text-xs text-blue-400 mt-1">Registered players</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="glass rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <i className="fas fa-chalkboard-teacher text-white"></i>
            </div>
            <span className="text-sm text-white/60">Total Coaches</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalCoaches}</p>
          <p className="text-xs text-green-400 mt-1">{stats.pendingCoaches} pending verification</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
          className="glass rounded-2xl p-6 border border-white/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
              <i className="fas fa-star text-white"></i>
            </div>
            <span className="text-sm text-white/60">Premium Users</span>
          </div>
          <p className="text-3xl font-bold">
            {(stats.subscription_breakdown?.silver || 0) + (stats.subscription_breakdown?.gold || 0)}
          </p>
          <p className="text-xs text-green-400 mt-1">↑ 8% conversion</p>
        </motion.div>
      </div>

      {/* Bottom Row - Pending Items & Activity Feed */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coach Verification Queue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass rounded-3xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-xl">
                <i className="fas fa-user-check text-white"></i>
              </div>
              <div>
                <p className="font-semibold text-lg">Coach Verification Queue</p>
                <p className="text-sm text-white/60">Pending coach applications</p>
              </div>
            </div>
            <Link to="/admin/coaches" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View all →
            </Link>
          </div>

          {pendingCoaches.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-check-circle text-4xl text-green-400 mb-4"></i>
              <p className="text-white/60">No pending verifications</p>
              <p className="text-sm text-white/40 mt-1">All coaches verified!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingCoaches.map((coach, i) => (
                <motion.div
                  key={coach.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all duration-300"
                >
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold">
                        {coach.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{coach.name}</p>
                        <p className="text-xs text-white/50">
                          {coach.email} {coach.team && `• ${coach.team}`}
                        </p>
                        {coach.specialization && coach.specialization.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {coach.specialization.slice(0, 2).map((spec, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                                {spec}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCoachAction(coach.id, 'verified')}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all"
                      >
                        <i className="fas fa-check mr-1"></i> Approve
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCoachAction(coach.id, 'rejected')}
                        className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all"
                      >
                        <i className="fas fa-times mr-1"></i> Reject
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Pending Requests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass rounded-3xl p-6 border border-white/20"
        >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center text-xl">
              <i className="fas fa-inbox text-white"></i>
            </div>
            <div>
              <p className="font-semibold text-lg">Pending Requests</p>
              <p className="text-sm text-white/60">Match requests awaiting approval</p>
            </div>
          </div>
          <Link to="/requests" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            View all →
          </Link>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-check-circle text-4xl text-green-400 mb-4"></i>
            <p className="text-white/60">No pending requests</p>
            <p className="text-sm text-white/40 mt-1">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.slice(0, 5).map((request, i) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all duration-300"
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                      <i className="fas fa-cricket-bat-ball text-sm"></i>
                    </div>
                    <div>
                      <p className="font-medium">{request.match_title || 'Untitled Match'}</p>
                      <p className="text-xs text-white/50">{request.teams || 'Teams TBD'} • {formatDate(request.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/60 flex items-center gap-1">
                      <i className="fas fa-thumbs-up"></i>
                      {request.vote_count || 0} votes
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRequestAction(request.id, 'approved')}
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all"
                    >
                      <i className="fas fa-check mr-1"></i> Approve
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRequestAction(request.id, 'rejected')}
                      className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all"
                    >
                      <i className="fas fa-times mr-1"></i> Reject
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="glass rounded-3xl p-6 border border-white/20"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-xl">
                <i className="fas fa-stream text-white"></i>
              </div>
              <div>
                <p className="font-semibold text-lg">Activity Feed</p>
                <p className="text-sm text-white/60">Recent system events</p>
              </div>
            </div>
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-inbox text-4xl text-white/20 mb-4"></i>
              <p className="text-white/60">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {activities.map((activity, i) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-xl p-3 border border-white/10 hover:border-white/20 transition-all duration-300"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${getActivityColor(activity.color)} flex items-center justify-center flex-shrink-0`}>
                      <i className={`fas ${getActivityIcon(activity.type)} text-white text-xs`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-white/50 truncate">{activity.description}</p>
                      <p className="text-xs text-white/40 mt-1">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
