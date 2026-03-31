import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import { useThemeStore } from "../../store/themeStore";


// Navigation items configuration
interface NavItem {
  to: string;
  icon: string;
  label: string;
}

console.log("DashboardLayout rendered");

// Role-specific dashboard items
const dashboardItems: Record<string, NavItem[]> = {
  PLAYER: [
    { to: "/player", icon: "fas fa-home", label: "Dashboard" },
    { to: "/player/bowling", icon: "fas fa-bowling-ball", label: "Bowling" },
    { to: "/player/batting", icon: "fas fa-baseball-bat-ball", label: "Batting" },
    { to: "/player/submissions", icon: "fas fa-paper-plane", label: "Submissions" },
    { to: "/player/subscription", icon: "fas fa-star", label: "Subscription" },
    { to: "/library", icon: "fas fa-video", label: "Library" },
    { to: "/requests", icon: "fas fa-comment-dots", label: "Requests" },
    { to: "/stats", icon: "fas fa-chart-bar", label: "Stats" },
    { to: "/matches", icon: "fas fa-calendar", label: "Matches" },
    { to: "/notifications", icon: "fas fa-bell", label: "Notifications" },
    { to: "/settings", icon: "fas fa-cog", label: "Settings" },
  ],
  COACH: [
    { to: "/coach", icon: "fas fa-home", label: "Dashboard" },
    { to: "/settings", icon: "fas fa-user-circle", label: "My Profile" },
    { to: "/coach/players", icon: "fas fa-users", label: "My Players" },
    { to: "/coach/submissions", icon: "fas fa-inbox", label: "Video Reviews" },
    { to: "/coach/sessions", icon: "fas fa-calendar-alt", label: "Sessions" },
    { to: "/coach/availability", icon: "fas fa-clock", label: "Availability" },
    { to: "/coach/training-plans", icon: "fas fa-book-open", label: "Training Plans" },
    { to: "/coach/inbox", icon: "fas fa-envelope", label: "Inbox" },
    { to: "/coach/analytics", icon: "fas fa-chart-line", label: "Analytics" },
    { to: "/coach/reviews", icon: "fas fa-star", label: "Reviews" },
    { to: "/coach/earnings", icon: "fas fa-dollar-sign", label: "Earnings" },
    { to: "/coach/content", icon: "fas fa-bullhorn", label: "My Content" },
    { to: "/coach/settings", icon: "fas fa-cog", label: "Settings" },
  ],
 ADMIN: [
  { to: "/admin", icon: "fas fa-home", label: "Dashboard" },
  { to: "/admin/upload", icon: "fas fa-cloud-upload-alt", label: "Upload" },
  { to: "/admin/coaches", icon: "fas fa-user-check", label: "Coach Approvals" },
  { to: "/admin/plans", icon: "fas fa-tags", label: "Plans" },
  { to: "/library", icon: "fas fa-video", label: "Library" },
  { to: "/requests", icon: "fas fa-comment-dots", label: "Requests" },
  { to: "/settings", icon: "fas fa-cog", label: "Settings" },
],
};

