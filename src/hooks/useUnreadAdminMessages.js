import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

/**
 * Tracks unread admin messages for the current user with realtime updates.
 * Returns { unreadCount, latest, refresh }.
 *
 * Caveat: realtime requires the `admin_messages` table to be added to the
 * `supabase_realtime` publication. If it isn't, this falls back to a 30s poll.
 */
export function useUnreadAdminMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [latest, setLatest] = useState(null);

  const refresh = async () => {
    if (!user?.id) { setUnreadCount(0); setLatest(null); return; }
    try {
      const { count } = await supabase
        .from('admin_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      setUnreadCount(count || 0);

      const { data } = await supabase
        .from('admin_messages')
        .select('id, subject, body, created_at, read_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      setLatest((data && data[0]) || null);
    } catch {
      // Table missing or RLS — stay silent rather than spam the user.
    }
  };

  useEffect(() => {
    refresh();
    if (!user?.id) return undefined;

    const pollId = setInterval(refresh, 30_000);
    let channel = null;
    try {
      channel = supabase
        .channel(`admin_messages:${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'admin_messages', filter: `user_id=eq.${user.id}` },
          refresh,
        )
        .subscribe();
    } catch { /* noop */ }

    return () => {
      clearInterval(pollId);
      if (channel) { try { supabase.removeChannel(channel); } catch { /* noop */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { unreadCount, latest, refresh };
}
