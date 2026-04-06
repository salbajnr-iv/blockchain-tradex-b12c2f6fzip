import { useEffect, useState } from 'react';
import {
  getAllUsersWithBalances,
  setUserAdminFlag,
  setUserStatus,
  adminAdjustBalance,
  adminLockBalance,
} from '@/lib/api/admin';
import { toast } from 'sonner';
import {
  RefreshCw, Search, Shield, ShieldOff, X,
  PlusCircle, MinusCircle, SlidersHorizontal, Lock, Unlock,
  DollarSign,
} from 'lucide-react';

const STATUS_COLORS = {
  active: 'bg-emerald-500/15 text-emerald-400',
  inactive: 'bg-gray-500/15 text-gray-400',
  suspended: 'bg-red-500/15 text-red-400',
};

const KYC_TIER_COLORS = {
  basic: 'bg-gray-500/15 text-gray-400',
  intermediate: 'bg-blue-500/15 text-blue-400',
  pro: 'bg-purple-500/15 text-purple-400',
};

const OPERATIONS = [
  { key: 'add',    label: 'Add Funds',    icon: PlusCircle,       color: 'text-emerald-400', btnColor: 'bg-emerald-600 hover:bg-emerald-500' },
  { key: 'deduct', label: 'Deduct Funds', icon: MinusCircle,      color: 'text-red-400',     btnColor: 'bg-red-600 hover:bg-red-500' },
  { key: 'set',    label: 'Set Balance',  icon: SlidersHorizontal, color: 'text-blue-400',   btnColor: 'bg-blue-600 hover:bg-blue-500' },
];

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0);

