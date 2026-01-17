import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Video,
  MessageSquare,
  Target
} from 'lucide-react';
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

  useEffect(() => {
    fetchRecentVideos();
    fetchMyRequests();
  }, []);

  const fetchRecentVideos = async () => {
    try {
      const response = await videosApi.listPublic({ page: 1, per_page: 3 });
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
      // Filter to show only user's own requests (or show all if API returns user-specific)
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
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
            <Clock size={12} /> Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
            <CheckCircle size={12} /> Approved
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
            <Loader2 size={12} className="animate-spin" /> Processing
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
            <CheckCircle size={12} /> Completed
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
            <XCircle size={12} /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Welcome back!</h1>
        <p className="text-slate-400 mt-1">
          {user?.email ? `Signed in as ${user.email}` : 'Your cricket highlights dashboard'}
        </p>
      </div>

      {/* Quick Actions */}
      <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target size={20} className="text-emerald-400" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Request a Match */}
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 rounded-xl text-white transition-all transform hover:scale-[1.02] shadow-lg"
          >
            <div className="p-3 bg-white/20 rounded-lg">
              <Plus size={24} />
            </div>
            <div className="text-left">
              <div className="font-semibold">Request a Match</div>
              <div className="text-sm text-emerald-100">Submit a YouTube URL for highlights</div>
            </div>
          </button>

          {/* Browse Library */}
          <Link
            to="/library"
            className="flex items-center gap-4 p-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-white transition-all"
          >
            <div className="p-3 bg-slate-600 rounded-lg">
              <Video size={24} />
            </div>
            <div className="text-left">
              <div className="font-semibold">Browse Library</div>
              <div className="text-sm text-slate-300">View all public highlights</div>
            </div>
          </Link>

          {/* View Requests */}
          <Link
            to="/requests"
            className="flex items-center gap-4 p-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-white transition-all"
          >
            <div className="p-3 bg-slate-600 rounded-lg">
              <MessageSquare size={24} />
            </div>
            <div className="text-left">
              <div className="font-semibold">View Requests</div>
              <div className="text-sm text-slate-300">Vote on match requests</div>
            </div>
          </Link>
        </div>
      </section>

      {/* Recent Highlights */}
      <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Play size={20} className="text-emerald-400" />
            Recent Highlights
          </h2>
          <Link to="/library" className="text-sm text-emerald-400 hover:text-emerald-300">
            View all →
          </Link>
        </div>

        {loadingVideos ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-700/50 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-slate-600 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-600 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : recentVideos.length === 0 ? (
          <div className="text-center py-8">
            <Video className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No highlights available yet</p>
            <p className="text-sm text-slate-500 mt-1">Request a match to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentVideos.map((video) => (
              <Link
                key={video.id}
                to={`/video/${video.id}`}
                className="bg-slate-700/50 hover:bg-slate-700 rounded-lg p-4 transition-colors group"
              >
                <h3 className="font-medium text-white group-hover:text-emerald-400 truncate">
                  {video.title}
                </h3>
                {video.teams && (
                  <p className="text-sm text-slate-400 mt-1">{video.teams}</p>
                )}
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                  <span className="text-blue-400">{video.total_fours} 4s</span>
                  <span className="text-emerald-400">{video.total_sixes} 6s</span>
                  <span className="text-red-400">{video.total_wickets} W</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* My Requests */}
      <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <MessageSquare size={20} className="text-emerald-400" />
            My Requests
          </h2>
          <Link to="/requests" className="text-sm text-emerald-400 hover:text-emerald-300">
            View all →
          </Link>
        </div>

        {loadingRequests ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-700/50 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-slate-600 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-slate-600 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        ) : myRequests.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No requests yet</p>
            <button
              onClick={() => setShowRequestModal(true)}
              className="mt-3 text-sm text-emerald-400 hover:text-emerald-300"
            >
              Submit your first request →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="pb-3 font-medium">Match</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Votes</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {myRequests.slice(0, 5).map((request) => (
                  <tr key={request.id} className="text-sm">
                    <td className="py-3">
                      <span className="text-white">
                        {request.match_title || 'Untitled Match'}
                      </span>
                    </td>
                    <td className="py-3">
                      {getStatusBadge(request.status)}
                    </td>
                    <td className="py-3 text-slate-400">
                      {request.upvotes} votes
                    </td>
                    <td className="py-3 text-slate-400">
                      {formatDate(request.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Request Match Modal */}
      <RequestMatchModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSuccess={handleRequestSubmitted}
      />
    </div>
  );
}
