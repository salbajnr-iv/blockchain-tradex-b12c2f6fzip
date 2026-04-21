import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { hasPermission } from '@/lib/permissions';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('id, email, full_name, is_admin, admin_role')
      .eq('id', user.id)
      .single();
    setProfile(data || null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isAuthenticated) {
      setProfile(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [isAuthenticated, isLoadingAuth, refresh]);

  const role = profile?.admin_role || null;
  const isAdmin = !!profile?.is_admin;

  const can = useCallback((perm) => hasPermission(role, perm), [role]);

  const value = { profile, role, isAdmin, loading, can, refresh };
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}

export function Can({ perm, fallback = null, children }) {
  const { can } = useAdmin();
  if (!can(perm)) return fallback;
  return children;
}
