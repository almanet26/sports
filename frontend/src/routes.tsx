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

// Auth is fully managed by useAuthStore (Zustand persist middleware).
// No manual localStorage parsing — the store rehydrates itself on load.

function ProtectedRoute() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const shouldRedirect = useMemo(() => !isAuthenticated, [isAuthenticated]);
  if (shouldRedirect) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
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
  if (isAuthenticated && user) {
    const targetPath = user.role === 'ADMIN' ? '/admin' : user.role === 'COACH' ? '/coach' : '/player';
    return <Navigate to={targetPath} replace />;
  }
  return <Outlet />;
}

function DashboardRedirect() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  const targetPath = user.role === 'ADMIN' ? '/admin' : user.role === 'COACH' ? '/coach' : '/player';
  return <Navigate to={targetPath} replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
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
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/library" element={<HighlightsPage />} />
            <Route path="/video/:videoId" element={<VideoDetailPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/settings" element={<ProfilePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/player" element={<PlayerDashboard />} />
            <Route path="/player/profile" element={<PlayerProfile />} />
            <Route path="/player/bowling" element={<BowlingAnalysisPage />} />
            <Route path="/player/batting" element={<BattingAnalysisPage />} />
            <Route path="/player/submissions" element={<PlayerSubmissionsPage />} />
            <Route path="/player/subscription" element={<SubscriptionPage />} />
          </Route>
        </Route>

        {/* Coach */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleGuard allowedRoles={['COACH', 'ADMIN']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/coach" element={<CoachDashboard />} />
              <Route path="/coach/upload" element={<UploadPage />} />
              <Route path="/coach/player/:id" element={<PlayerPerformance />} />
              <Route path="/coach/submissions" element={<CoachInboxPage />} />
              <Route path="/coach/submissions/:submissionId/review" element={<CoachReviewPage />} />
            </Route>
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleGuard allowedRoles={['ADMIN']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/upload" element={<UploadPage />} />
              <Route path="/admin/coaches" element={<CoachVerificationPage />} />
              <Route path="/admin/plans" element={<AdminPlansPage />} />
            </Route>
          </Route>
        </Route>

        {/* Legacy */}
        <Route path="/highlights" element={<Navigate to="/library" replace />} />
        <Route path="/profile" element={<Navigate to="/player/profile" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export { ProtectedRoute, RoleGuard, GuestRoute, DashboardRedirect };