interface DashboardLayoutProps {
  children?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    document.body.className = theme === 'light' ? 'light-theme' : '';
  }, [theme]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Get role-specific navigation items
  const navItems = dashboardItems[user?.role || 'PLAYER'] || dashboardItems.PLAYER;

  const getRoleBadge = () => {
    switch (user?.role) {
      case "ADMIN":
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 text-xs rounded-full border border-red-500/30">
            <i className="fas fa-shield-alt text-[10px]"></i>
            Admin
          </span>
        );
      case "COACH":
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
            <i className="fas fa-chalkboard-teacher text-[10px]"></i>
            Coach
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
            <i className="fas fa-running text-[10px]"></i>
            Player
          </span>
        );
    }
  };

  return (
    <div className={`min-h-screen relative overflow-hidden ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-[#070A14] via-[#0A0F1C] to-[#0D1117] text-white'
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900'
    }`}>
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute top-20 right-20 w-64 h-64 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-20 left-20 w-80 h-80 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-full blur-3xl"
        />
      </div>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src="/logo.webp" alt="PitchVision" className="w-14 h-14 rounded-xl object-contain" />
            <span className="font-bold text-xl text-white">PitchVision</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-10 h-10 rounded-xl glass border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-all"
          >
            <i className={`fas ${sidebarOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </motion.button>
        </div>
      </header>

      {/* Desktop Sidebar - Always Visible */}
      <aside className={`hidden lg:block fixed top-0 left-0 z-40 h-screen w-72 border-r ${
        theme === 'dark' 
          ? 'glass border-white/10' 
          : 'bg-white border-gray-200 shadow-xl'
      }`}>
          <div className="h-full flex flex-col">
            {/* Logo */}
            <div className={`flex items-center gap-3 p-6 border-b ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <img src="/logo.webp" alt="PitchVision" className="w-14 h-14 rounded-xl object-contain" />
              <div>
                <span className={`font-bold text-lg ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>PitchVision</span>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-white/50' : 'text-gray-500'
                }`}>AI Analytics</p>
              </div>
            </div>

            {/* User Info */}
            <div className={`p-4 border-b ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className={`rounded-2xl p-4 border cursor-pointer ${
                  theme === 'dark' 
                    ? 'glass border-white/10' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {user?.email || "User"}
                    </p>
                    <div className="mt-1">
                      {getRoleBadge()}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {navItems.map((item, index) => (
                <motion.div
                  key={item.to}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <NavLink
                    to={item.to}
                    end={item.label === "Dashboard"}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group border ${
                        theme === 'dark'
                          ? isActive
                            ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border-white/20"
                            : "text-white/60 hover:text-white hover:bg-white/5 border-transparent"
                          : isActive
                            ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-600 border-blue-200"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-transparent"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
                          theme === 'dark'
                            ? isActive 
                              ? 'bg-gradient-to-r from-blue-500 to-purple-600' 
                              : 'bg-white/10 group-hover:bg-white/20'
                            : isActive
                              ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                              : 'bg-gray-200 group-hover:bg-gray-300'
                        }`}>
                          <i className={`${item.icon} text-sm ${
                            isActive ? 'text-white' : theme === 'dark' ? 'text-white/60 group-hover:text-white' : 'text-gray-600 group-hover:text-gray-900'
                          }`}></i>
                        </div>
                        <span className="font-medium">{item.label}</span>
                        {isActive && (
                          <motion.div
                            layoutId="activeIndicator"
                            className="ml-auto w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-500"
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                </motion.div>
              ))}
            </nav>

            {/* Theme Toggle */}
            <div className={`p-4 border-t ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={toggleTheme}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                  theme === 'dark'
                    ? 'text-white/60 hover:text-yellow-400 hover:bg-yellow-500/10'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  theme === 'dark'
                    ? 'bg-white/10 group-hover:bg-yellow-500/20'
                    : 'bg-gray-200 group-hover:bg-blue-100'
                }`}>
                  <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-sm`}></i>
                </div>
                <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </motion.button>
            </div>

            {/* Logout */}
            <div className={`p-4 border-t ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                  theme === 'dark'
                    ? 'text-white/60 hover:text-red-400 hover:bg-red-500/10'
                    : 'text-gray-700 hover:text-red-600 hover:bg-red-50'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
                  theme === 'dark'
                    ? 'bg-white/10 group-hover:bg-red-500/20'
                    : 'bg-gray-200 group-hover:bg-red-100'
                }`}>
                  <i className="fas fa-sign-out-alt text-sm"></i>
                </div>
                <span className="font-medium">Log out</span>
              </motion.button>
            </div>
          </div>
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            />

            {/* Mobile Sidebar */}
            <motion.aside
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 z-40 h-screen w-72 glass border-r border-white/10 lg:hidden"
            >
              <div className="h-full flex flex-col">
                {/* Mobile Logo */}
                <div className="flex items-center gap-3 p-6 border-b border-white/10">
                  <img src="/logo.webp" alt="PitchVision" className="w-14 h-14 rounded-xl object-contain" />
                  <div>
                    <span className="font-bold text-lg text-white">PitchVision</span>
                    <p className="text-xs text-white/50">AI Analytics</p>
                  </div>
                </div>

                {/* User Info */}
                <div className="p-4 border-b border-white/10">
                  <div className="glass rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                        {user?.email?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {user?.email || "User"}
                        </p>
                        <div className="mt-1">
                          {getRoleBadge()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.label === "Dashboard"}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive
                          ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-white/20"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActive
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                            : 'bg-white/10'
                            }`}>
                            <i className={`${item.icon} text-sm ${isActive ? 'text-white' : 'text-white/60'}`}></i>
                          </div>
                          <span className="font-medium">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </nav>

                {/* Theme Toggle */}
                <div className="p-4 border-t border-white/10">
                  <button
                    onClick={toggleTheme}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      theme === 'dark'
                        ? 'text-white/60 hover:text-yellow-400 hover:bg-yellow-500/10'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-500/10'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
                    }`}>
                      <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-sm`}></i>
                    </div>
                    <span className="font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>
                </div>

                {/* Logout */}
                <div className="p-4 border-t border-white/10">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                      <i className="fas fa-sign-out-alt text-sm"></i>
                    </div>
                    <span className="font-medium">Log out</span>
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="lg:ml-72 pt-16 lg:pt-0 min-h-screen relative z-10">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
