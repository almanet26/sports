import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useTheme } from '../components/providers/ThemeProvider';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'PLAYER' | 'COACH';
  documentType?: 'AADHAAR_CARD' | 'CV_RESUME' | 'DEGREE_CERTIFICATE';
  phone?: string;
  jerseyNumber?: number;
  team?: string;
  profileBio?: string;
  verificationFile?: File;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'PLAYER',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const inputClass = isDark
    ? 'bg-white/5 border-white/10 text-white placeholder-white/40 focus:border-blue-400 focus:bg-white/10'
    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white';
  const labelClass = isDark ? 'text-white/80' : 'text-slate-700';
  const helperClass = isDark ? 'text-white/60' : 'text-slate-600';
  const subtleClass = isDark ? 'text-white/40' : 'text-slate-400';

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
    if (!/[A-Z]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[a-z]/.test(formData.password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[0-9]/.test(formData.password)) {
      setError('Password must contain at least one digit');
      return;
    }

    if (formData.role === 'COACH') {
      if (!formData.documentType) {
        setError('Please select a verification document type');
        return;
      }

      if (!formData.verificationFile) {
        setError('Please upload your verification document');
        return;
      }
    }

    setLoading(true);

    try {
      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('email', formData.email);
      submitData.append('password', formData.password);
      submitData.append('role', formData.role);
      if (formData.phone) submitData.append('phone', formData.phone);
      if (formData.team) submitData.append('team', formData.team);
      if (formData.documentType) submitData.append('document_type', formData.documentType);
      if (formData.verificationFile) submitData.append('coach_document', formData.verificationFile);

      const response = await api.post('/auth/register', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('Registration successful:', response.data);

      // Redirect to login
      navigate('/login', { state: { message: 'Registration successful! Please log in.' } });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = axiosErr?.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Pydantic returns an array of validation errors
        setError(detail.map((d: { msg?: string }) => d.msg ?? String(d)).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred during registration');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-slate-200 px-4 py-8 text-slate-900 dark:from-[#070A14] dark:via-[#0A0F1C] dark:to-[#0D1117] dark:text-white">
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
        <div className="glass rounded-3xl border border-slate-200 p-8 shadow-2xl dark:border-white/20">
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
            <p className={`text-sm ${helperClass}`}>Join SportVision AI and start improving</p>
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
              <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                  className={`w-full rounded-xl border px-4 py-3 transition-all duration-300 focus:outline-none ${inputClass}`}
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <i className={`fas fa-user ${subtleClass}`}></i>
                </div>
              </div>
            </motion.div>

            {/* Email */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email"
                  className={`w-full rounded-xl border px-4 py-3 transition-all duration-300 focus:outline-none ${inputClass}`}
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <i className={`fas fa-envelope ${subtleClass}`}></i>
                </div>
              </div>
            </motion.div>

            {/* Role Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                I am a
              </label>
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setUploadedFileName('');
                    setFormData({
                      ...formData,
                      role: 'PLAYER',
                      documentType: undefined,
                      verificationFile: undefined,
                    });
                  }}
                  className={`px-4 py-3 rounded-xl border transition-all duration-300 ${formData.role === 'PLAYER'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 border-transparent text-white'
                    : isDark
                      ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
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
                    : isDark
                      ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
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
              <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 8 characters"
                  className={`w-full rounded-xl border px-4 py-3 pr-12 transition-all duration-300 focus:outline-none ${inputClass}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute inset-y-0 right-0 flex items-center pr-3 transition-colors ${isDark ? 'text-white/40 hover:text-white/70' : 'text-slate-400 hover:text-slate-700'}`}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </motion.div>

            {/* Confirm Password */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border px-4 py-3 pr-12 transition-all duration-300 focus:outline-none ${inputClass}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={`absolute inset-y-0 right-0 flex items-center pr-3 transition-colors ${isDark ? 'text-white/40 hover:text-white/70' : 'text-slate-400 hover:text-slate-700'}`}
                >
                  <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </motion.div>

            {/* Conditional Fields for Coach */}
            {formData.role === 'COACH' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                    Verification Document Type *
                  </label>
                  <select
                    value={formData.documentType || ''}
                    onChange={(e) => {
                      setUploadedFileName('');
                      setFormData({
                        ...formData,
                        documentType: e.target.value as RegisterFormData['documentType'],
                        verificationFile: undefined,
                      });
                    }}
                    className={`w-full rounded-xl border px-4 py-3 transition-all duration-300 focus:outline-none ${inputClass} ${isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900'}`}
                    required={formData.role === 'COACH'}
                  >
                    <option value="" className="bg-white text-slate-900">Select Document</option>
                    <option value="AADHAAR_CARD" className="bg-white text-slate-900">Aadhaar Card</option>
                    <option value="CV_RESUME" className="bg-white text-slate-900">CV / Resume</option>
                    <option value="DEGREE_CERTIFICATE" className="bg-white text-slate-900">Degree Certificate</option>
                  </select>
                </div>

                {formData.documentType && (
                  <div>
                    <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                    Verification Document *
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFormData({ ...formData, verificationFile: file });
                            setUploadedFileName(file.name);
                          } else {
                            setFormData({ ...formData, verificationFile: undefined });
                            setUploadedFileName('');
                          }
                        }}
                        className="hidden"
                        id="coach-document"
                        required={formData.role === 'COACH'}
                      />
                      <label
                        htmlFor="coach-document"
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300 ${
                          isDark
                            ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                        }`}
                      >
                        <i className={`fas fa-upload ${subtleClass}`}></i>
                        <span className="flex-1">
                          {uploadedFileName || 'Upload document'}
                        </span>
                        {uploadedFileName && (
                          <i className="fas fa-check-circle text-green-400"></i>
                        )}
                      </label>
                    </div>
                    <p className={`mt-1 text-xs ${subtleClass}`}>
                      Accepted formats: PDF, JPG, PNG, DOC, DOCX
                    </p>
                  </div>
                )}

                <div>
                  <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full rounded-xl border px-4 py-3 transition-all duration-300 focus:outline-none ${inputClass}`}
                    placeholder="+1234567890"
                  />
                </div>

                <div>
                  <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                    Team/Organization
                  </label>
                  <input
                    type="text"
                    value={formData.team || ''}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className={`w-full rounded-xl border px-4 py-3 transition-all duration-300 focus:outline-none ${inputClass}`}
                    placeholder="Team name"
                  />
                </div>
              </motion.div>
            )}

            {/* Conditional Fields for Player */}
            {formData.role === 'PLAYER' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-3"
              >
                <div>
                  <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                    Jersey #
                  </label>
                  <input
                    type="number"
                    value={formData.jerseyNumber || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, jerseyNumber: parseInt(e.target.value) || undefined })
                    }
                    className={`w-full rounded-xl border px-4 py-3 transition-all duration-300 focus:outline-none ${inputClass}`}
                    placeholder="7"
                  />
                </div>
                <div>
                  <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                    Team
                  </label>
                  <input
                    type="text"
                    value={formData.team || ''}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className={`w-full rounded-xl border px-4 py-3 transition-all duration-300 focus:outline-none ${inputClass}`}
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
            <p className={`text-sm ${helperClass}`}>
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
              className={`inline-flex items-center text-xs transition-colors ${isDark ? 'text-white/50 hover:text-white/70' : 'text-slate-500 hover:text-slate-700'}`}
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