function BalanceModal({ user, onClose, onSuccess }) {
  const [operation, setOperation] = useState('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [showLockForm, setShowLockForm] = useState(false);

  const portfolio = user.portfolio;
  const currentBalance = Number(portfolio?.cash_balance ?? 0);
  const isLocked = portfolio?.balance_locked ?? false;

  const computePreview = () => {
    const n = parseFloat(amount);
    if (isNaN(n) || n < 0) return null;
    if (operation === 'add')    return currentBalance + n;
    if (operation === 'deduct') return currentBalance - n;
    if (operation === 'set')    return n;
    return null;
  };

  const preview = computePreview();
  const previewNegative = preview !== null && preview < 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!portfolio?.id) { toast.error('No portfolio found for this user'); return; }
    const n = parseFloat(amount);
    if (isNaN(n) || n < 0) { toast.error('Enter a valid amount'); return; }
    if (!note.trim()) { toast.error('A reason/note is required'); return; }
    if (previewNegative) { toast.error('Balance cannot go negative'); return; }

    setLoading(true);
    try {
      const result = await adminAdjustBalance(portfolio.id, operation, n, note.trim());
      const newBal = result?.new_balance ?? preview;
      toast.success(`Balance updated → ${fmt(newBal)}`);
      onSuccess(user.id, { ...portfolio, cash_balance: newBal });
      setAmount('');
      setNote('');
    } catch (err) {
      toast.error(err.message || 'Balance update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLockToggle = async () => {
    if (!portfolio?.id) return;
    if (!isLocked && !lockReason.trim()) { toast.error('Enter a reason to lock balance'); return; }
    setLockLoading(true);
    try {
      await adminLockBalance(portfolio.id, !isLocked, lockReason.trim() || null);
      toast.success(isLocked ? 'Balance unlocked' : 'Balance locked');
      onSuccess(user.id, { ...portfolio, balance_locked: !isLocked, balance_locked_reason: lockReason.trim() || null });
      setShowLockForm(false);
      setLockReason('');
    } catch (err) {
      toast.error(err.message || 'Failed to update lock');
    } finally {
      setLockLoading(false);
    }
  };

  const op = OPERATIONS.find((o) => o.key === operation);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h3 className="text-lg font-semibold text-white">Manage Balance</h3>
            <p className="text-sm text-gray-400">{user.full_name || user.username} · {user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Balance overview */}
          <div className="flex items-center justify-between p-4 bg-gray-800/60 rounded-xl">
            <div>
              <p className="text-xs text-gray-500 mb-1">Current Cash Balance</p>
              <p className="text-2xl font-bold text-white">{fmt(currentBalance)}</p>
              {portfolio?.total_value > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">+ {fmt(portfolio.total_value)} in holdings</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {isLocked ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/15 text-red-400 text-xs rounded-full font-medium">
                  <Lock size={11} /> Locked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full font-medium">
                  <Unlock size={11} /> Active
                </span>
              )}
              {isLocked && portfolio?.balance_locked_reason && (
                <p className="text-xs text-gray-500 max-w-[160px] text-right">{portfolio.balance_locked_reason}</p>
              )}
            </div>
          </div>

          {/* Operation tabs */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Operation</p>
            <div className="grid grid-cols-3 gap-2">
              {OPERATIONS.map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOperation(key)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-colors ${
                    operation === key
                      ? `${color} border-current bg-current/10`
                      : 'text-gray-500 border-gray-800 hover:border-gray-700 hover:text-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Balance form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                Amount (USD) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <DollarSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              {preview !== null && (
                <p className={`text-xs mt-1 ${previewNegative ? 'text-red-400' : 'text-gray-400'}`}>
                  Result: <span className="font-medium">{fmt(preview)}</span>
                  {previewNegative && ' — insufficient balance'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                Reason / Admin note <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Bonus credit, Fee reversal, Manual correction..."
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !amount || !note.trim() || previewNegative}
              className={`w-full py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${op?.btnColor}`}
            >
              {loading ? 'Updating...' : `${op?.label}`}
            </button>
          </form>

          {/* Lock / Unlock section */}
          <div className="border-t border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-white">{isLocked ? 'Unlock Balance' : 'Lock Balance'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isLocked
                    ? 'Allow this user to deposit and withdraw again'
                    : 'Prevent this user from making any transactions'}
                </p>
              </div>
              {!showLockForm && (
                <button
                  onClick={() => isLocked ? handleLockToggle() : setShowLockForm(true)}
                  disabled={lockLoading}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                    isLocked
                      ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  }`}
                >
                  {lockLoading ? <RefreshCw size={12} className="animate-spin" /> : isLocked ? <Unlock size={12} /> : <Lock size={12} />}
                  {isLocked ? 'Unlock' : 'Lock'}
                </button>
              )}
            </div>

            {showLockForm && !isLocked && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  placeholder="Reason for locking (e.g. Suspicious activity)..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleLockToggle}
                    disabled={lockLoading || !lockReason.trim()}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {lockLoading ? 'Locking...' : 'Confirm Lock'}
                  </button>
                  <button
                    onClick={() => { setShowLockForm(false); setLockReason(''); }}
                    className="px-4 py-2 text-gray-400 hover:text-white text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [balanceTarget, setBalanceTarget] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllUsersWithBalances();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleAdminToggle = async (userId, currentIsAdmin) => {
    setActionLoading(userId + '-admin');
    try {
      await setUserAdminFlag(userId, !currentIsAdmin);
      toast.success(currentIsAdmin ? 'Admin access revoked' : 'Admin access granted');
      setUsers((prev) =>
        prev.map((u) => u.id === userId ? { ...u, is_admin: !currentIsAdmin } : u)
      );
    } catch (err) {
      toast.error(err.message || 'Failed to update admin flag');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setActionLoading(userId + '-status');
    try {
      await setUserStatus(userId, newStatus);
      toast.success(`User ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}`);
      setUsers((prev) =>
        prev.map((u) => u.id === userId ? { ...u, status: newStatus } : u)
      );
    } catch (err) {
      toast.error(err.message || 'Failed to update user status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBalanceSuccess = (userId, updatedPortfolio) => {
    setUsers((prev) =>
      prev.map((u) => u.id === userId ? { ...u, portfolio: updatedPortfolio } : u)
    );
    // Update the balance target so the modal reflects the new balance immediately
    setBalanceTarget((prev) => prev ? { ...prev, portfolio: updatedPortfolio } : null);
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.username ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-gray-400 text-sm mt-1">Manage accounts, balances, and permissions</p>
        </div>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="relative flex-1 max-w-sm mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Search by email, name or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['User', 'Cash Balance', 'KYC Tier', 'Status', 'Joined', 'Admin', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
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
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500">No users found.</td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const bal = u.portfolio?.cash_balance;
                  const isLocked = u.portfolio?.balance_locked;
                  return (
                    <tr key={u.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <p className="text-white font-medium">{u.full_name || u.username || '—'}</p>
                        <p className="text-gray-500 text-xs">{u.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{bal !== undefined ? fmt(bal) : '—'}</span>
                          {isLocked && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500/15 text-red-400 text-xs rounded">
                              <Lock size={10} /> Locked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${KYC_TIER_COLORS[u.kyc_tier] || 'bg-gray-800 text-gray-400'}`}>
                          {u.kyc_tier || 'basic'}
                          {u.kyc_verified && <span className="ml-1">✓</span>}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[u.status] || 'bg-gray-800 text-gray-400'}`}>
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-400 whitespace-nowrap text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {u.is_admin ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                            <Shield size={12} /> Admin
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Balance management */}
                          <button
                            onClick={() => setBalanceTarget(u)}
                            disabled={!u.portfolio}
                            title="Manage balance"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 rounded-lg text-xs transition-colors"
                          >
                            <DollarSign size={12} />
                            Balance
                          </button>
                          {/* Admin toggle */}
                          <button
                            onClick={() => handleAdminToggle(u.id, u.is_admin)}
                            disabled={actionLoading === u.id + '-admin'}
                            title={u.is_admin ? 'Revoke admin' : 'Grant admin'}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 ${
                              u.is_admin
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400'
                                : 'bg-gray-800 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400'
                            }`}
                          >
                            {u.is_admin ? <ShieldOff size={12} /> : <Shield size={12} />}
                            {u.is_admin ? 'Revoke' : 'Admin'}
                          </button>
                          {/* Suspend / reactivate */}
                          <button
                            onClick={() => handleStatusToggle(u.id, u.status)}
                            disabled={actionLoading === u.id + '-status'}
                            className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 ${
                              u.status === 'suspended'
                                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-gray-800 text-gray-400 hover:bg-red-500/10 hover:text-red-400'
                            }`}
                          >
                            {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500">
            {filtered.length} of {users.length} users
          </div>
        )}
      </div>

      {balanceTarget && (
        <BalanceModal
          user={balanceTarget}
          onClose={() => setBalanceTarget(null)}
          onSuccess={handleBalanceSuccess}
        />
      )}
    </div>
  );
}
