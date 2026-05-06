import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore, useSubscriptionStore } from './store/authStore';
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
import AdminUsersPage from './pages/AdminUsersPage';
import AdminAuditLogPage from './pages/AdminAuditLogPage';
import UploadPage from './pages/UploadPage';
import HighlightsPage from './pages/HighlightsPage';
import VideoDetailPage from './pages/VideoDetailPage';
import RequestsPage from './pages/RequestsPage';
import PlayerProfilePage from './pages/PlayerProfilePage';
import CoachProfilePage from './pages/CoachProfilePage';

// Profile Dispatcher - Renders the correct profile based on user role
function ProfileDispatcher() {
  const user = useAuthStore((state) => state.user);
  if (user?.role === 'PLAYER') return <PlayerProfilePage />;
  if (user?.role === 'COACH' || user?.role === 'ADMIN') return <CoachProfilePage />;
  return <Navigate to="/dashboard" replace />;
}
import PlayerPerformance from './pages/PlayerPerformance';
import BowlingAnalysisPage from './pages/BowlingAnalysisPage';
import BattingAnalysisPage from './pages/BattingAnalysisPage';
import PlayerSubmissionsPage from './pages/PlayerSubmissionsPage';
import CoachInboxPage from './pages/CoachInboxPage';
import CoachReviewPage from './pages/CoachReviewPage';
import BillingPage from './pages/BillingPage';
import SubscriptionPage from './pages/SubscriptionPage';
import CoachPendingPage from './pages/CoachPendingPage';
import CoachVerificationPage from './pages/CoachVerificationPage';
import FeaturesDetailPage from './pages/FeaturesDetailPage';
import StatsPage from './pages/PlayerStatsPage';
import MatchesPage from './pages/MatchesPage';
import NotificationsPage from './pages/NotificationsPage';
import ChatPage, { CoachChatPage } from './pages/ChatPage';
import ScoutingPage from './pages/ScoutingPage';
import PlayerMyCoachesPage from './pages/PlayerMyCoachesPage';
import PlayerGamification from './pages/PlayerGamification';
import PlayerVideosPage from './pages/PlayerVideosPage';
import PlayerProfile from './pages/PlayerProfile';

// Auth Initializer (runs once on module load)
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
        isAuthenticated: true,
        user,
      });
      // Hydrate subscription + quota state in the background
      useSubscriptionStore.getState().fetchMe().catch(() => {});
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

  return <Outlet />;
}

// Role Guard - Restricts access based on user role
interface RoleGuardProps {
  allowedRoles: UserRole[];
  fallbackPath?: string;
}

function getRoleHome(role: UserRole): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'COACH') return '/coach';
  return '/player';
}

function RoleGuard({ allowedRoles, fallbackPath }: RoleGuardProps) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={fallbackPath ?? getRoleHome(user.role)} replace />;
  }

  return <Outlet />;
}

// Guest Route - Only accessible when NOT authenticated
function GuestRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (isAuthenticated && user) {
    const targetPath =
      user.role === 'ADMIN'
        ? '/admin'
        : user.role === 'COACH'
          ? '/coach'
          : '/player';

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

  const targetPath =
    user.role === 'ADMIN'
      ? '/admin'
      : user.role === 'COACH'
        ? '/coach'
        : '/player';

  return <Navigate to={targetPath} replace />;
}

// App Router
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

        {/* Shared authenticated routes (all roles) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/library" element={<HighlightsPage />} />
            <Route path="/video/:videoId" element={<VideoDetailPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/settings" element={<ProfileDispatcher />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/billing" element={<BillingPage />} />
          </Route>
        </Route>

        {/* Player-only routes — non-players are redirected to their role home */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleGuard allowedRoles={['PLAYER']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/player" element={<PlayerDashboard />} />
              <Route path="/player/:id" element={<PlayerPerformance />} />
              <Route path="/player/bowling" element={<BowlingAnalysisPage />} />
              <Route path="/player/batting" element={<BattingAnalysisPage />} />
              <Route path="/player/submissions" element={<PlayerSubmissionsPage />} />
              <Route path="/player/subscription" element={<SubscriptionPage />} />
              <Route path="/player/chat" element={<ChatPage />} />
              <Route path="/player/profile" element={<PlayerProfilePage />} />
              <Route path="/player/my-coaches" element={<PlayerMyCoachesPage />} />
              <Route path="/player/gamification" element={<PlayerGamification />} />
              <Route path="/player/videos" element={<PlayerVideosPage />} />
              <Route path="/player/performance" element={<PlayerProfile />} />
            </Route>
          </Route>
        </Route>

        {/* Coach */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleGuard allowedRoles={['COACH', 'ADMIN']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/coach" element={<CoachDashboard />} />
              <Route path="/coach/upload" element={<UploadPage />} />
              <Route path="/coach/chat" element={<CoachChatPage />} />
              <Route path="/coach/profile" element={<CoachProfilePage />} />
              <Route path="/coach/player/:id" element={<PlayerPerformance />} />
              <Route path="/coach/submissions" element={<CoachInboxPage />} />
              <Route path="/coach/submissions/:submissionId/review" element={<CoachReviewPage />} />
              <Route path="/coach/scouting" element={<ScoutingPage />} />
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
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
            </Route>
          </Route>
        </Route>

        {/* Legacy */}
        <Route path="/highlights" element={<Navigate to="/library" replace />} />
        <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
        <Route path="/settings" element={<ProfileDispatcher />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export { ProtectedRoute, RoleGuard, GuestRoute, DashboardRedirect };
