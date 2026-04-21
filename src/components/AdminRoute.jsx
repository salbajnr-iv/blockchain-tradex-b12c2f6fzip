import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';

export default function AdminRoute({ requirePermission = null }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { isAdmin, role, loading, can } = useAdmin();

  if (isLoadingAuth || loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (!isAdmin || !role) return <Navigate to="/" replace />;
  if (requirePermission && !can(requirePermission)) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-semibold mb-2">Access denied</h2>
        <p className="text-sm text-gray-500">
          Your role does not have permission to view this page.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
