import { useEffect, useState } from 'react';
import { Eye, X, Loader2 } from 'lucide-react';
import { endImpersonation } from '@/lib/api/userControls';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/lib/toast';

/**
 * Sticky banner that appears at the very top of the app whenever an admin
 * has an active read-only impersonation session running. Provides a single
 * "End" button so admins can't forget they're inspecting another account.
 *
 * Caveat: this is purely the admin-side cosmetic indicator. The "true"
 * server-side scoped impersonation that swaps the authenticated principal
 * is tracked separately in `.local/tasks/phase1-deferred.md`.
 */
export default function ImpersonationBanner() {
  const [sessionId, setSessionId] = useState(() => sessionStorage.getItem('impersonationSession'));
  const [targetId, setTargetId] = useState(() => sessionStorage.getItem('impersonationTarget'));
  const [targetLabel, setTargetLabel] = useState('');
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let active = true;
    if (!targetId) { setTargetLabel(''); return; }
    supabase
      .from('users')
      .select('email, full_name')
      .eq('id', targetId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setTargetLabel(data?.full_name || data?.email || targetId.slice(0, 8));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [targetId]);

  // Re-sync if another tab/page mutates sessionStorage.
  useEffect(() => {
    const onStorage = () => {
      setSessionId(sessionStorage.getItem('impersonationSession'));
      setTargetId(sessionStorage.getItem('impersonationTarget'));
    };
    window.addEventListener('impersonation:changed', onStorage);
    return () => window.removeEventListener('impersonation:changed', onStorage);
  }, []);

  if (!sessionId || !targetId) return null;

  const handleEnd = async () => {
    setEnding(true);
    try {
      await endImpersonation(sessionId);
    } catch {
      // best-effort — even if the server call fails, clear local state.
    }
    sessionStorage.removeItem('impersonationSession');
    sessionStorage.removeItem('impersonationTarget');
    window.dispatchEvent(new Event('impersonation:changed'));
    toast.success('Impersonation ended');
    setSessionId(null);
    setTargetId(null);
    setEnding(false);
  };

  return (
    <div className="sticky top-0 z-[60] bg-purple-600 text-white shadow-lg" role="status">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <Eye className="w-4 h-4 shrink-0" />
        <p className="flex-1 min-w-0 truncate">
          <strong className="font-semibold">Read-only impersonation active.</strong>{' '}
          <span className="opacity-90">Inspecting <span className="font-mono">{targetLabel || targetId}</span>. All actions are audited.</span>
        </p>
        <button
          onClick={handleEnd}
          disabled={ending}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition disabled:opacity-50"
        >
          {ending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          End impersonation
        </button>
      </div>
    </div>
  );
}
