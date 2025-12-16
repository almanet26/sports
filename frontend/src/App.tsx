import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import PlayerDashboard from './pages/PlayerDashboard'
import CoachDashboard from './pages/CoachDashboard'
import MatchAnalysisDashboard from './pages/MatchAnalysisDashboard'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import UploadPage from './pages/UploadPage'
import JobDetailsPage from './pages/JobDetailsPage'
import HighlightsViewerPage from './pages/HighlightsViewerPage'
import ProfilePage from './pages/ProfilePage'
import ProtectedRoute from './components/ProtectedRoute'
import { authService } from './utils/auth'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Player Routes */}
        <Route
          path="/player-dashboard"
          element={
            <ProtectedRoute requiredRole="PLAYER">
              <PlayerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute requiredRole="PLAYER">
              <UploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/job/:jobId"
          element={
            <ProtectedRoute requiredRole="PLAYER">
              <JobDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/highlights/:videoId"
          element={
            <ProtectedRoute requiredRole="PLAYER">
              <HighlightsViewerPage />
            </ProtectedRoute>
          }
        />

        {/* Protected Coach Routes */}
        <Route
          path="/coach-dashboard"
          element={
            <ProtectedRoute requiredRole="COACH">
              <CoachDashboard />
            </ProtectedRoute>
          }
        />

        {/* Shared Protected Routes */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/match-analysis"
          element={
            <ProtectedRoute>
              <MatchAnalysisDashboard />
            </ProtectedRoute>
          }
        />

        {/* Default Route - Redirect based on auth status */}
        <Route
          path="/"
          element={
            authService.isAuthenticated() ? (
              authService.getUserRole() === 'PLAYER' ? (
                <Navigate to="/player-dashboard" replace />
              ) : authService.getUserRole() === 'COACH' ? (
                <Navigate to="/coach-dashboard" replace />
              ) : (
                <Navigate to="/match-analysis" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}