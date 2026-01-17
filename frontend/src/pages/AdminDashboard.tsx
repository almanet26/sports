import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Video, Users, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';
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

  useEffect(() => {
    // STOP immediately if no user or not admin
    if (!user || user.role !== 'ADMIN') {
      setLoading(false);
      return;
    }

    // Verify token exists before fetching
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('No access token found in localStorage');
      setLoading(false);
      return;
    }

    fetchDashboardData();
    
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Verify token before making request
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.error('Cannot fetch dashboard data: No token found');
        return;
      }

      // Fetch ALL videos count (admin sees everything)
      const videosResponse = await videosApi.listAll({ page: 1, per_page: 1 });
      
      // Fetch pending requests (requires auth)
      const requestsResponse = await requestsApi.adminDashboard(1, 10);
      
      setStats({
        totalVideos: videosResponse.data.total || 0,
        pendingJobs: 0, // Would need jobs API endpoint
        pendingRequests: requestsResponse.data.total || 0,
        totalUsers: 0, // Would need users API endpoint
      });
      
      setPendingRequests(requestsResponse.data.requests || []);
    } catch (error: unknown) {
      // Log detailed error information
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 401) {
        console.error('Authentication failed (401) - Token may be invalid or expired');
        console.error('Token in localStorage:', localStorage.getItem('access_token') ? 'EXISTS' : 'MISSING');
      } else {
        console.error('Failed to fetch dashboard data:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'approved' | 'rejected') => {
    try {
      await requestsApi.updateStatus(requestId, action);
      // Refresh data
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to update request:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400">Manage your cricket highlight platform</p>
        </div>
        <Link
          to="/admin/upload"
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload to Public Library
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Video className="w-5 h-5" />}
          label="Public Videos"
          value={stats.totalVideos}
          color="emerald"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Pending Jobs"
          value={stats.pendingJobs}
          color="amber"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Pending Requests"
          value={stats.pendingRequests}
          color="blue"
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Total Users"
          value={stats.totalUsers}
          color="purple"
        />
      </div>

      {/* Pending Requests */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Match Requests (by Popularity)</h2>
        </div>
        <div className="divide-y divide-slate-700">
          {pendingRequests.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400">
              No pending requests
            </div>
          ) : (
            pendingRequests.map((request) => (
              <div key={request.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-white">{request.match_title}</h3>
                  <p className="text-sm text-slate-400">
                    {request.teams} • {request.vote_count} votes
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">
                    {request.vote_count} votes
                  </span>
                  <button
                    onClick={() => handleRequestAction(request.id, 'approved')}
                    className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                    title="Approve"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleRequestAction(request.id, 'rejected')}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Reject"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickActionCard
          to="/admin/upload"
          icon={<Upload className="w-6 h-6" />}
          title="Upload Video"
          description="Add a new match to the public library"
        />
        <QuickActionCard
          to="/highlights"
          icon={<Video className="w-6 h-6" />}
          title="View Library"
          description="Browse all public highlights"
        />
        <QuickActionCard
          to="/admin/requests"
          icon={<TrendingUp className="w-6 h-6" />}
          title="All Requests"
          description="View and manage all match requests"
        />
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'emerald' | 'amber' | 'blue' | 'purple';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    blue: 'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

// Quick Action Card Component
function QuickActionCard({ to, icon, title, description }: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="block p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-colors group"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-slate-700 text-slate-300 group-hover:text-emerald-400 transition-colors">
          {icon}
        </div>
        <h3 className="font-medium text-white">{title}</h3>
      </div>
      <p className="text-sm text-slate-400">{description}</p>
    </Link>
  );
}
