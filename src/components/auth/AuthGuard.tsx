import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function AuthGuard() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading__spinner" />
        <span className="auth-loading__text">Loading dashboard...</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}