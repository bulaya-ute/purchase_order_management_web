import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

/** Gate for /login: already-authenticated users are sent to the dashboard. */
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
