import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function AuthGuard() {
  const { session, loading } = useAuth();

  // If the URL hash contains a recovery token, send to reset page immediately
  // before AuthProvider has a chance to process the session
  if (typeof window !== 'undefined') {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      return <Navigate to={`/reset-password${hash}`} replace />;
    }
  }

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