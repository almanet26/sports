import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

interface PendingCoach {
  id: string;
  name: string;
  email: string;
  phone?: string;
  team?: string;
  coach_status: string;
  coach_document_url?: string;
  created_at: string;
}

export default function AdminCoachApprovalPage() {
  const [pendingCoaches, setPendingCoaches] = useState<PendingCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingCoaches();
  }, []);

  const fetchPendingCoaches = async () => {
    try {
      const response = await api.get('/admin/coaches/pending');
      setPendingCoaches(response.data.coaches || []);
    } catch (error) {
      console.error('Failed to fetch pending coaches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (coachId: string) => {
    if (!confirm('Are you sure you want to approve this coach?')) return;

    setProcessing(coachId);
    try {
      await api.post(`/admin/coaches/${coachId}/approve`);
      setPendingCoaches(pendingCoaches.filter(c => c.id !== coachId));
      alert('Coach approved successfully!');
    } catch (error) {
      console.error('Failed to approve coach:', error);
      alert('Failed to approve coach. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (coachId: string) => {
    if (!confirm('Are you sure you want to reject this coach application?')) return;

    setProcessing(coachId);
    try {
      await api.post(`/admin/coaches/${coachId}/reject`);
      setPendingCoaches(pendingCoaches.filter(c => c.id !== coachId));
      alert('Coach application rejected.');
    } catch (error) {
      console.error('Failed to reject coach:', error);
      alert('Failed to reject coach. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="text-white space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 border border-white/20"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center">
            <i className="fas fa-user-check text-white text-2xl"></i>
          </div>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Coach Approvals</h1>
            <p className="text-white/70 mt-1">Review and approve pending coach applications</p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <i className="fas fa-clock text-yellow-400"></i>
            </div>
            <p className="text-sm text-white/60">Pending</p>
          </div>
          <p className="text-3xl font-bold">{pendingCoaches.length}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <i className="fas fa-check text-green-400"></i>
            </div>
            <p className="text-sm text-white/60">Approved Today</p>
          </div>
          <p className="text-3xl font-bold">0</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-6 border border-white/20"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <i className="fas fa-times text-red-400"></i>
            </div>
            <p className="text-sm text-white/60">Rejected Today</p>
          </div>
          <p className="text-3xl font-bold">0</p>
        </motion.div>
      </div>

      {/* Pending Coaches List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-3xl p-6 border border-white/20"
      >
        <h2 className="text-xl font-bold mb-6">Pending Applications</h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white/60">Loading applications...</p>
          </div>
        ) : pendingCoaches.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-check-circle text-4xl text-green-400 mb-4"></i>
            <p className="text-white/60">No pending applications</p>
            <p className="text-sm text-white/40 mt-1">All coach applications have been reviewed</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingCoaches.map((coach, index) => (
              <motion.div
                key={coach.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Coach Info */}
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      {coach.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{coach.name}</h3>
                      <div className="space-y-1 text-sm text-white/60">
                        <p className="flex items-center gap-2">
                          <i className="fas fa-envelope w-4"></i>
                          {coach.email}
                        </p>
                        {coach.phone && (
                          <p className="flex items-center gap-2">
                            <i className="fas fa-phone w-4"></i>
                            {coach.phone}
                          </p>
                        )}
                        {coach.team && (
                          <p className="flex items-center gap-2">
                            <i className="fas fa-users w-4"></i>
                            {coach.team}
                          </p>
                        )}
                        <p className="flex items-center gap-2">
                          <i className="fas fa-calendar w-4"></i>
                          Applied: {new Date(coach.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {coach.coach_document_url && (
                      <a
                        href={`http://localhost:8000${coach.coach_document_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl glass border border-white/20 hover:bg-white/10 transition-all duration-300 text-sm flex items-center justify-center gap-2"
                      >
                        <i className="fas fa-file-alt"></i>
                        View Document
                      </a>
                    )}
                    <button
                      onClick={() => handleApprove(coach.id)}
                      disabled={processing === coach.id}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all duration-300 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="fas fa-check"></i>
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(coach.id)}
                      disabled={processing === coach.id}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-300 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className="fas fa-times"></i>
                      Reject
                    </button>
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
