import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Fingerprint, RefreshCw, Search, Monitor, Globe, Clock, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { logAdminAction } from '@/lib/api/admin';

export default function AdminDeviceFingerprints() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleRevoke = async (row, e) => {
    e?.stopPropagation();
    const ok = window.confirm(
      `Revoke this device fingerprint for ${row.users?.email || row.user_id?.slice(0, 8)}? The next time they visit, a new fingerprint record will be created.`
    );
    if (!ok) return;
    setDeletingId(row.id);
    try {
      const { error } = await supabase.from('device_fingerprints').delete().eq('id', row.id);
      if (error) throw error;
      await logAdminAction('device_fingerprint_revoked', 'device_fingerprint', row.id, {
        user_id: row.user_id,
        visitor_id: row.visitor_id,
      });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success('Device fingerprint revoked');
    } catch (err) {
      toast.error(err.message || 'Failed to revoke device');
    } finally {
      setDeletingId(null);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('device_fingerprints')
      .select(
        'id, user_id, visitor_id, canvas_hash, audio_hash, webgl_hash, components, user_agent, language, timezone, screen, platform, ip_address, first_seen_at, last_seen_at, seen_count, users:user_id ( email, full_name )'
      )
      .order('last_seen_at', { ascending: false })
      .limit(500);

    if (error) {
      toast.error('Failed to load device fingerprints');
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) => {
      return (
        r.visitor_id?.toLowerCase().includes(needle) ||
        r.users?.email?.toLowerCase().includes(needle) ||
        r.users?.full_name?.toLowerCase().includes(needle) ||
        r.ip_address?.toLowerCase().includes(needle) ||
        r.user_agent?.toLowerCase().includes(needle)
      );
    });
  }, [rows, q]);

  const sharedVisitorIds = useMemo(() => {
    const counts = new Map();
    rows.forEach((r) => {
      const set = counts.get(r.visitor_id) || new Set();
      set.add(r.user_id);
      counts.set(r.visitor_id, set);
    });
    const shared = new Set();
    counts.forEach((set, vid) => {
      if (set.size > 1) shared.add(vid);
    });
    return shared;
  }, [rows]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Fingerprint className="text-emerald-500" size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Device Fingerprints</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Active client-side device signals (canvas / audio / WebGL).
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by user, email, visitor id, IP, user agent…"
          className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-sm text-gray-500">
          No device fingerprints recorded yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Visitor ID</th>
                  <th className="text-left px-4 py-3 font-medium">Device</th>
                  <th className="text-left px-4 py-3 font-medium">IP</th>
                  <th className="text-left px-4 py-3 font-medium">Seen</th>
                  <th className="text-left px-4 py-3 font-medium">Last Seen</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((r) => {
                  const isShared = sharedVisitorIds.has(r.visitor_id);
                  const isOpen = expanded === r.id;
                  return (
                    <>
                      <tr
                        key={r.id}
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {r.users?.full_name || '—'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {r.users?.email || r.user_id?.slice(0, 8)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs">{r.visitor_id?.slice(0, 12)}…</code>
                          {isShared && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                              SHARED
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                            <Monitor size={12} />
                            {r.platform || '—'} · {r.screen || '—'}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[260px]">
                            {r.user_agent || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Globe size={12} className="text-gray-400" />
                            {r.ip_address || '—'}
                          </div>
                          <div className="text-xs text-gray-500">{r.timezone || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">{r.seen_count}×</td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                            <Clock size={12} />
                            {new Date(r.last_seen_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => handleRevoke(r, e)}
                            disabled={deletingId === r.id}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title="Revoke this device fingerprint"
                          >
                            {deletingId === r.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                            Revoke
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={r.id + ':d'} className="bg-gray-50 dark:bg-gray-800/30">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid sm:grid-cols-2 gap-4 text-xs">
                              <Field label="Visitor ID" value={r.visitor_id} mono />
                              <Field label="Canvas Hash" value={r.canvas_hash} mono />
                              <Field label="Audio Hash" value={r.audio_hash} mono />
                              <Field label="WebGL Hash" value={r.webgl_hash} mono />
                              <Field label="Language" value={r.language} />
                              <Field
                                label="First Seen"
                                value={new Date(r.first_seen_at).toLocaleString()}
                              />
                            </div>
                            <div className="mt-3">
                              <div className="text-[11px] uppercase text-gray-500 mb-1">
                                Components
                              </div>
                              <pre className="text-[11px] bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto">
                                {JSON.stringify(r.components, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-gray-500 mb-0.5">{label}</div>
      <div
        className={`text-gray-900 dark:text-gray-100 break-all ${
          mono ? 'font-mono text-[11px]' : ''
        }`}
      >
        {value || '—'}
      </div>
    </div>
  );
}
