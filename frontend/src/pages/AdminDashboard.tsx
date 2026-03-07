import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

interface Coach {
  id: string;
  name: string;
  email: string;
  created_at: string;
  coach_verification_status: string;
  coach_document_path?: string;
}

export default function AdminDashboard() {
  const [pendingCoaches, setPendingCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingCoaches();
  }, []);

  const loadPendingCoaches = async () => {
    try {
      const res = await api.get('/admin/coaches/pending');
      setPendingCoaches(res.data);
    } catch (error) {
      console.error('Failed to load coaches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (coachId: string, status: string) => {
    const notes = status === 'REJECTED' ? prompt('Rejection reason (optional):') : '';
    
    try {
      const formData = new FormData();
      formData.append('status', status);
      if (notes) formData.append('notes', notes);

      await api.post(`/admin/coaches/${coachId}/verify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      await loadPendingCoaches();
      alert(`Coach ${status.toLowerCase()} successfully!`);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Verification failed');
    }
  };

  const downloadDocument = async (coachId: string, coachName: string) => {
    try {
      const response = await api.get(`/admin/coaches/${coachId}/document`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${coachName}_document.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to download document');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold gradient-text mb-2">Admin Dashboard</h1>
        <p className="text-white/60">Manage coach verifications</p>
      </motion.div>

      {pendingCoaches.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-white/20">
          <i className="fas fa-check-circle text-6xl text-green-400 mb-4"></i>
          <h2 className="text-2xl font-bold mb-2">All Caught Up!</h2>
          <p className="text-white/60">No pending coach verifications</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingCoaches.map((coach, index) => (
            <motion.div
              key={coach.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl p-6 border border-white/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">{coach.name}</h3>
                  <p className="text-white/60 text-sm">{coach.email}</p>
                  <p className="text-white/40 text-xs mt-1">
                    Applied: {new Date(coach.created_at).toLocaleDateString()}
                  </p>
                  {coach.coach_document_path && (
                    <button
                      onClick={() => downloadDocument(coach.id, coach.name)}
                      className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-flex items-center gap-2 transition-colors"
                    >
                      <i className="fas fa-file-download"></i>
                      Download Document
                    </button>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => handleVerification(coach.id, 'APPROVED')}
                    className="px-6 py-2 rounded-xl bg-green-500 hover:bg-green-600 transition-colors"
                  >
                    <i className="fas fa-check mr-2"></i>
                    Approve
                  </button>
                  <button
                    onClick={() => handleVerification(coach.id, 'REJECTED')}
                    className="px-6 py-2 rounded-xl bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    <i className="fas fa-times mr-2"></i>
                    Reject
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
