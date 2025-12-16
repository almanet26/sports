import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import PlayerDashboard from './pages/PlayerDashboard'
import CoachDashboard from './pages/CoachDashboard'
import MatchAnalysisDashboard from './pages/MatchAnalysisDashboard'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'
import { authService } from './utils/auth'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes */}
        <Route
          path="/player-dashboard"
          element={
            <ProtectedRoute requiredRole="PLAYER">
              <PlayerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/coach-dashboard"
          element={
            <ProtectedRoute requiredRole="COACH">
              <CoachDashboard />
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