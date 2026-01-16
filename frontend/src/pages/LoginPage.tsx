import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

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
  
  // Get success message from registration
  const successMessage = location.state?.message;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      
      // Redirect based on role (user is updated by the store)
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'PLAYER') {
        navigate('/player');
      } else if (currentUser?.role === 'COACH') {
        navigate('/coach');
      } else if (currentUser?.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-slate-400">Log in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg p-8">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/50 rounded text-emerald-400 text-sm">
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                placeholder="your.email@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                placeholder="Enter your password"
              />
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-emerald-500 hover:text-emerald-400"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-emerald-500 hover:text-emerald-400 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
