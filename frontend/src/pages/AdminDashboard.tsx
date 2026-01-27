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
import { videosApi, requestsApi } from '../lib/api';
import { useUser } from '../store/authStore';

interface DashboardStats {
  totalVideos: number;
  pendingJobs: number;
  pendingRequests: number;
  totalUsers: number;
}

interface PendingRequest {
  id: string;
  match_title: string;
  teams: string;
  vote_count: number;
  status: string;
  created_at: string;
}

export default function AdminDashboard() {
  const user = useUser();
  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    pendingJobs: 0,
    pendingRequests: 0,
    totalUsers: 0,
  });
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Static chart data
  const userGrowth = useMemo(() => [
    { month: "Jan", users: 120, videos: 45 },
    { month: "Feb", users: 145, videos: 52 },
    { month: "Mar", users: 168, videos: 61 },
    { month: "Apr", users: 192, videos: 78 },
    { month: "May", users: 218, videos: 89 },
    { month: "Jun", users: 245, videos: 102 },
    { month: "Jul", users: 284, videos: 156 },
  ], []);

  const requestsData = useMemo(() => [
    { name: "Pending", value: stats.pendingRequests || 5, color: "#F59E0B" },
    { name: "Approved", value: 12, color: "#10B981" },
    { name: "Rejected", value: 3, color: "#EF4444" },
    { name: "Completed", value: 25, color: "#3B82F6" },
  ], [stats.pendingRequests]);

  const statCards = useMemo(() => [
    { title: "Total Videos", value: stats.totalVideos.toString(), icon: "fas fa-video", color: "from-blue-500 to-cyan-500", change: "+8%" },
    { title: "Pending Jobs", value: stats.pendingJobs.toString(), icon: "fas fa-clock", color: "from-yellow-500 to-orange-500", change: "Processing" },
    { title: "Pending Requests", value: stats.pendingRequests.toString(), icon: "fas fa-inbox", color: "from-purple-500 to-pink-500", change: "Needs Review" },
    { title: "System Status", value: "99.9%", icon: "fas fa-server", color: "from-green-500 to-emerald-500", change: "Healthy" },
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

      const videosResponse = await videosApi.listAll({ page: 1, per_page: 1 });
      const requestsResponse = await requestsApi.adminDashboard(1, 10);
      
      setStats({
        totalVideos: videosResponse.data.total || 0,
        pendingJobs: 0,
        pendingRequests: requestsResponse.data.total || 0,
        totalUsers: 0,
      });
      
      setPendingRequests(requestsResponse.data.requests || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
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
        {/* User Growth Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-2 glass rounded-3xl p-6 border border-white/20 hover:border-white/30 transition-all duration-300"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
              <i className="fas fa-chart-line text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Platform Growth</p>
              <p className="text-sm text-white/60">Monthly users and video uploads</p>
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
                <Line type="monotone" dataKey="users" stroke="#3B82F6" strokeWidth={3} name="Users" />
                <Line type="monotone" dataKey="videos" stroke="#10B981" strokeWidth={3} name="Videos" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Request Status Pie */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass rounded-3xl p-6 border border-white/20 hover:border-white/30 transition-all duration-300"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <i className="fas fa-chart-pie text-white"></i>
            </div>
            <div>
              <p className="font-semibold">Request Status</p>
              <p className="text-sm text-white/60">Current distribution</p>
            </div>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={requestsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                >
                  {requestsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {requestsData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span>{item.name}</span>
                </div>
                <span className="text-white/60">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Pending Requests */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
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
    </div>
  );
}
