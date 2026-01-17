/**
 * Requests Page
 * 
 * Allows users to submit match requests and vote on existing requests.
 * Admins can approve/reject requests.
 */

import { useEffect, useState } from 'react';
import { 
  ThumbsUp, 
  ThumbsDown, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle,
  Loader2,
  Send
} from 'lucide-react';
import { requestsApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface MatchRequest {
  id: string;
  youtube_url: string;
  match_title?: string;
  match_description?: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed';
  upvotes: number;
  downvotes: number;
  user_vote?: 'up' | 'down' | null;
  created_at: string;
}

export default function RequestsPage() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<MatchRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    youtube_url: '',
    match_title: '',
    match_description: '',
  });

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await requestsApi.list();
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.youtube_url.trim()) return;

    setSubmitting(true);
    try {
      await requestsApi.create(formData);
      setFormData({ youtube_url: '', match_title: '', match_description: '' });
      setShowForm(false);
      fetchRequests();
    } catch (error) {
      console.error('Failed to submit request:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (requestId: string, voteType: 'up' | 'down') => {
    try {
      await requestsApi.vote(requestId, voteType);
      // Optimistically update the UI
      setRequests((prev) =>
        prev.map((req) => {
          if (req.id !== requestId) return req;
          
          const wasUpvoted = req.user_vote === 'up';
          const wasDownvoted = req.user_vote === 'down';
          
          let upvotes = req.upvotes;
          let downvotes = req.downvotes;
          let newVote: 'up' | 'down' | null = voteType;
          
          // Toggle logic
          if (voteType === 'up') {
            if (wasUpvoted) {
              upvotes--;
              newVote = null;
            } else {
              upvotes++;
              if (wasDownvoted) downvotes--;
            }
          } else {
            if (wasDownvoted) {
              downvotes--;
              newVote = null;
            } else {
              downvotes++;
              if (wasUpvoted) upvotes--;
            }
          }
          
          return { ...req, upvotes, downvotes, user_vote: newVote };
        })
      );
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await requestsApi.approve(requestId);
      setRequests((prev) =>
        prev.map((req) =>
          req.id === requestId ? { ...req, status: 'approved' as const } : req
        )
      );
    } catch (error) {
      console.error('Failed to approve request:', error);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await requestsApi.reject(requestId);
      setRequests((prev) =>
        prev.map((req) =>
          req.id === requestId ? { ...req, status: 'rejected' as const } : req
        )
      );
    } catch (error) {
      console.error('Failed to reject request:', error);
    }
  };

  const getStatusBadge = (status: MatchRequest['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs">
            <CheckCircle className="w-3 h-3" />
            Completed
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Match Requests</h1>
          <p className="text-slate-400">
            Request matches to be processed and vote on community submissions
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Request
        </button>
      </div>

      {/* New Request Form */}
      {showForm && (
        <form
          onSubmit={handleSubmitRequest}
          className="bg-slate-800/50 rounded-xl border border-slate-700 p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Submit New Request</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                YouTube URL *
              </label>
              <input
                type="url"
                value={formData.youtube_url}
                onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
                required
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Match Title
              </label>
              <input
                type="text"
                value={formData.match_title}
                onChange={(e) => setFormData({ ...formData, match_title: e.target.value })}
                placeholder="e.g., IND vs AUS - World Cup Final 2023"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.match_description}
                onChange={(e) => setFormData({ ...formData, match_description: e.target.value })}
                placeholder="Any additional details about the match..."
                rows={3}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit Request
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Requests List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
            <p className="text-slate-400">No requests yet. Be the first to submit one!</p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Vote Buttons */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => handleVote(request.id, 'up')}
                    className={`p-2 rounded-lg transition-colors ${
                      request.user_vote === 'up'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <ThumbsUp className="w-5 h-5" />
                  </button>
                  <span className="text-lg font-semibold text-white">
                    {(request.upvotes || 0) - (request.downvotes || 0)}
                  </span>
                  <button
                    onClick={() => handleVote(request.id, 'down')}
                    className={`p-2 rounded-lg transition-colors ${
                      request.user_vote === 'down'
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <ThumbsDown className="w-5 h-5" />
                  </button>
                </div>

                {/* Request Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        {request.match_title || 'Untitled Match'}
                      </h3>
                      <a
                        href={request.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-emerald-400 hover:underline truncate block max-w-md"
                      >
                        {request.youtube_url}
                      </a>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  {request.match_description && (
                    <p className="mt-2 text-slate-400 text-sm">
                      {request.match_description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                    <span>Requested {formatDate(request.created_at)}</span>
                    <span>•</span>
                    <span>{request.upvotes || 0} upvotes</span>
                  </div>

                  {/* Admin Actions */}
                  {isAdmin && request.status === 'pending' && (
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={() => handleApprove(request.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
