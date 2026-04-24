// SERVER TODO (suggestions.md §7): this hook only protects the open tab. A user who
// dumps their JWT and uses it from curl is unaffected. To make idle timeout a real
// security boundary, set Supabase Dashboard → Auth → JWT Expiry to 900 (15 min) so
// even kept-alive tokens expire within the idle window.
import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/lib/toast';

const DEFAULT_IDLE_MS = 15 * 60 * 1000;
const DEFAULT_WARN_MS = 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];

export function useIdleTimeout({ idleMs = DEFAULT_IDLE_MS, warnMs = DEFAULT_WARN_MS } = {}) {
  const { isAuthenticated, signOut } = useAuth();
  const warnTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const clearTimers = () => {
      if (warnTimerRef.current) { clearTimeout(warnTimerRef.current); warnTimerRef.current = null; }
      if (logoutTimerRef.current) { clearTimeout(logoutTimerRef.current); logoutTimerRef.current = null; }
    };

    const reset = () => {
      clearTimers();
      const warnDelay = Math.max(0, idleMs - warnMs);
      warnTimerRef.current = setTimeout(() => {
        try {
          toast.warning('You will be signed out in 1 minute due to inactivity.');
        } catch { /* noop */ }
      }, warnDelay);
      logoutTimerRef.current = setTimeout(async () => {
        try {
          toast.error('Signed out for inactivity. Please sign in again.');
        } catch { /* noop */ }
        try { await signOut(); } catch { /* noop */ }
      }, idleMs);
    };

    const onActivity = () => reset();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') reset();
    };

    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated, idleMs, warnMs, signOut]);
}

export default useIdleTimeout;
