import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'PLAYER' | 'COACH';
  phone?: string;
  jerseyNumber?: number;
  team?: string;
  profileBio?: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'PLAYER',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        //phone: formData.phone || null,
        jersey_number: formData.jerseyNumber || null,
        team: formData.team || null,
        phone: formData.phone || null,
        jersey_number: formData.jerseyNumber || null,
        team: formData.team || null,
        profile_bio: formData.profileBio || null,
      });

      console.log('Registration successful:', response.data);

      // Redirect to login
      navigate('/login', { state: { message: 'Registration successful! Please log in.' } });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred during registration');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070A14] via-[#0A0F1C] to-[#0D1117] text-white flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl"
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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-green-500 to-blue-600 mb-4 pulse-glow">
              <i className="fas fa-user-plus text-white text-2xl"></i>
            </div>
            <h1 className="text-2xl font-bold gradient-text mb-2">Create Account</h1>
            <p className="text-white/60 text-sm">Join SportVision AI and start improving</p>
          </motion.div>

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

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="block text-sm font-medium text-white/80 mb-2">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-400 focus:bg-white/10 focus:outline-none transition-all duration-300"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <i className="fas fa-user text-white/30"></i>
                </div>
              </div>
            </motion.div>

            {/* Email */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
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

            {/* Role Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <label className="block text-sm font-medium text-white/80 mb-2">
                I am a
              </label>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFormData({ ...formData, role: 'PLAYER' })}
                  className={`px-4 py-3 rounded-xl border transition-all duration-300 ${formData.role === 'PLAYER'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-transparent text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                    }`}

                >
                  <i className="fas fa-running mr-2"></i>
                  Player
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFormData({ ...formData, role: 'COACH' })}
                  className={`px-4 py-3 rounded-xl border transition-all duration-300 ${formData.role === 'COACH'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-transparent text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                    }`}
                >
                  <i className="fas fa-chalkboard-teacher mr-2"></i>
                  Coach
                </motion.button>
              </div>
            </motion.div>

            {/* Password */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <label className="block text-sm font-medium text-white/80 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 8 characters"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-400 focus:bg-white/10 focus:outline-none transition-all duration-300"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <i className="fas fa-lock text-white/30"></i>
                </div>
              </div>
            </motion.div>

            {/* Confirm Password */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <label className="block text-sm font-medium text-white/80 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-400 focus:bg-white/10 focus:outline-none transition-all duration-300"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <i className="fas fa-shield-alt text-white/30"></i>
                </div>
              </div>
            </motion.div>

            {/* Conditional Fields for Player */}
            {formData.role === 'PLAYER' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-3"
              >
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Jersey #
                  </label>
                  <input
                    type="number"
                    value={formData.jerseyNumber || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, jerseyNumber: parseInt(e.target.value) || undefined })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-400 focus:bg-white/10 focus:outline-none transition-all duration-300"
                    placeholder="7"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Team
                  </label>
                  <input
                    type="text"
                    value={formData.team || ''}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-400 focus:bg-white/10 focus:outline-none transition-all duration-300"
                    placeholder="Team name"
                  />
                </div>
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Creating Account...
                </div>
              ) : (
                "Create Account"
              )}
            </motion.button>
          </form>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-8 text-center space-y-4"
          >
            <p className="text-sm text-white/60">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>

            <Link
              to="/"
              className="inline-flex items-center text-xs text-white/50 hover:text-white/70 transition-colors"
            >
              <span className="mr-1">←</span>
              Back to Home
            </Link>
          </motion.div>
        </div>

        {/* Decorative elements */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="absolute -top-6 -left-6 w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-blue-600 blur-xl"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
          className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 blur-xl"
        />
      </motion.div>
    </div>
  );
}
