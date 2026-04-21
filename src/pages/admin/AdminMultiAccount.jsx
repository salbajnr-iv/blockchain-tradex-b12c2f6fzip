import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Users2, Globe, Fingerprint, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from '@/lib/toast';

export default function AdminMultiAccount() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('device');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('device_fingerprints')
      .select(
        'user_id, visitor_id, ip_address, user_agent, last_seen_at, users:user_id ( email, full_name, status )'
      )
      .order('last_seen_at', { ascending: false })
      .limit(2000);
    if (error) {
      toast.error('Failed to load data');
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sharedDevices = useMemo(() => groupBy(rows, 'visitor_id'), [rows]);
  const sharedIps     = useMemo(() => groupBy(rows, 'ip_address'), [rows]);

  const data = tab === 'device' ? sharedDevices : sharedIps;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <AlertTriangle className="text-amber-500" size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Multi-Account Detection</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Users sharing the same device fingerprint or IP address.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-800">
        <TabBtn active={tab === 'device'} onClick={() => setTab('device')} icon={Fingerprint}>
          Shared Devices ({sharedDevices.length})
        </TabBtn>
        <TabBtn active={tab === 'ip'} onClick={() => setTab('ip')} icon={Globe}>
          Shared IPs ({sharedIps.length})
        </TabBtn>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="py-20 text-center text-sm text-gray-500">
          No clusters of shared {tab === 'device' ? 'devices' : 'IPs'} found.
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((cluster) => (
            <ClusterCard key={cluster.key} cluster={cluster} kind={tab} />
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
          : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      <Icon size={14} /> {children}
    </button>
  );
}

function ClusterCard({ cluster, kind }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Users2 size={16} className="text-amber-500 shrink-0" />
          <code className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
            {kind === 'device' ? `${cluster.key.slice(0, 16)}…` : cluster.key}
          </code>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
          {cluster.users.length} users
        </span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {cluster.users.map((u) => (
          <div key={u.user_id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium truncate">{u.full_name || '—'}</div>
              <div className="text-xs text-gray-500 truncate">
                {u.email || u.user_id?.slice(0, 8)}
              </div>
            </div>
            <div className="text-right shrink-0">
              {u.status === 'suspended' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 mr-2">
                  Suspended
                </span>
              )}
              <span className="text-xs text-gray-500">
                Last: {new Date(u.last_seen_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupBy(rows, key) {
  const map = new Map();
  rows.forEach((r) => {
    const k = r[key];
    if (!k) return;
    const entry = map.get(k) || { key: k, byUser: new Map() };
    const existing = entry.byUser.get(r.user_id);
    if (!existing || new Date(r.last_seen_at) > new Date(existing.last_seen_at)) {
      entry.byUser.set(r.user_id, {
        user_id: r.user_id,
        email: r.users?.email,
        full_name: r.users?.full_name,
        status: r.users?.status,
        last_seen_at: r.last_seen_at,
      });
    }
    map.set(k, entry);
  });
  return Array.from(map.values())
    .map((c) => ({ key: c.key, users: Array.from(c.byUser.values()) }))
    .filter((c) => c.users.length > 1)
    .sort((a, b) => b.users.length - a.users.length);
}
