import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../../store/authStore";

// Navigation items configuration
interface NavItem {
  to: string;
  icon: string;
  label: string;
}

// Role-specific dashboard items
const dashboardItems: Record<string, NavItem[]> = {
  PLAYER: [
    { to: "/player", icon: "fas fa-home", label: "Dashboard" },
    { to: "/library", icon: "fas fa-video", label: "Library" },
    { to: "/requests", icon: "fas fa-comment-dots", label: "Requests" },
    { to: "/settings", icon: "fas fa-cog", label: "Settings" },
  ],
  COACH: [
    { to: "/coach", icon: "fas fa-home", label: "Dashboard" },
    { to: "/coach/upload", icon: "fas fa-cloud-upload-alt", label: "Upload" },
    { to: "/library", icon: "fas fa-video", label: "Library" },
    { to: "/requests", icon: "fas fa-comment-dots", label: "Requests" },
    { to: "/settings", icon: "fas fa-cog", label: "Settings" },
  ],
  ADMIN: [
    { to: "/admin", icon: "fas fa-home", label: "Dashboard" },
    { to: "/admin/upload", icon: "fas fa-cloud-upload-alt", label: "Upload" },
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
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-[#070A14] via-[#0A0F1C] to-[#0D1117] relative overflow-hidden">
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <i className="fas fa-cricket-bat-ball text-white"></i>
            </div>
            <span className="font-bold text-xl text-white">SportVision</span>
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

      {/* Sidebar */}
      <AnimatePresence>
        <motion.aside
          initial={{ x: -280 }}
          animate={{ x: sidebarOpen ? 0 : -280 }}
          className={`
            fixed top-0 left-0 z-40 h-screen w-72 glass border-r border-white/10
            lg:translate-x-0 lg:block
          `}
          style={{ transform: 'none' }}
        >
          <div className="hidden lg:block">
            {/* Keep sidebar always visible on desktop */}
          </div>
          
          {/* Desktop sidebar content */}
          <div className="h-full flex flex-col">
            {/* Logo */}
            <div className="hidden lg:flex items-center gap-3 p-6 border-b border-white/10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center pulse-glow">
                <i className="fas fa-cricket-bat-ball text-white"></i>
              </div>
              <div>
                <span className="font-bold text-lg text-white">SportVision</span>
                <p className="text-xs text-white/50">AI Analytics</p>
              </div>
            </div>

            {/* User Info */}
            <div className="p-4 mt-16 lg:mt-0 border-b border-white/10">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="glass rounded-2xl p-4 border border-white/10 cursor-pointer"
              >
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
                      `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                        isActive
                          ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-white/20"
                          : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
                          isActive 
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600' 
                            : 'bg-white/10 group-hover:bg-white/20'
                        }`}>
                          <i className={`${item.icon} text-sm ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white'}`}></i>
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

            {/* Logout */}
            <div className="p-4 border-t border-white/10">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 group"
              >
                <div className="w-9 h-9 rounded-lg bg-white/10 group-hover:bg-red-500/20 flex items-center justify-center transition-all duration-300">
                  <i className="fas fa-sign-out-alt text-sm"></i>
                </div>
                <span className="font-medium">Log out</span>
              </motion.button>
            </div>
          </div>
        </motion.aside>
      </AnimatePresence>

      {/* Mobile sidebar */}
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
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <i className="fas fa-cricket-bat-ball text-white"></i>
                  </div>
                  <div>
                    <span className="font-bold text-lg text-white">SportVision</span>
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
                        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                          isActive
                            ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-white/20"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isActive 
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
        <div className="p-6 lg:p-8">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
