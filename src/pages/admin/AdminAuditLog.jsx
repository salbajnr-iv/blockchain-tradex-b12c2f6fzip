import { useEffect, useState, useCallback } from 'react';
import { getAuditLog } from '@/lib/api/admin';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/lib/toast';
import { RefreshCw, Search, Shield, AlertTriangle, ChevronDown, ChevronUp, X, Download } from 'lucide-react';

const ACTION_META = {
  withdrawal_approved:         { label: 'Withdrawal Approved',       color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  withdrawal_rejected:         { label: 'Withdrawal Rejected',       color: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  approve_deposit:             { label: 'Deposit Approved',          color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  reject_deposit:              { label: 'Deposit Rejected',          color: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  set_deposit_under_review:    { label: 'Deposit Under Review',      color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  kyc_approved:                { label: 'KYC Approved',              color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  kyc_rejected:                { label: 'KYC Rejected',              color: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  kyc_more_info_needed:        { label: 'KYC More Info Requested',   color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  balance_adjusted:            { label: 'Balance Adjusted',          color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  balance_locked:              { label: 'Balance Locked',            color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  balance_unlocked:            { label: 'Balance Unlocked',          color: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
  crypto_balance_adjusted:     { label: 'Crypto Balance Adjusted',   color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  crypto_balance_created:      { label: 'Crypto Balance Added',      color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  crypto_balance_deleted:      { label: 'Crypto Balance Removed',    color: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  user_status_changed:         { label: 'User Status Changed',       color: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  user_promoted_to_admin:      { label: 'Promoted to Admin',         color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
  user_demoted_from_admin:     { label: 'Demoted from Admin',        color: 'bg-gray-500/15 text-gray-600 dark:text-gray-400' },
  investment_catalog_updated:  { label: 'Investment Catalog Updated', color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  setting_updated:             { label: 'Setting Updated',           color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
};

const PAGE_SIZE = 25;

function DetailBadge({ details }) {
  if (!details || typeof details !== 'object') return null;
  const entries = Object.entries(details).filter(([k]) => k !== 'fallback');
  if (entries.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded"
        >
          <span className="text-gray-400 dark:text-gray-500">{k}:</span>
          <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
            {v === null ? 'null' : String(v)}
          </span>
        </span>
      ))}
    </div>
  );
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTION_META[log.action] ?? { label: log.action, color: 'bg-gray-500/15 text-gray-500 dark:text-gray-400' };
  const hasDetails = log.details && Object.keys(log.details).length > 0;

  return (
    <tr
      className={`border-b border-gray-100 dark:border-gray-800 transition-colors ${hasDetails ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40' : ''}`}
      onClick={hasDetails ? () => setExpanded(p => !p) : undefined}
    >
      <td className="px-5 py-3.5 whitespace-nowrap">
        <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          {new Date(log.created_at).toLocaleDateString()}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 tabular-nums">
          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </td>
      <td className="px-5 py-3.5">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {log.admin_name || '—'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{log.admin_email || '—'}</p>
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}>
          {meta.label}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{log.target_type?.replace(/_/g, ' ') || '—'}</p>
        {log.target_id && (
          <p className="text-[10px] font-mono text-gray-400 dark:text-gray-600 truncate max-w-[140px]">{log.target_id}</p>
        )}
      </td>
      <td className="px-5 py-3.5">
        {hasDetails ? (
          <div>
            {expanded ? (
              <div>
                <DetailBadge details={log.details} />
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic truncate max-w-[200px]">
                {Object.entries(log.details)
                  .filter(([k]) => k !== 'fallback')
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ')}
              </p>
            )}
            <span className="text-[10px] text-gray-300 dark:text-gray-600 flex items-center gap-0.5 mt-0.5">
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {expanded ? 'collapse' : 'expand'}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-700">—</span>
        )}
      </td>
    </tr>
  );
}

function MobileLogCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTION_META[log.action] ?? { label: log.action, color: 'bg-gray-500/15 text-gray-500 dark:text-gray-400' };
  const hasDetails = log.details && Object.keys(log.details).length > 0;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{log.admin_name || '—'}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{log.admin_email || '—'}</p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${meta.color}`}>
          {meta.label}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
        <span>{new Date(log.created_at).toLocaleDateString()}</span>
        <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        {log.target_type && <span className="capitalize">{log.target_type.replace(/_/g, ' ')}</span>}
      </div>
      {hasDetails && (
        <button
          onClick={() => setExpanded(p => !p)}
          className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-0.5"
        >
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {expanded ? 'hide details' : 'show details'}
        </button>
      )}
      {expanded && hasDetails && <DetailBadge details={log.details} />}
    </div>
  );
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadLogs = useCallback(async (pg = 0) => {
    setLoading(true);
    setError(null);
    try {
      const { logs: data, total: count } = await getAuditLog(PAGE_SIZE, pg * PAGE_SIZE);
      setLogs(data);
      setTotal(count);
      setPage(pg);
    } catch (err) {
      setError(err.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(0); }, [loadLogs]);

  const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
  const toMs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;

  const filtered = logs.filter(log => {
    const matchesSearch =
      !search ||
      (log.admin_email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (log.admin_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (log.action ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (log.target_id ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const ts = log.created_at ? new Date(log.created_at).getTime() : 0;
    const matchesFrom = !fromMs || ts >= fromMs;
    const matchesTo = !toMs || ts <= toMs;
    return matchesSearch && matchesAction && matchesFrom && matchesTo;
  });

  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('admin_audit_log')
        .select('created_at, admin_email, admin_name, action, target_type, target_id, details')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (fromMs) query = query.gte('created_at', new Date(fromMs).toISOString());
      if (toMs) query = query.lte('created_at', new Date(toMs).toISOString());
      if (actionFilter !== 'all') query = query.eq('action', actionFilter);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data || [];
      const escape = (v) => {
        if (v === null || v === undefined) return '';
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const header = ['timestamp', 'admin_email', 'admin_name', 'action', 'target_type', 'target_id', 'details'];
      const lines = [header.join(',')];
      rows.forEach((r) => {
        lines.push([
          escape(r.created_at),
          escape(r.admin_email),
          escape(r.admin_name),
          escape(r.action),
          escape(r.target_type),
          escape(r.target_id),
          escape(r.details),
        ].join(','));
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} entries`);
    } catch (err) {
      toast.error(err.message || 'Failed to export audit log');
    } finally {
      setExporting(false);
    }
  }, [fromMs, toMs, actionFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {total > 0 ? `${total.toLocaleString()} admin actions recorded` : 'All admin actions are recorded here'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            <Download size={14} className={exporting ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export CSV'}</span>
          </button>
          <button
            onClick={() => loadLogs(page)}
            disabled={loading}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Database table not found</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              Run <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">sql/admin-features-migration.sql</code> in Supabase SQL Editor to create the <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">admin_audit_log</code> table.
              Actions will start logging immediately after that.
            </p>
          </div>
        </div>
      )}


      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by admin, action, ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="appearance-none bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full sm:w-auto"
          >
            <option value="all">All actions</option>
            {uniqueActions.map(a => (
              <option key={a} value={a}>{ACTION_META[a]?.label ?? a}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            aria-label="From date"
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            aria-label="To date"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Clear date range"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 animate-pulse space-y-2">
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32" />
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24" />
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-48" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-14">
            <Shield size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-sm text-gray-400 dark:text-gray-500">No audit log entries yet.</p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Actions will appear here once admins start approving / rejecting items.</p>
          </div>
        ) : (
          filtered.map(log => <MobileLogCard key={log.id} log={log} />)
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                {['Timestamp', 'Admin', 'Action', 'Target', 'Details'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-28" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <Shield size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                    <p className="text-sm text-gray-400 dark:text-gray-500">No audit log entries yet.</p>
                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Actions will appear here once admins start approving / rejecting items.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(log => <LogRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Page {page + 1} of {totalPages} · {total.toLocaleString()} total entries
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => loadLogs(page - 1)}
                disabled={page === 0 || loading}
                className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg disabled:opacity-30 transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => loadLogs(page + 1)}
                disabled={page >= totalPages - 1 || loading}
                className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg disabled:opacity-30 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
