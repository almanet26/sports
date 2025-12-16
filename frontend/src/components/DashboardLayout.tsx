import { Link, useLocation } from 'react-router-dom';
import { authService } from '../utils/auth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const userProfile = authService.getUserProfile();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await authService.logout();
    }
  };

  const navItems = [
    { path: '/player-dashboard', label: 'Player Dashboard', role: 'PLAYER', gradient: 'from-blue-600 to-indigo-600' },
    { path: '/coach-dashboard', label: 'Coach Dashboard', role: 'COACH', gradient: 'from-emerald-600 to-teal-600' },
    { path: '/match-analysis', label: 'Match Analysis', role: null, gradient: 'from-violet-600 to-purple-600' },
  ];

  const filteredNavItems = navItems.filter(item => !item.role || item.role === userProfile?.role);

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex overflow-x-hidden">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 h-screen bg-slate-900/50 backdrop-blur-sm shadow-xl border-r border-slate-800 p-6 space-y-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="inline-block w-10 h-10 bg-gradient-to-tr from-emerald-500 to-emerald-600 rounded-lg shadow-md"></span>
          <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
            CricketVA
          </span>
        </div>

        {/* User Info */}
        <div className="px-3 py-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          <div className="font-semibold text-slate-100">{userProfile?.name}</div>
          <div className="text-xs text-slate-400">{userProfile?.email}</div>
          <div className="mt-2">
            <span className="inline-block px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
              {userProfile?.role}
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-4 flex-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`text-left px-4 py-3 rounded-xl font-semibold transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg scale-105`
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl font-semibold transition-all"
        >
          Logout
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full overflow-x-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex justify-between items-center p-4 bg-slate-900/50 backdrop-blur-sm border-b border-slate-800">
          <div className="font-bold text-xl text-slate-100">CricketVA</div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg text-sm font-medium"
          >
            Logout
          </button>
        </header>

        <main className="p-4 md:p-10 w-full h-full">{children}</main>
      </div>
    </div>
  );
}
