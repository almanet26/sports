import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import type { UserRole } from './store/authStore';

// Layouts
import { DashboardLayout } from './components/layout/DashboardLayout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import PlayerDashboard from './pages/PlayerDashboard';
import CoachDashboard from './pages/CoachDashboard';
import AdminPlansPage from './pages/AdminPlansPage';
import AdminDashboard from './pages/AdminDashboard';
import UploadPage from './pages/UploadPage';
import HighlightsPage from './pages/HighlightsPage';
import VideoDetailPage from './pages/VideoDetailPage';
import RequestsPage from './pages/RequestsPage';
import ProfilePage from './pages/ProfilePage';
import PlayerPerformance from './pages/PlayerPerformance';
import BowlingAnalysisPage from './pages/BowlingAnalysisPage';
import BattingAnalysisPage from './pages/BattingAnalysisPage';
import PlayerSubmissionsPage from './pages/PlayerSubmissionsPage';
import CoachInboxPage from './pages/CoachInboxPage';
import CoachReviewPage from './pages/CoachReviewPage';
import SubscriptionPage from './pages/SubscriptionPage';
import CoachPendingPage from './pages/CoachPendingPage';
import CoachVerificationPage from './pages/CoachVerificationPage';
import FeaturesDetailPage from './pages/FeaturesDetailPage';
import StatsPage from './pages/PlayerStatsPage';
import MatchesPage from './pages/MatchesPage';
import NotificationsPage from './pages/NotificationsPage';
import PlayerProfile from './pages/PlayerProfile';

function normalizeRole(role: string | null | undefined): UserRole | null {
  const normalized = (role ?? '').toUpperCase();
  if (normalized === 'PLAYER' || normalized === 'COACH' || normalized === 'ADMIN') {
    return normalized;
  }
  return null;
}

function getDashboardPath(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'ADMIN' ? '/admin' : normalizedRole === 'COACH' ? '/coach' : '/player';
}

function AuthHydrationFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-500" />
    </div>
  );
}

// Auth is fully managed by useAuthStore (Zustand persist middleware).
// No manual localStorage parsing — the store rehydrates itself on load.

function ProtectedRoute() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

function ProtectedPage({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

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
  return <Outlet />;
}

function GuestRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  if (isAuthenticated && !user) {
    return <AuthHydrationFallback />;
  }
  if (isAuthenticated && user) {
    const role = normalizeRole(user.role);
    if (!role) {
      return <AuthHydrationFallback />;
    }
    return <Navigate to={getDashboardPath(role)} replace />;
  }
  return <Outlet />;
}

function DashboardRedirect() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!user) {
    return <AuthHydrationFallback />;
  }
  const role = normalizeRole(user.role);
  if (!role) {
    return <AuthHydrationFallback />;
  }
  return <Navigate to={getDashboardPath(role)} replace />;
}

function PlayerPageRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!user) {
    return <AuthHydrationFallback />;
  }

  const role = normalizeRole(user.role);
  if (!role) {
    return <AuthHydrationFallback />;
  }
  if (role !== 'PLAYER') {
    return <Navigate to={getDashboardPath(role)} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

function CoachPageRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!user) {
    return <AuthHydrationFallback />;
  }

  const role = normalizeRole(user.role);
  if (!role) {
    return <AuthHydrationFallback />;
  }
  if (!['COACH', 'ADMIN'].includes(role)) {
    return <Navigate to="/player" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

function AdminPageRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!user) {
    return <AuthHydrationFallback />;
  }

  const role = normalizeRole(user.role);
  if (!role) {
    return <AuthHydrationFallback />;
  }
  if (role !== 'ADMIN') {
    const targetPath = role === 'COACH' ? '/coach' : '/player';
    return <Navigate to={targetPath} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

function RouterContent() {
  const navigate = useNavigate();

  // Listen for session expiration events
  useEffect(() => {
    const handleSessionExpired = () => {
      useAuthStore.setState({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
      });
      navigate('/login?session_expired=true', { replace: true });
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [navigate]);

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/coach-pending" element={<CoachPendingPage />} />
      <Route path="/features-detail" element={<FeaturesDetailPage />} />

      {/* Guest only */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Dashboard redirect */}
      <Route path="/dashboard" element={<DashboardRedirect />} />

      {/* Authenticated users */}
      <Route path="/library" element={<ProtectedPage><DashboardLayout><HighlightsPage /></DashboardLayout></ProtectedPage>} />
      <Route path="/video/:videoId" element={<ProtectedPage><DashboardLayout><VideoDetailPage /></DashboardLayout></ProtectedPage>} />
      <Route path="/requests" element={<ProtectedPage><DashboardLayout><RequestsPage /></DashboardLayout></ProtectedPage>} />
      <Route path="/settings" element={<ProtectedPage><DashboardLayout><ProfilePage /></DashboardLayout></ProtectedPage>} />
      <Route path="/stats" element={<ProtectedPage><DashboardLayout><StatsPage /></DashboardLayout></ProtectedPage>} />
      <Route path="/matches" element={<ProtectedPage><DashboardLayout><MatchesPage /></DashboardLayout></ProtectedPage>} />
      <Route path="/notifications" element={<ProtectedPage><DashboardLayout><NotificationsPage /></DashboardLayout></ProtectedPage>} />

      <Route path="/player" element={<PlayerPageRoute><DashboardLayout /></PlayerPageRoute>}>
        <Route index element={<PlayerDashboard />} />
        <Route path="profile" element={<PlayerProfile />} />
        <Route path="bowling" element={<BowlingAnalysisPage />} />
        <Route path="batting" element={<BattingAnalysisPage />} />
        <Route path="submissions" element={<PlayerSubmissionsPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
      </Route>

      {/* Coach */}
      <Route path="/coach" element={<CoachPageRoute><DashboardLayout /></CoachPageRoute>}>
        <Route index element={<CoachDashboard />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="player/:id" element={<PlayerPerformance />} />
        <Route path="submissions" element={<CoachInboxPage />} />
        <Route path="submissions/:submissionId/review" element={<CoachReviewPage />} />
      </Route>

      {/* Admin */}
      <Route path="/admin" element={<AdminPageRoute><DashboardLayout /></AdminPageRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="coaches" element={<CoachVerificationPage />} />
        <Route path="plans" element={<AdminPlansPage />} />
      </Route>

      {/* Legacy */}
      <Route path="/highlights" element={<Navigate to="/library" replace />} />
      <Route path="/profile" element={<Navigate to="/player/profile" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <RouterContent />
    </BrowserRouter>
  );
}

export { ProtectedRoute, RoleGuard, GuestRoute, DashboardRedirect };
