import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

interface Coach {
  id: string;
  name: string;
  email: string;
  phone?: string;
  team?: string;
  profile_bio?: string;
  specialization?: string[];
  coach_category?: string;
  coach_status: string;
  coach_document_url?: string;
  created_at: string;
}

export default function CoachVerificationPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingCoaches();
  }, []);

  const loadPendingCoaches = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/coaches/pending');
      setCoaches(res.data.coaches || []);
    } catch (error) {
      console.error('Failed to load coaches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (coachId: string) => {
    try {
      await api.post(`/admin/coaches/${coachId}/approve`);
      loadPendingCoaches();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to approve coach');
    }
  };

  const handleReject = async (coachId: string) => {
    if (!confirm('Are you sure you want to reject this coach?')) return;
    try {
      await api.post(`/admin/coaches/${coachId}/reject`);
      loadPendingCoaches();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to reject coach');
    }
  };

  const downloadDocument = async (coachId: string, coachName: string) => {
    try {
      const response = await api.get(`/admin/coaches/${coachId}/document`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${coachName}_document.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to download document');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold gradient-text mb-2">Coach Verification</h1>
        <p className="text-white/60">Review and approve pending coach applications</p>
      </motion.div>

      {coaches.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-white/20">
          <i className="fas fa-check-circle text-6xl text-green-400 mb-4"></i>
          <h2 className="text-2xl font-bold mb-2">All Caught Up!</h2>
          <p className="text-white/60">No pending coach verifications</p>
        </div>
      ) : (
        <div className="space-y-4">
          {coaches.map((coach, index) => (
            <motion.div
              key={coach.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl p-6 border border-white/20"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {coach.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{coach.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        Pending Review
                      </span>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-white/60 mb-3">
                    <p><i className="fas fa-envelope mr-2 text-white/30"></i>{coach.email}</p>
                    {coach.phone && <p><i className="fas fa-phone mr-2 text-white/30"></i>{coach.phone}</p>}
                    {coach.team && <p><i className="fas fa-users mr-2 text-white/30"></i>{coach.team}</p>}
                    {coach.coach_category && <p><i className="fas fa-layer-group mr-2 text-white/30"></i>{coach.coach_category}</p>}
                    <p><i className="fas fa-calendar mr-2 text-white/30"></i>Applied: {new Date(coach.created_at).toLocaleDateString()}</p>
                  </div>

                  {coach.specialization && coach.specialization.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {coach.specialization.map((s) => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">{s}</span>
                      ))}
                    </div>
                  )}

                  {coach.profile_bio && (
                    <p className="text-sm text-white/50 italic mb-3">"{coach.profile_bio}"</p>
                  )}

                  {coach.coach_document_url && (
                    <button
                      onClick={() => downloadDocument(coach.id, coach.name)}
                      className="text-blue-400 hover:text-blue-300 text-sm inline-flex items-center gap-2 transition-colors"
                    >
                      <i className="fas fa-file-download"></i>
                      Download Verification Document
                    </button>
                  )}
                </div>

                <div className="flex gap-3 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(coach.id)}
                    className="px-6 py-2 rounded-xl bg-green-500 hover:bg-green-600 transition-colors font-medium"
                  >
                    <i className="fas fa-check mr-2"></i>Approve
                  </button>
                  <button
                    onClick={() => handleReject(coach.id)}
                    className="px-6 py-2 rounded-xl bg-red-500 hover:bg-red-600 transition-colors font-medium"
                  >
                    <i className="fas fa-times mr-2"></i>Reject
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
