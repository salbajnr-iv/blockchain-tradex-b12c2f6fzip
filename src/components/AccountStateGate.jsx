import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getUserPolicy } from '@/lib/api/userPolicy';

// Allow-listed routes that the user can still visit while a forced state is active.
const ALWAYS_ALLOW = [
  '/reset-password',
  '/forgot-password',
  '/settings/security',
  '/settings/kyc',
  '/support',
  '/terms',
  '/privacy',
];

export default function AccountStateGate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [policy, setPolicy] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.id) { setLoaded(true); return; }
    const load = async () => {
      try {
        const p = await getUserPolicy(user.id);
        if (active) { setPolicy(p); setLoaded(true); }
      } catch {
        if (active) setLoaded(true);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { active = false; clearInterval(id); };
  }, [user?.id]);

  useEffect(() => {
    if (!loaded || !policy) return;
    const path = location.pathname;
    const allowed = ALWAYS_ALLOW.some((p) => path.startsWith(p));
    if (allowed) return;

    if (policy.force_password_reset) {
      navigate('/reset-password?forced=1', { replace: true });
    } else if (policy.force_kyc_renewal) {
      navigate('/settings/kyc?forced=1', { replace: true });
    }
  }, [loaded, policy, location.pathname, navigate]);

  return <Outlet />;
}
