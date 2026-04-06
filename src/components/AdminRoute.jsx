import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getAdminStatus } from '@/lib/api/admin';
import { toast } from 'sonner';

export default function AdminRoute() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [isAdmin, setIsAdmin] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Only run the admin check once auth has resolved and the user is logged in
    if (isLoadingAuth) return;
    if (!isAuthenticated) return; // redirect handled below

    setIsChecking(true);
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

  // Still loading auth session
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in — send to login immediately
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but still checking admin flag
  if (isChecking || isAdmin === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-4 border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Logged in but not admin
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
