import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotNote, setForgotNote] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  
  // Get success message from registration
  const successMessage = location.state?.message;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      
      // Redirect based on role and coach_status
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'PLAYER') {
        navigate('/player');
      } else if (currentUser?.role === 'COACH') {
        if (currentUser.coach_status === 'incomplete') {
          navigate('/coach/setup');
        } else if (currentUser.coach_status === 'pending') {
          navigate('/coach-pending');
        } else {
          navigate('/coach');
        }
      } else if (currentUser?.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      const error = err as any;
      // Check if it's a coach pending verification error
      if (error?.response?.status === 403 && error?.response?.data?.detail?.includes('pending')) {
        navigate('/coach-pending');
        return;
      }
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070A14] via-[#0A0F1C] to-[#0D1117] text-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        {/* Main card */}
        <div className="glass rounded-3xl p-8 shadow-2xl border border-white/20">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 mb-4 pulse-glow">
              <i className="fas fa-cricket-bat-ball text-white text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold gradient-text mb-2">Welcome Back</h1>
            <p className="text-white/60 text-sm">Sign in to your PitchVision account</p>
          </motion.div>

          {/* Success Message */}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm"
            >
              <div className="flex items-center gap-2">
                <i className="fas fa-check-circle"></i>
                {successMessage}
              </div>
            </motion.div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
            >
              <div className="flex items-center gap-2">
                <i className="fas fa-exclamation-circle"></i>
                {error}
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="block text-sm font-medium text-white/80 mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-400 focus:bg-white/10 focus:outline-none transition-all duration-300"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <i className="fas fa-envelope text-white/30"></i>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className="block text-sm font-medium text-white/80 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-400 focus:bg-white/10 focus:outline-none transition-all duration-300"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/40 hover:text-white/70 transition-colors"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </motion.button>
          </form>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-center space-y-4"
          >
            <p className="text-sm text-white/60">
              Don't have an account?{" "}
              <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                Create one
              </Link>
            </p>
            <button
              onClick={() => { setShowForgot(true); setForgotMessage(''); setForgotNote(''); }}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Forgot password? Contact admin
            </button>
            <Link to="/" className="inline-flex items-center text-xs text-white/50 hover:text-white/70 transition-colors">
              <span className="mr-1">←</span>Back to Home
            </Link>
          </motion.div>
        </div>

        {/* Decorative elements */}
        <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7, duration: 0.5 }}
          className="absolute -top-6 -right-6 w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 blur-xl" />
        <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8, duration: 0.5 }}
          className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 blur-xl" />
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForgot(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-md glass rounded-3xl p-6 border border-white/20 text-white">
              <h3 className="text-xl font-bold mb-1">Forgot Password?</h3>
              <p className="text-white/60 text-sm mb-5">Submit a request and the admin will reset your password. Once reset, you'll receive a notification with your new password when you log in.</p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">Your Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-blue-400 focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Message (optional)</label>
                  <textarea
                    value={forgotNote}
                    onChange={e => setForgotNote(e.target.value)}
                    placeholder="Any additional info for the admin..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-blue-400 focus:outline-none text-sm resize-none"
                  />
                </div>
              </div>

              {forgotMessage && (
                <p className="mt-3 text-sm text-green-400 flex items-center gap-2">
                  <i className="fas fa-check-circle"></i>{forgotMessage}
                </p>
              )}

              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForgot(false)}
                  className="flex-1 py-2.5 rounded-xl glass border border-white/20 text-sm font-medium hover:bg-white/10 transition-all">
                  Cancel
                </button>
                <button
                  disabled={!forgotEmail || forgotLoading}
                  onClick={async () => {
                    setForgotLoading(true);
                    try {
                      const r = await api.post('/auth/forgot-password', { email: forgotEmail, message: forgotNote });
                      setForgotMessage(r.data.message);
                      setTimeout(() => setShowForgot(false), 2500);
                    } catch {
                      setForgotMessage('Failed to submit. Please try again.');
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-all">
                  {forgotLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
