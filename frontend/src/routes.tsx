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
import AdminUsersPage from './pages/AdminUsersPage';
import UploadPage from './pages/UploadPage';
import HighlightsPage from './pages/HighlightsPage';
import VideoDetailPage from './pages/VideoDetailPage';
import RequestsPage from './pages/RequestsPage';
import ProfilePage from './pages/ProfilePage';
import PlayerPerformance from './pages/PlayerPerformance';
import PlayerProfile from './pages/PlayerProfile';
import BowlingAnalysisPage from './pages/BowlingAnalysisPage';
import BattingAnalysisPage from './pages/BattingAnalysisPage';
import PlayerSubmissionsPage from './pages/PlayerSubmissionsPage';
import CoachInboxPage from './pages/CoachInboxPage';
import CoachReviewPage from './pages/CoachReviewPage';
import SubscriptionPage from './pages/SubscriptionPage';
import CoachPendingPage from './pages/CoachPendingPage';
import CoachVerificationPage from './pages/CoachVerificationPage';
import CoachProfileSetupPage from './pages/CoachProfileSetupPage';
import FeaturesDetailPage from './pages/FeaturesDetailPage';
import StatsPage from './pages/PlayerStatsPage';
import MatchesPage from './pages/MatchesPage';
import NotificationsPage from './pages/NotificationsPage';
import CoachSessionsPage from './pages/CoachSessionsPage';
import CoachAvailabilityPage from './pages/CoachAvailabilityPage';
import CoachTrainingPlansPage from './pages/CoachTrainingPlansPage';
import CoachAnalyticsPage from './pages/CoachAnalyticsPage';
import CoachReviewsPage from './pages/CoachReviewsPage';
import CoachEarningsPage from './pages/CoachEarningsPage';
import CoachMyPlayersPage from './pages/CoachMyPlayersPage';
import CoachMessagesPage from './pages/CoachMessagesPage';
import CoachContentPage from './pages/CoachContentPage';
import CoachSettingsPage from './pages/CoachSettingsPage';
import AdminAuditLogPage from './pages/AdminAuditLogPage';
import BillingPage from './pages/BillingPage';
import ChatPage, { CoachChatPage } from './pages/ChatPage';
import ScoutingPage from './pages/ScoutingPage';
import PlayerProfilePage from './pages/PlayerProfilePage';
import BrowseContentPage from './pages/BrowseContentPage';

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

// CoachStatusGuard — blocks incomplete/pending coaches from accessing coach routes
function CoachStatusGuard() {
  const user = useAuthStore((state) => state.user);

  if (user?.role === 'COACH') {
    if (user.coach_status === 'incomplete') {
      return <Navigate to="/coach/setup" replace />;
    }
    if (user.coach_status === 'pending') {
      return <Navigate to="/coach-pending" replace />;
    }
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
          ? (user.coach_status === 'incomplete' ? '/coach/setup' : user.coach_status === 'pending' ? '/coach-pending' : '/coach')
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
        ? (user.coach_status === 'incomplete' ? '/coach/setup' : user.coach_status === 'pending' ? '/coach-pending' : '/coach')
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
        <Route path="/features-detail" element={<FeaturesDetailPage />} />

        {/* Guest only */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Coach profile setup & pending — authenticated coaches only */}
        <Route element={<ProtectedRoute />}>
          <Route path="/coach/setup" element={<CoachProfileSetupPage />} />
          <Route path="/coach-pending" element={<CoachPendingPage />} />
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
            <Route path="/player/profile/edit" element={<PlayerProfilePage />} />
            <Route path="/player/bowling" element={<BowlingAnalysisPage />} />
            <Route path="/player/batting" element={<BattingAnalysisPage />} />
            <Route path="/player/submissions" element={<PlayerSubmissionsPage />} />
            <Route path="/player/subscription" element={<SubscriptionPage />} />
            <Route path="/player/chat" element={<ChatPage />} />
            <Route path="/player/billing" element={<BillingPage />} />
            <Route path="/player/:id" element={<PlayerPerformance />} />
            <Route path="/browse-content" element={<BrowseContentPage />} />
            <Route path="/coach/messages" element={<CoachMessagesPage />} />
          </Route>
        </Route>

        {/* Coach */}
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleGuard allowedRoles={['COACH', 'ADMIN']} />}>
            <Route element={<CoachStatusGuard />}>
              <Route element={<DashboardLayout />}>
                <Route path="/coach" element={<CoachDashboard />} />
                <Route path="/coach/upload" element={<UploadPage />} />
                <Route path="/coach/player/:id" element={<PlayerPerformance />} />
                <Route path="/coach/players" element={<CoachMyPlayersPage />} />
                <Route path="/coach/submissions" element={<CoachInboxPage />} />
                <Route path="/coach/submissions/:submissionId/review" element={<CoachReviewPage />} />
                <Route path="/coach/sessions" element={<CoachSessionsPage />} />
                <Route path="/coach/availability" element={<CoachAvailabilityPage />} />
                <Route path="/coach/training-plans" element={<CoachTrainingPlansPage />} />
                <Route path="/coach/analytics" element={<CoachAnalyticsPage />} />
                <Route path="/coach/reviews" element={<CoachReviewsPage />} />
                <Route path="/coach/earnings" element={<CoachEarningsPage />} />
                <Route path="/coach/content" element={<CoachContentPage />} />
                <Route path="/coach/settings" element={<CoachSettingsPage />} />
                <Route path="/coach/chat" element={<CoachChatPage />} />
                <Route path="/coach/billing" element={<BillingPage />} />
                <Route path="/coach/scouting" element={<ScoutingPage />} />
              </Route>
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
        <Route path="/profile" element={<Navigate to="/player/profile" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export { ProtectedRoute, RoleGuard, GuestRoute, DashboardRedirect, CoachStatusGuard };
