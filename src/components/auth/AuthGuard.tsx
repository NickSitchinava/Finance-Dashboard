import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { DashboardRouteSkeleton } from '../layout/DashboardSkeleton';
import ClientsWorkspaceSkeleton from '../../pages/ClientsWorkspaceSkeleton';

export default function AuthGuard() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (typeof window !== 'undefined') {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      return <Navigate to={`/reset-password${hash}`} replace />;
    }
  }

  if (loading) {
    return location.pathname === '/clients' ? <ClientsWorkspaceSkeleton /> : <DashboardRouteSkeleton />;
  }

  if (!session || !session.user.email_confirmed_at) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
