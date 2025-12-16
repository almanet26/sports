import { Navigate } from 'react-router-dom';
import { authService } from '../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'PLAYER' | 'COACH' | 'ADMIN';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const isAuthenticated = authService.isAuthenticated();
  const userRole = authService.getUserRole();

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole && userRole !== requiredRole) {
    // Redirect to appropriate dashboard based on role
    if (userRole === 'PLAYER') {
      return <Navigate to="/player-dashboard" replace />;
    } else if (userRole === 'COACH') {
      return <Navigate to="/coach-dashboard" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
