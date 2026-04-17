import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import {
  CheckCircle, XCircle, RefreshCw, Search, Eye, X, ExternalLink,
  Clock, Loader2, ChevronDown, Filter, AlertCircle,
} from 'lucide-react';
import {
  adminGetAllDeposits,
  adminApproveDeposit,
  adminRejectDeposit,
  adminSetUnderReview,
  getDepositProofUrl,
} from '@/lib/api/cryptoDeposits';
import { logAdminAction } from '@/lib/api/admin';

const STATUS_COLORS = {
  pending:      'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  under_review: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  completed:    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  rejected:     'bg-red-500/15 text-red-600 dark:text-red-400',
};

const STATUS_LABELS = {
  pending:      'Pending',
  under_review: 'Under Review',
  completed:    'Completed',
  rejected:     'Rejected',
};

const ASSET_META = {
  BTC:  { icon: '₿', color: 'text-orange-500' },
  ETH:  { icon: 'Ξ', color: 'text-blue-500' },
  SOL:  { icon: '◎', color: 'text-purple-500' },
  BNB:  { icon: 'B', color: 'text-yellow-500' },
  USDT: { icon: '₮', color: 'text-emerald-500' },
  USDC: { icon: '$', color: 'text-sky-500' },
};

function RejectModal({ deposit, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    await onConfirm(deposit.id, reason.trim());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reject Deposit</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              {deposit.amount} {deposit.asset} · {deposit.user?.email}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">
              Reason for rejection <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              placeholder="Explain why this deposit is being rejected..."
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Rejecting...' : 'Reject Deposit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailModal({ deposit, onClose, onApprove, onReject, onUnderReview }) {
  const [proofUrl, setProofUrl] = useState(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [noteInput, setNoteInput] = useState('');

  const meta = ASSET_META[deposit.asset] || {};
  const isPending   = deposit.status === 'pending';
  const isReview    = deposit.status === 'under_review';
  const isActionable = isPending || isReview;

  const handleViewProof = async () => {
    if (!deposit.proof_url) return;
    if (proofUrl) { window.open(proofUrl, '_blank'); return; }
    setLoadingProof(true);
    try {
      const url = await getDepositProofUrl(deposit.proof_url);
      setProofUrl(url);
      window.open(url, '_blank');
    } catch {
      toast.error('Could not load proof file');
    } finally {
      setLoadingProof(false);
    }
  };

  const act = async (fn, label) => {
    setActionLoading(label);
    try { await fn(); } finally { setActionLoading(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-bold ${meta.color}`}>{meta.icon || deposit.asset[0]}</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {parseFloat(deposit.amount)} {deposit.asset}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{deposit.network} network</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[deposit.status]}`}>
              {STATUS_LABELS[deposit.status]}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">User</p>
              <p className="font-medium text-gray-900 dark:text-white truncate">{deposit.user?.full_name || deposit.user?.username || '—'}</p>
              <p className="text-xs text-gray-500 truncate">{deposit.user?.email}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Submitted</p>
              <p className="font-medium text-gray-900 dark:text-white">{new Date(deposit.created_at).toLocaleDateString()}</p>
              <p className="text-xs text-gray-500">{new Date(deposit.created_at).toLocaleTimeString()}</p>
            </div>
          </div>

          {deposit.tx_hash && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Transaction Hash</p>
              <p className="font-mono text-xs text-gray-900 dark:text-white break-all">{deposit.tx_hash}</p>
            </div>
          )}

          {deposit.admin_note && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3">
              <p className="text-amber-700 dark:text-amber-400 text-xs font-semibold mb-1">Admin Note</p>
              <p className="text-amber-900 dark:text-amber-300 text-sm">{deposit.admin_note}</p>
            </div>
          )}

          <div className="flex gap-2">
            {deposit.proof_url && (
              <button
                onClick={handleViewProof}
                disabled={loadingProof}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors"
              >
                {loadingProof ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                View Proof
              </button>
            )}
          </div>

          {isActionable && (
            <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Admin Note (optional)</label>
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  rows={2}
                  placeholder="Add a note visible to the user (optional for approval)"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {isPending && (
                  <button
                    onClick={() => act(onUnderReview, 'review')}
                    disabled={!!actionLoading}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    {actionLoading === 'review' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Mark Under Review
                  </button>
                )}
                <button
                  onClick={() => act(() => onApprove(noteInput || null), 'approve')}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  {actionLoading === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Approve & Credit
                </button>
                <button
                  onClick={() => act(() => onReject(), 'reject')}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  {actionLoading === 'reject' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DepositRow({ deposit, onView }) {
  const meta = ASSET_META[deposit.asset] || {};
  const isActionable = deposit.status === 'pending' || deposit.status === 'under_review';

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <span className={`text-lg font-bold w-6 text-center shrink-0 ${meta.color}`}>{meta.icon || deposit.asset[0]}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {parseFloat(deposit.amount)} {deposit.asset}
          </span>
          <span className="text-xs text-gray-400">{deposit.network}</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {deposit.user?.email || deposit.user_id?.slice(0, 8)} · {new Date(deposit.created_at).toLocaleDateString()}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[deposit.status]}`}>
          {STATUS_LABELS[deposit.status]}
        </span>
        {isActionable && (
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        )}
        <button
          onClick={() => onView(deposit)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <Eye size={15} />
        </button>
      </div>
    </div>
  );
}

export default function AdminDeposits() {
  const queryClient = useQueryClient();
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [viewDeposit, setView]      = useState(null);
  const [rejectDeposit, setReject]  = useState(null);

  const { data: deposits = [], isLoading, refetch } = useQuery({
    queryKey: ['admin_deposits', statusFilter],
    queryFn:  () => adminGetAllDeposits({ status: statusFilter === 'all' ? null : statusFilter }),
    refetchInterval: 30000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries(['admin_deposits']);
    queryClient.invalidateQueries(['user_deposits']);
    queryClient.invalidateQueries(['user_crypto_balances']);
  };

  const handleApprove = async (depositId, adminNote) => {
    try {
      await adminApproveDeposit(depositId, adminNote);
      await logAdminAction('approve_deposit', 'deposit', depositId, { admin_note: adminNote });
      toast.success('Deposit approved and balance credited');
      setView(null);
      invalidate();
    } catch (err) {
      toast.error(err.message || 'Approval failed');
    }
  };

  const handleReject = async (depositId, reason) => {
    try {
      await adminRejectDeposit(depositId, reason);
      await logAdminAction('reject_deposit', 'deposit', depositId, { reason });
      toast.success('Deposit rejected');
      setReject(null);
      setView(null);
      invalidate();
    } catch (err) {
      toast.error(err.message || 'Rejection failed');
    }
  };

  const handleUnderReview = async (depositId) => {
    try {
      await adminSetUnderReview(depositId);
      await logAdminAction('set_deposit_under_review', 'deposit', depositId);
      toast.success('Marked as under review');
      setView(null);
      invalidate();
    } catch (err) {
      toast.error(err.message || 'Failed');
    }
  };

  const filtered = deposits.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.asset?.toLowerCase().includes(q) ||
      d.user?.email?.toLowerCase().includes(q) ||
      d.user?.full_name?.toLowerCase().includes(q) ||
      d.tx_hash?.toLowerCase().includes(q) ||
      d.network?.toLowerCase().includes(q)
    );
  });

  const pendingCount = deposits.filter(d => d.status === 'pending').length;
  const reviewCount  = deposits.filter(d => d.status === 'under_review').length;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Crypto Deposits</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Review and approve manual deposit submissions
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',        value: deposits.length,  color: 'text-gray-900 dark:text-white' },
          { label: 'Pending',      value: pendingCount,     color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Under Review', value: reviewCount,      color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Completed',    value: deposits.filter(d => d.status === 'completed').length, color: 'text-emerald-600 dark:text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, asset, tx hash..."
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {['all', 'pending', 'under_review', 'completed', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {s === 'under_review' ? 'Under Review' : s.charAt(0).toUpperCase() + s.slice(1)}
              {s === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 bg-yellow-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <AlertCircle size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No deposits found</p>
          </div>
        ) : (
          filtered.map((d) => (
            <DepositRow
              key={d.id}
              deposit={d}
              onView={setView}
            />
          ))
        )}
      </div>

      {/* Detail Modal */}
      {viewDeposit && (
        <DetailModal
          deposit={viewDeposit}
          onClose={() => setView(null)}
          onApprove={(note) => handleApprove(viewDeposit.id, note)}
          onReject={() => { setReject(viewDeposit); }}
          onUnderReview={() => handleUnderReview(viewDeposit.id)}
        />
      )}

      {/* Reject Modal */}
      {rejectDeposit && (
        <RejectModal
          deposit={rejectDeposit}
          onConfirm={(id, reason) => handleReject(id, reason)}
          onClose={() => setReject(null)}
        />
      )}
    </div>
  );
}
