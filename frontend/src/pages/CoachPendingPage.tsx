import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

export default function CoachPendingPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');

  const handleCheckStatus = async () => {
    setChecking(true);
    setMessage('');
    try {
      // Call API directly to get the absolute latest status from DB
      const response = await api.get('/auth/me');
      const freshUser = response.data;

      // Update BOTH localStorage keys and Zustand store
      localStorage.setItem('user_profile', JSON.stringify(freshUser));
      // Update the Zustand persist key directly so initializeAuthOnce also sees it
      const persisted = JSON.parse(localStorage.getItem('auth-storage') || '{}');
      persisted.state = { ...persisted.state, user: freshUser };
      localStorage.setItem('auth-storage', JSON.stringify(persisted));
      // Update in-memory store
      useAuthStore.setState({ user: freshUser });

      if (freshUser.coach_status === 'verified') {
        navigate('/coach', { replace: true });
      } else if (freshUser.coach_status === 'rejected') {
        setMessage('Your application has been rejected. Please contact support.');
      } else {
        setMessage('Still pending — check back later.');
      }
    } catch {
      setMessage('Could not reach server. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070A14] via-[#0A0F1C] to-[#0D1117] text-white flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, -100, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-40 -left-40 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -100, 0], y: [0, 100, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute -bottom-40 -right-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative w-full max-w-2xl"
      >
        <div className="glass rounded-3xl p-8 md:p-12 shadow-2xl border border-white/20 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-r from-yellow-500 to-orange-600 mb-6 pulse-glow"
          >
            <i className="fas fa-clock text-white text-4xl"></i>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl md:text-4xl font-bold gradient-text mb-4"
          >
            Account Pending Verification
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-white/70 text-lg mb-8 leading-relaxed"
          >
            Your coach profile has been submitted for review. Once the admin approves it, click <strong>Check Status</strong> to access your dashboard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-2xl p-6 border border-white/20 mb-8 text-left space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-info-circle text-blue-400"></i>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">What happens next?</p>
                <p className="text-sm text-white/60">Our admin team will review your submitted documents and credentials. This typically takes 24-48 hours.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <i className="fas fa-check-circle text-green-400"></i>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Once approved</p>
                <p className="text-sm text-white/60">Click "Check Status" below — no need to log in again. You'll be taken straight to your dashboard.</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 mb-8"
          >
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="font-semibold">Status: Pending Review</span>
          </motion.div>

          {message && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`mb-6 p-3 rounded-xl text-sm border ${
                message.includes('rejected')
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-white/5 border-white/10 text-white/60'
              }`}
            >
              {message}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {checking ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Checking...</>
              ) : (
                <><i className="fas fa-sync-alt"></i>Check Status</>
              )}
            </button>
            <button
              onClick={() => logout().then(() => navigate('/login'))}
              className="px-6 py-3 rounded-xl glass border border-white/20 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <i className="fas fa-sign-out-alt"></i>
              Sign Out
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
