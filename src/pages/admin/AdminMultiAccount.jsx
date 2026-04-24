import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Users2, Globe, Fingerprint, RefreshCw, AlertTriangle, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { setUserStatus } from '@/lib/api/admin';
import {
  getReviewedClusters,
  markClusterReviewed,
  unmarkClusterReviewed,
  clusterId,
} from '@/lib/api/multiAccountReview';

export default function AdminMultiAccount() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('device');
  const [reviewed, setReviewed] = useState([]);
  const [busyKey, setBusyKey] = useState(null);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, reviewedList] = await Promise.all([
      supabase
        .from('device_fingerprints')
        .select(
          'user_id, visitor_id, ip_address, user_agent, last_seen_at, users:user_id ( email, full_name, status )'
        )
        .order('last_seen_at', { ascending: false })
        .limit(2000),
      getReviewedClusters(),
    ]);
    if (error) {
      toast.error('Failed to load data');
      setRows([]);
    } else {
      setRows(data || []);
    }
    setReviewed(reviewedList);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sharedDevices = useMemo(() => groupBy(rows, 'visitor_id'), [rows]);
  const sharedIps     = useMemo(() => groupBy(rows, 'ip_address'), [rows]);

  const data = tab === 'device' ? sharedDevices : sharedIps;
  const reviewedSet = useMemo(() => new Set(reviewed.map((r) => r.id)), [reviewed]);

  const handleMarkReviewed = async (cluster) => {
    const id = clusterId(tab, cluster.key);
    setBusyKey(id);
    try {
      const next = await markClusterReviewed(tab, cluster.key);
      setReviewed(next);
      toast.success('Cluster marked as reviewed');
    } catch (err) {
      toast.error(err.message || 'Failed to mark cluster');
    } finally {
      setBusyKey(null);
    }
  };

  const handleUnmarkReviewed = async (cluster) => {
    const id = clusterId(tab, cluster.key);
    setBusyKey(id);
    try {
      const next = await unmarkClusterReviewed(tab, cluster.key);
      setReviewed(next);
      toast.success('Review flag removed');
    } catch (err) {
      toast.error(err.message || 'Failed to update cluster');
    } finally {
      setBusyKey(null);
    }
  };

  const handleBulkFreeze = async (cluster) => {
    const targets = cluster.users.filter((u) => u.status !== 'suspended' && u.status !== 'frozen');
    if (targets.length === 0) {
      toast.info('All users in this cluster are already frozen.');
      return;
    }
    const ok = window.confirm(
      `Freeze ${targets.length} user${targets.length === 1 ? '' : 's'} in this cluster? They will be unable to sign in or trade.`
    );
    if (!ok) return;
    const id = clusterId(tab, cluster.key);
    setBusyKey(id);
    try {
      const results = await Promise.allSettled(targets.map((u) => setUserStatus(u.user_id, 'suspended')));
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded > 0) toast.success(`Froze ${succeeded} account${succeeded === 1 ? '' : 's'}`);
      if (failed > 0) toast.error(`${failed} freeze action${failed === 1 ? '' : 's'} failed`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Bulk freeze failed');
    } finally {
      setBusyKey(null);
    }
  };

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
            <ClusterCard
              key={cluster.key}
              cluster={cluster}
              kind={tab}
              isReviewed={reviewedSet.has(clusterId(tab, cluster.key))}
              busy={busyKey === clusterId(tab, cluster.key)}
              onMarkReviewed={() => handleMarkReviewed(cluster)}
              onUnmarkReviewed={() => handleUnmarkReviewed(cluster)}
              onBulkFreeze={() => handleBulkFreeze(cluster)}
            />
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

function ClusterCard({ cluster, kind, isReviewed, busy, onMarkReviewed, onUnmarkReviewed, onBulkFreeze }) {
  const allFrozen = cluster.users.every((u) => u.status === 'suspended' || u.status === 'frozen');
  return (
    <div className={`rounded-xl border bg-white dark:bg-gray-900 overflow-hidden ${isReviewed ? 'border-emerald-300 dark:border-emerald-800/50' : 'border-gray-200 dark:border-gray-800'}`}>
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Users2 size={16} className="text-amber-500 shrink-0" />
          <code className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
            {kind === 'device' ? `${cluster.key.slice(0, 16)}…` : cluster.key}
          </code>
          {isReviewed && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 size={10} /> Reviewed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">
            {cluster.users.length} users
          </span>
          {!allFrozen && (
            <button
              onClick={onBulkFreeze}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <ShieldAlert size={11} />}
              Bulk freeze
            </button>
          )}
          {isReviewed ? (
            <button
              onClick={onUnmarkReviewed}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Unmark
            </button>
          ) : (
            <button
              onClick={onMarkReviewed}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
              Mark reviewed
            </button>
          )}
        </div>
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
              {u.status === 'frozen' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 mr-2">
                  Frozen
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
