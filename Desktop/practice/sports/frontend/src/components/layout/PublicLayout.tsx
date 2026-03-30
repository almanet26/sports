import React from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "../../store/authStore";

export const PublicLayout: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070A14] via-[#0A0F1C] to-[#0D1117] relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute w-64 h-64 rounded-full top-20 right-20 bg-gradient-to-r from-blue-500/5 to-purple-500/5 blur-3xl"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute rounded-full bottom-20 left-20 w-80 h-80 bg-gradient-to-r from-purple-500/5 to-pink-500/5 blur-3xl"
        />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b glass border-white/10">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600">
                <i className="text-white fas fa-cricket-bat-ball"></i>
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-bold text-white">SportVision</span>
                <p className="text-xs text-white/50">AI Analytics</p>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-2 sm:gap-4">
              <Link
                to="/library"
                className="px-3 py-2 text-sm transition-colors text-white/70 hover:text-white"
              >
                <i className="mr-2 fas fa-video"></i>
                <span className="hidden sm:inline">Library</span>
              </Link>

              {isAuthenticated && user ? (
                <>
                  <Link
                    to={user.role === 'ADMIN' ? '/admin' : user.role === 'COACH' ? '/coach' : '/player'}
                    className="px-3 py-2 text-sm transition-colors text-white/70 hover:text-white"
                  >
                    <i className="mr-2 fas fa-tachometer-alt"></i>
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm transition-all rounded-xl text-white/70 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <i className="fas fa-sign-out-alt"></i>
                  </motion.button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm transition-all rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                  >
                    Login
                  </Link>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Link
                      to="/register"
                      className="px-4 py-2 text-sm font-medium text-white transition-all rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                      Register
                    </Link>
                  </motion.div>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-4 pt-24 pb-8 mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <Outlet />
      </main>

      {/* Guest Banner */}
      {!isAuthenticated && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1 }}
          className="fixed bottom-0 left-0 right-0 z-40 border-t glass border-white/10"
        >
          <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 mx-auto max-w-7xl sm:flex-row">
            <p className="text-sm text-center text-white/70 sm:text-left">
              <i className="mr-2 text-blue-400 fas fa-info-circle"></i>
              You're browsing as a guest. Sign in for full access to all features.
            </p>
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium text-white transition-all rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-sm transition-all border rounded-lg border-white/20 text-white/70 hover:text-white hover:bg-white/10"
              >
                Register
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PublicLayout;
