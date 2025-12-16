import { Link, useLocation } from "react-router-dom";
import { authService } from "../utils/auth";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const userProfile = authService.getUserProfile();

  const handleLogout = async () => {
    if (confirm("Are you sure you want to logout?")) {
      await authService.logout();
    }
  };

  const navItems = [
    {
      path: "/player-dashboard",
      label: "Player Dashboard",
      role: "PLAYER",
      gradient: "from-blue-600 to-indigo-600",
    },
    {
      path: "/coach-dashboard",
      label: "Coach Dashboard",
      role: "COACH",
      gradient: "from-emerald-600 to-teal-600",
    },
    {
      path: "/upload",
      label: "Upload Videos",
      role: "PLAYER",
      gradient: "from-blue-600 to-indigo-600",
    },
    // { path: '/match-analysis', label: 'Match Analysis', role: null, gradient: 'from-blue-600 to-indigo-600' },
    {
      path: "/profile",
      label: "Profile & Settings",
      role: null,
      gradient: "from-blue-600 to-indigo-600",
    },
  ];

  const filteredNavItems = navItems.filter(
    (item) => !item.role || item.role === userProfile?.role
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="hidden lg:flex flex-col w-64 fixed left-0 top-0 h-screen bg-slate-900/50 backdrop-blur-sm shadow-xl border-r border-slate-800 p-6 space-y-6 overflow-y-auto z-40">
        <div className="flex items-center gap-3">
          <span className="inline-block w-10 h-10 bg-gradient-to-tr from-emerald-500 to-emerald-600 rounded-lg shadow-md"></span>
          <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
            CricketVA
          </span>
        </div>

        <nav className="flex flex-col gap-3 flex-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`text-left px-4 py-3 rounded-xl font-semibold transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                    : "hover:bg-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="px-3 py-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          <div className="font-semibold text-slate-100 truncate">
            {userProfile?.name}
          </div>
          <div className="text-xs text-slate-400 truncate">
            {userProfile?.email}
          </div>
          <div className="mt-2">
            <span className="inline-block px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
              {userProfile?.role}
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl font-semibold transition-all"
        >
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64 min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 flex justify-between items-center px-4 py-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="inline-block w-8 h-8 bg-gradient-to-tr from-emerald-500 to-emerald-600 rounded-lg shadow-md"></span>
            <span className="font-bold text-lg text-slate-100">CricketVA</span>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg text-sm font-medium"
          >
            Logout
          </button>
        </header>

        {/* Mobile Navigation */}
        <nav className="lg:hidden sticky top-[53px] z-20 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${item.gradient} text-white`
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="w-full min-h-[calc(100vh-53px)] lg:min-h-screen">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
