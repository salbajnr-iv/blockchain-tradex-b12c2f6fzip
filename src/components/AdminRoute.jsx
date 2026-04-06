import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getAdminStatus } from '@/lib/api/admin';
import { toast } from 'sonner';

export default function AdminRoute() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [isAdmin, setIsAdmin] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || isLoadingAuth) return;

    getAdminStatus()
      .then((adminFlag) => {
        setIsAdmin(adminFlag);
        if (!adminFlag) {
          toast.error('Not authorised. Admin access required.');
        }
      })
      .catch(() => {
        setIsAdmin(false);
        toast.error('Not authorised. Admin access required.');
      })
      .finally(() => setIsChecking(false));
  }, [isAuthenticated, isLoadingAuth]);

  if (isLoadingAuth || isChecking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
