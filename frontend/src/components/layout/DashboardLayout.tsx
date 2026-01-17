import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../ui/Button";
import {
  Home,
  Upload,
  Video,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Crown,
  Settings,
} from "lucide-react";

// Shared navigation items (absolute paths)
interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  roles?: ("PLAYER" | "COACH" | "ADMIN")[];
  isAbsolute?: boolean; // If true, use path as-is; otherwise prepend role base path
}

// These are SHARED routes accessible to all authenticated users
const sharedNavItems: NavItem[] = [
  { to: "/library", icon: <Video size={20} />, label: "Library", isAbsolute: true },
  { to: "/requests", icon: <MessageSquare size={20} />, label: "Requests", isAbsolute: true },
  { to: "/settings", icon: <Settings size={20} />, label: "Settings", isAbsolute: true },
];

// Role-specific dashboard items
const dashboardItems: Record<string, NavItem[]> = {
  PLAYER: [
    { to: "/player", icon: <Home size={20} />, label: "Dashboard", isAbsolute: true },
  ],
  COACH: [
    { to: "/coach", icon: <Home size={20} />, label: "Dashboard", isAbsolute: true },
    { to: "/coach/upload", icon: <Upload size={20} />, label: "Upload", isAbsolute: true },
  ],
  ADMIN: [
    { to: "/admin", icon: <Home size={20} />, label: "Dashboard", isAbsolute: true },
    { to: "/admin/upload", icon: <Upload size={20} />, label: "Upload", isAbsolute: true },
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

  // Get role-specific dashboard items
  const roleItems = dashboardItems[user?.role || 'PLAYER'] || dashboardItems.PLAYER;
  
  // Combine role-specific items with shared items
  const allNavItems = [...roleItems, ...sharedNavItems];

  const getRoleBadge = () => {
    switch (user?.role) {
      case "ADMIN":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
            <Crown size={12} /> Admin
          </span>
        );
      case "COACH":
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
            <Crown size={12} /> Coach
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
            Player
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Video className="h-8 w-8 text-emerald-500" />
            <span className="font-bold text-xl text-white">CricCuts</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen w-64 bg-slate-900/95 backdrop-blur-sm border-r border-slate-800
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="hidden lg:flex items-center gap-3 p-6 border-b border-slate-800">
          <Video className="h-8 w-8 text-emerald-500" />
          <span className="font-bold text-xl text-white">CricCuts</span>
        </div>

        {/* User Info */}
        <div className="p-4 mt-16 lg:mt-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.email || "User"}
              </p>
              {getRoleBadge()}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {allNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.label === "Dashboard"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`
              }
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            <span>Log out</span>
          </Button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
