import { useEffect, useState } from 'react';
import { getAllWithdrawals, adminUpdateWithdrawal } from '@/lib/api/admin';
import { toast } from 'sonner';
import { CheckCircle, XCircle, RefreshCw, Search, ChevronDown } from 'lucide-react';

const STATUS_COLORS = {
  pending: 'bg-yellow-500/15 text-yellow-400',
  completed: 'bg-emerald-500/15 text-emerald-400',
  approved: 'bg-emerald-500/15 text-emerald-400',
  rejected: 'bg-red-500/15 text-red-400',
  failed: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-gray-500/15 text-gray-400',
};

function RejectModal({ transaction, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    await onConfirm(transaction.id, reason.trim());
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-white mb-1">Reject Withdrawal</h3>
        <p className="text-gray-400 text-sm mb-4">
          Amount: <span className="text-white font-medium">${Number(transaction.total_amount).toLocaleString()}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Reason for rejection <span className="text-red-400">*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              placeholder="Explain why this withdrawal is being rejected..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {loading ? 'Rejecting...' : 'Reject Withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const loadWithdrawals = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllWithdrawals();
      setWithdrawals(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWithdrawals(); }, []);

  const handleApprove = async (txId) => {
    setActionLoading(txId);
    try {
      await adminUpdateWithdrawal(txId, 'completed', 'Approved by admin.');
      toast.success('Withdrawal approved');
      await loadWithdrawals();
    } catch (err) {
      toast.error(err.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (txId, reason) => {
    setActionLoading(txId);
    try {
      await adminUpdateWithdrawal(txId, 'rejected', reason);
      toast.success('Withdrawal rejected');
      setRejectTarget(null);
      await loadWithdrawals();
    } catch (err) {
      toast.error(err.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = withdrawals.filter((tx) => {
    const user = tx.portfolios?.users;
    const matchesSearch =
      !search ||
      (user?.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (user?.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (tx.reference_number ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const fmt = (v) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Withdrawals</h1>
          <p className="text-gray-400 text-sm mt-1">Review and action withdrawal requests</p>
        </div>
        <button
          onClick={loadWithdrawals}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 pr-8 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Date', 'User', 'Amount', 'Method', 'Status', 'Admin Message', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-gray-800 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                    No withdrawals found.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const user = tx.portfolios?.users;
                  const details = tx.withdrawal_details || {};
                  const isPending = tx.status === 'pending';
                  return (
                    <tr key={tx.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-white font-medium">{user?.full_name || user?.username || '—'}</p>
                        <p className="text-gray-500 text-xs">{user?.email || '—'}</p>
                      </td>
                      <td className="px-5 py-4 text-white font-semibold">{fmt(tx.total_amount)}</td>
                      <td className="px-5 py-4 text-gray-400 capitalize">{details.method || tx.payment_method || '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[tx.status] || 'bg-gray-800 text-gray-400'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 max-w-[200px]">
                        <p className="text-gray-400 text-xs truncate">{tx.admin_message || '—'}</p>
                      </td>
                      <td className="px-5 py-4">
                        {isPending ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApprove(tx.id)}
                              disabled={actionLoading === tx.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                            >
                              <CheckCircle size={12} />
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectTarget(tx)}
                              disabled={actionLoading === tx.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                            >
                              <XCircle size={12} />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-600 text-xs">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {rejectTarget && (
        <RejectModal
          transaction={rejectTarget}
          onConfirm={handleReject}
          onClose={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
