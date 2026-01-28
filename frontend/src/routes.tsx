import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import type { UserRole } from './store/authStore';
import { useMemo } from 'react';

// Layouts
import { DashboardLayout } from './components/layout/DashboardLayout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import PlayerDashboard from './pages/PlayerDashboard';
import CoachDashboard from './pages/CoachDashboard';
import AdminDashboard from './pages/AdminDashboard';
import UploadPage from './pages/UploadPage';
import HighlightsPage from './pages/HighlightsPage';
import VideoDetailPage from './pages/VideoDetailPage';
import RequestsPage from './pages/RequestsPage';
import ProfilePage from './pages/ProfilePage';
import stats from './pages/PlayerStatsPage'; import matches from './pages/MatchesPage'; import notifications from './pages/NotificationsPage';

// ============ Auth Initializer (runs once on module load) ============
let authInitialized = false;

function initializeAuthOnce() {
  if (authInitialized) return;
  authInitialized = true;

  const token = localStorage.getItem('access_token');
  const userProfile = localStorage.getItem('user_profile');

  if (token && userProfile) {
    try {
      const user = JSON.parse(userProfile);
      useAuthStore.setState({
        token,

  
  const token = localStorage.getItem('access_token');
  const userProfile = localStorage.getItem('user_profile');
  
  if (token && userProfile) {
    try {
      const user = JSON.parse(userProfile);
      useAuthStore.setState({ 
        token, 
        isAuthenticated: true,
        user,
      });
      console.log('[Auth] Initialized from localStorage:', { userRole: user?.role });
    } catch (e) {
      console.error('[Auth] Failed to parse user profile:', e);
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_profile');
    }
  }
}

// Initialize immediately on module load
initializeAuthOnce();


// Protected Route - Requires authentication
function ProtectedRoute() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const shouldRedirect = useMemo(() => !isAuthenticated, [isAuthenticated]);

  if (shouldRedirect) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }


  
  const shouldRedirect = useMemo(() => !isAuthenticated, [isAuthenticated]);
  
  if (shouldRedirect) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <Outlet />;
}

// Role Guard - Restricts access based on user role
interface RoleGuardProps {
  allowedRoles: UserRole[];
  fallbackPath?: string;
}

function RoleGuard({ allowedRoles, fallbackPath = '/player' }: RoleGuardProps) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={fallbackPath} replace />;
  }

  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={fallbackPath} replace />;
  }
  
  return <Outlet />;
}

// Guest Route - Only accessible when NOT authenticated
function GuestRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);


  if (isAuthenticated && user) {
    const targetPath = user.role === 'ADMIN' ? '/admin' :
      user.role === 'COACH' ? '/coach' : '/player';
    return <Navigate to={targetPath} replace />;
  }


  
  if (isAuthenticated && user) {
    const targetPath = user.role === 'ADMIN' ? '/admin' : 
                       user.role === 'COACH' ? '/coach' : '/player';
    return <Navigate to={targetPath} replace />;
  }
  
  return <Outlet />;
}

// Dashboard Redirect - Routes to role-specific dashboard
function DashboardRedirect() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);


  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const targetPath = user.role === 'ADMIN' ? '/admin' :
    user.role === 'COACH' ? '/coach' : '/player';


  
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  
  const targetPath = user.role === 'ADMIN' ? '/admin' : 
                     user.role === 'COACH' ? '/coach' : '/player';
  

  return <Navigate to={targetPath} replace />;
}

// ============ App Router ============
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Home Page - Accessible to all */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth Pages - Guest only */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Dashboard Redirect */}
        <Route path="/dashboard" element={<DashboardRedirect />} />

        {/* Dashboard Redirect */}
        <Route path="/dashboard" element={<DashboardRedirect />} />
        
        {/* Protected Routes - All authenticated users */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/library" element={<HighlightsPage />} />
            <Route path="/video/:videoId" element={<VideoDetailPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/settings" element={<ProfilePage />} />
            <Route path="/player" element={<PlayerDashboard />} />
          </Route>
        </Route>

        {/* Coach Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleGuard allowedRoles={['COACH', 'ADMIN']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/coach" element={<CoachDashboard />} />
              <Route path="/coach/upload" element={<UploadPage />} />
            </Route>
          </Route>
        </Route>

        {/* Admin Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleGuard allowedRoles={['ADMIN']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/upload" element={<UploadPage />} />
            </Route>
          </Route>
        </Route>


        {/* Legacy Redirects */}
        <Route path="/highlights" element={<Navigate to="/library" replace />} />
        <Route path="/profile" element={<Navigate to="/settings" replace />} />


        
        {/* Legacy Redirects */}
        <Route path="/highlights" element={<Navigate to="/library" replace />} />
        <Route path="/profile" element={<Navigate to="/settings" replace />} />
        

        {/* Default Routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
export { ProtectedRoute, RoleGuard, GuestRoute, DashboardRedirect };
