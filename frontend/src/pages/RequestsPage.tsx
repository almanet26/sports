/**
 * Requests Page
 * 
 * Allows users to submit match requests and vote on existing requests.
 * Admins can approve/reject requests.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
        prev.map((req) => (req.id === requestId ? { ...req, status: 'approved' as const } : req))
      );
    } catch (error) {
      console.error('Failed to approve request:', error);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await requestsApi.reject(requestId);
      setRequests((prev) =>
        prev.map((req) => (req.id === requestId ? { ...req, status: 'rejected' as const } : req))
      );
    } catch (error) {
      console.error('Failed to reject request:', error);
    }
  };

  const getStatusBadge = (status: MatchRequest['status']) => {
    const badges = {
      pending: { icon: 'fas fa-clock', color: 'bg-yellow-500/20 text-yellow-400', label: 'Pending' },
      approved: { icon: 'fas fa-check-circle', color: 'bg-green-500/20 text-green-400', label: 'Approved' },
      rejected: { icon: 'fas fa-times-circle', color: 'bg-red-500/20 text-red-400', label: 'Rejected' },
      processing: { icon: 'fas fa-spinner animate-spin', color: 'bg-blue-500/20 text-blue-400', label: 'Processing' },
      completed: { icon: 'fas fa-check-circle', color: 'bg-green-500/20 text-green-400', label: 'Completed' },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`flex items-center gap-1 px-2 py-1 ${badge.color} rounded-full text-xs`}>
        <i className={badge.icon}></i>
        {badge.label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

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
              <i className="fas fa-inbox text-purple-400"></i>
              Match Requests
            </h1>
            <p className="text-white/70 mt-2 text-sm">
              Request matches to be processed and vote on community submissions
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 text-sm font-semibold flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            New Request
          </motion.button>
        </div>
      </motion.div>

      {/* New Request Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmitRequest}
            className="glass rounded-3xl border border-white/20 p-6 mb-8 overflow-hidden"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <i className="fas fa-paper-plane text-blue-400"></i>
              Submit New Request
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">YouTube URL *</label>
                <input
                  type="url"
                  value={formData.youtube_url}
                  onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=..."
                  required
                  className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 bg-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Match Title</label>
                <input
                  type="text"
                  value={formData.match_title}
                  onChange={(e) => setFormData({ ...formData, match_title: e.target.value })}
                  placeholder="e.g., IND vs AUS - World Cup Final 2023"
                  className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 bg-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Description</label>
                <textarea
                  value={formData.match_description}
                  onChange={(e) => setFormData({ ...formData, match_description: e.target.value })}
                  placeholder="Any additional details about the match..."
                  rows={3}
                  className="w-full px-4 py-3 glass border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 bg-transparent resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl transition-all font-semibold"
                >
                  {submitting ? (
                    <i className="fas fa-spinner animate-spin"></i>
                  ) : (
                    <i className="fas fa-paper-plane"></i>
                  )}
                  Submit Request
                </motion.button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Requests List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : requests.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 glass rounded-3xl border border-white/20"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <i className="fas fa-inbox text-2xl text-white/40"></i>
            </div>
            <p className="text-white/60">No requests yet. Be the first to submit one!</p>
          </motion.div>
        ) : (
          requests.map((request, i) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="glass rounded-2xl border border-white/20 p-5 hover:border-white/30 transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Vote Buttons */}
                <div className="flex flex-col items-center gap-1">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleVote(request.id, 'up')}
                    className={`p-2 rounded-lg transition-all ${
                      request.user_vote === 'up'
                        ? 'bg-green-500/20 text-green-400'
                        : 'text-white/40 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <i className="fas fa-thumbs-up text-lg"></i>
                  </motion.button>
                  <span className="text-lg font-semibold text-white">
                    {(request.upvotes || 0) - (request.downvotes || 0)}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleVote(request.id, 'down')}
                    className={`p-2 rounded-lg transition-all ${
                      request.user_vote === 'down'
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-white/40 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <i className="fas fa-thumbs-down text-lg"></i>
                  </motion.button>
                </div>

                {/* Request Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        {request.match_title || 'Untitled Match'}
                      </h3>
                      <a
                        href={request.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 hover:underline truncate block max-w-md"
                      >
                        <i className="fab fa-youtube mr-1"></i>
                        {request.youtube_url}
                      </a>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  {request.match_description && (
                    <p className="mt-2 text-white/60 text-sm">{request.match_description}</p>
                  )}

                  <div className="mt-3 flex items-center gap-4 text-sm text-white/50">
                    <span>
                      <i className="fas fa-calendar-alt mr-1"></i>
                      {formatDate(request.created_at)}
                    </span>
                    <span>•</span>
                    <span>
                      <i className="fas fa-thumbs-up mr-1"></i>
                      {request.upvotes || 0} upvotes
                    </span>
                  </div>

                  {/* Admin Actions */}
                  {isAdmin && request.status === 'pending' && (
                    <div className="mt-4 flex items-center gap-3">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleApprove(request.id)}
                        className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm rounded-lg transition-all"
                      >
                        <i className="fas fa-check"></i>
                        Approve
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleReject(request.id)}
                        className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm rounded-lg transition-all"
                      >
                        <i className="fas fa-times"></i>
                        Reject
                      </motion.button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
