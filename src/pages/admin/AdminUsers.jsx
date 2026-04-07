import { useEffect, useState } from 'react';
import {
  getAllUsersWithBalances,
  setUserAdminFlag,
  setUserStatus,
  adminAdjustBalance,
  adminLockBalance,
} from '@/lib/api/admin';
import {
  adminGetUserCryptoBalances,
  adminAdjustCryptoBalance,
} from '@/lib/api/cryptoDeposits';
import { logAdminAction } from '@/lib/api/admin';
import { toast } from 'sonner';
import {
  RefreshCw, Search, Shield, ShieldOff, X,
  PlusCircle, MinusCircle, SlidersHorizontal, Lock, Unlock,
  DollarSign, User, MoreVertical, ChevronDown, ChevronUp,
  Trash2, Plus, Bitcoin, Loader2,
} from 'lucide-react';

const CRYPTO_ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'USDT', 'USDC'];

const ASSET_META = {
  BTC:  { icon: '₿', color: 'text-orange-400' },
  ETH:  { icon: 'Ξ', color: 'text-blue-400' },
  SOL:  { icon: '◎', color: 'text-purple-400' },
  BNB:  { icon: 'B', color: 'text-yellow-400' },
  USDT: { icon: '₮', color: 'text-emerald-400' },
  USDC: { icon: '$', color: 'text-sky-400' },
};

const CRYPTO_OPS = [
  { key: 'add',    label: 'Add',    icon: PlusCircle,        color: 'text-emerald-400', btnColor: 'bg-emerald-600 hover:bg-emerald-500' },
  { key: 'deduct', label: 'Deduct', icon: MinusCircle,       color: 'text-red-400',     btnColor: 'bg-red-600 hover:bg-red-500' },
  { key: 'set',    label: 'Set',    icon: SlidersHorizontal, color: 'text-blue-400',    btnColor: 'bg-blue-600 hover:bg-blue-500' },
];

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

// ── Crypto balance panel inside BalanceModal ──────────────────────────────────
function CryptoBalancePanel({ user }) {
  const [balances, setBalances]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [editingAsset, setEditing]    = useState(null); // asset string
  const [operation, setOperation]     = useState('add');
  const [amount, setAmount]           = useState('');
  const [note, setNote]               = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [deletingAsset, setDeleting]  = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newAsset, setNewAsset]       = useState('');
  const [newAmount, setNewAmount]     = useState('');
  const [newNote, setNewNote]         = useState('');
  const [addingNew, setAddingNew]     = useState(false);

  const load = async () => {
    setLoading(true);
    try { setBalances(await adminGetUserCryptoBalances(user.id)); }
    catch (err) { toast.error(err.message || 'Failed to load crypto balances'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user.id]);

  const existingAssets = new Set(balances.map(b => b.asset));
  const availableForNew = CRYPTO_ASSETS.filter(a => !existingAssets.has(a));

  const openEdit = (asset) => {
    setEditing(asset); setOperation('add'); setAmount(''); setNote('');
  };

  const currentBal = (asset) => {
    const row = balances.find(b => b.asset === asset);
    return row ? parseFloat(row.balance) : 0;
  };

  const computePreview = (asset) => {
    const n = parseFloat(amount);
    if (isNaN(n) || n < 0) return null;
    const cur = currentBal(asset);
    if (operation === 'add')    return cur + n;
    if (operation === 'deduct') return cur - n;
    if (operation === 'set')    return n;
    return null;
  };

  const handleAdjust = async (asset) => {
    const n = parseFloat(amount);
    if (isNaN(n) || n < 0) { toast.error('Enter a valid amount'); return; }
    if (!note.trim()) { toast.error('A reason is required'); return; }
    const preview = computePreview(asset);
    if (preview !== null && preview < 0) { toast.error('Balance cannot go negative'); return; }

    setSubmitting(true);
    try {
      const result = await adminAdjustCryptoBalance(user.id, asset, operation, n, note.trim());
      await logAdminAction('crypto_balance_adjusted', 'user_balance', user.id, { asset, operation, amount: n, note: note.trim() });
      toast.success(`${asset} balance updated → ${result.new_balance}`);
      setEditing(null); setAmount(''); setNote('');
      await load();
    } catch (err) {
      toast.error(err.message || 'Adjustment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (asset) => {
    setDeleting(asset);
    try {
      await adminAdjustCryptoBalance(user.id, asset, 'delete', 0, 'Admin deleted balance row');
      await logAdminAction('crypto_balance_deleted', 'user_balance', user.id, { asset });
      toast.success(`${asset} balance removed`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const handleAddNew = async (e) => {
    e.preventDefault();
    if (!newAsset) { toast.error('Select an asset'); return; }
    const n = parseFloat(newAmount);
    if (isNaN(n) || n < 0) { toast.error('Enter a valid amount'); return; }
    if (!newNote.trim()) { toast.error('A reason is required'); return; }
    setAddingNew(true);
    try {
      await adminAdjustCryptoBalance(user.id, newAsset, 'set', n, newNote.trim());
      await logAdminAction('crypto_balance_created', 'user_balance', user.id, { asset: newAsset, amount: n, note: newNote.trim() });
      toast.success(`${newAsset} balance set to ${n}`);
      setShowNewForm(false); setNewAsset(''); setNewAmount(''); setNewNote('');
      await load();
    } catch (err) {
      toast.error(err.message || 'Failed to create balance');
    } finally {
      setAddingNew(false);
    }
  };

  if (loading) return (
    <div className="py-10 flex justify-center"><Loader2 size={22} className="animate-spin text-gray-500" /></div>
  );

  return (
    <div className="space-y-3">
      {/* Existing balances */}
      {balances.length === 0 && !showNewForm && (
        <p className="text-sm text-gray-500 text-center py-4">No crypto balances yet for this user.</p>
      )}

      {balances.map((b) => {
        const meta = ASSET_META[b.asset] || { icon: '?', color: 'text-gray-400' };
        const isEditing = editingAsset === b.asset;
        const bal = parseFloat(b.balance);
        const preview = isEditing ? computePreview(b.asset) : null;
        const previewNegative = preview !== null && preview < 0;

        return (
          <div key={b.asset} className="bg-gray-800/60 rounded-xl border border-gray-700/50 overflow-hidden">
            {/* Row header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`text-xl font-bold ${meta.color}`}>{meta.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{b.asset}</p>
                  <p className="text-xs text-gray-400 font-mono">{bal.toFixed(8).replace(/\.?0+$/, '') || '0'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => isEditing ? setEditing(null) : openEdit(b.asset)}
                  className="px-2.5 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs font-medium transition-colors"
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
                <button
                  onClick={() => handleDelete(b.asset)}
                  disabled={deletingAsset === b.asset}
                  className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                  title="Delete balance row"
                >
                  {deletingAsset === b.asset ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            </div>

            {/* Edit form */}
            {isEditing && (
              <div className="border-t border-gray-700/50 px-4 pb-4 pt-3 space-y-3">
                {/* Op picker */}
                <div className="grid grid-cols-3 gap-2">
                  {CRYPTO_OPS.map(({ key, label, icon: Icon, color }) => (
                    <button key={key} type="button" onClick={() => setOperation(key)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                        operation === key ? `${color} border-current bg-current/10` : 'text-gray-500 border-gray-700 hover:text-gray-300'
                      }`}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
                <input
                  type="number" min="0" step="any" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Amount in ${b.asset}`}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {preview !== null && (
                  <p className={`text-xs ${previewNegative ? 'text-red-400' : 'text-gray-400'}`}>
                    Result: <span className="font-mono font-medium">{preview.toFixed(8).replace(/\.?0+$/, '')}</span> {b.asset}
                    {previewNegative && ' — cannot go negative'}
                  </p>
                )}
                <input
                  type="text" value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason / admin note (required)"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  onClick={() => handleAdjust(b.asset)}
                  disabled={submitting || !amount || !note.trim() || previewNegative}
                  className={`w-full py-2 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                    CRYPTO_OPS.find(o => o.key === operation)?.btnColor || 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {submitting ? 'Saving...' : `${CRYPTO_OPS.find(o => o.key === operation)?.label} ${b.asset}`}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add new balance */}
      {availableForNew.length > 0 && !showNewForm && (
        <button
          onClick={() => setShowNewForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-700 hover:border-gray-600 rounded-xl text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <Plus size={14} /> Add Asset Balance
        </button>
      )}

      {showNewForm && (
        <form onSubmit={handleAddNew} className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Add New Asset Balance</p>
          <select
            value={newAsset} onChange={(e) => setNewAsset(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Select asset…</option>
            {availableForNew.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input
            type="number" min="0" step="any" value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="Initial balance amount"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)}
            placeholder="Reason / admin note (required)"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={addingNew || !newAsset || !newAmount || !newNote.trim()}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {addingNew ? 'Adding…' : 'Add Balance'}
            </button>
            <button type="button" onClick={() => { setShowNewForm(false); setNewAsset(''); setNewAmount(''); setNewNote(''); }}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Main BalanceModal with Fiat / Crypto tabs ──────────────────────────────────
function BalanceModal({ user, onClose, onSuccess }) {
  const [tab, setTab]               = useState('fiat'); // 'fiat' | 'crypto'
  const [operation, setOperation]   = useState('add');
  const [amount, setAmount]         = useState('');
  const [note, setNote]             = useState('');
  const [loading, setLoading]       = useState(false);
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
      setAmount(''); setNote('');
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
      setShowLockForm(false); setLockReason('');
    } catch (err) {
      toast.error(err.message || 'Failed to update lock');
    } finally {
      setLockLoading(false);
    }
  };

  const op = OPERATIONS.find((o) => o.key === operation);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h3 className="text-lg font-semibold text-white">Manage Balance</h3>
            <p className="text-sm text-gray-400">{user.full_name || user.username} · {user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 pb-0">
          {[
            { key: 'fiat',   label: 'Fiat (USD)' },
            { key: 'crypto', label: 'Crypto Wallets' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors border-b-2 ${
                tab === key
                  ? 'text-emerald-400 border-emerald-500 bg-gray-800/50'
                  : 'text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6">
          {tab === 'fiat' && (
            <>
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
                    <p className="text-xs text-gray-500 max-w-[140px] text-right">{portfolio.balance_locked_reason}</p>
                  )}
                </div>
              </div>

              {/* Operation tabs */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Operation</p>
                <div className="grid grid-cols-3 gap-2">
                  {OPERATIONS.map(({ key, label, icon: Icon, color }) => (
                    <button key={key} type="button" onClick={() => setOperation(key)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-colors ${
                        operation === key ? `${color} border-current bg-current/10` : 'text-gray-500 border-gray-800 hover:border-gray-700 hover:text-gray-300'
                      }`}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fiat form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Amount (USD) <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <DollarSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00" required
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
                  <label className="block text-xs text-gray-500 mb-1.5">Reason / Admin note <span className="text-red-400">*</span></label>
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Bonus credit, Fee reversal, Manual correction..." required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <button type="submit" disabled={loading || !amount || !note.trim() || previewNegative}
                  className={`w-full py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${op?.btnColor}`}
                >
                  {loading ? 'Updating...' : op?.label}
                </button>
              </form>

              {/* Lock / Unlock */}
              <div className="border-t border-gray-800 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-white">{isLocked ? 'Unlock Balance' : 'Lock Balance'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isLocked ? 'Allow this user to deposit and withdraw again' : 'Prevent this user from making any transactions'}
                    </p>
                  </div>
                  {!showLockForm && (
                    <button
                      onClick={() => isLocked ? handleLockToggle() : setShowLockForm(true)}
                      disabled={lockLoading}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                        isLocked ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      {lockLoading ? <RefreshCw size={12} className="animate-spin" /> : isLocked ? <Unlock size={12} /> : <Lock size={12} />}
                      {isLocked ? 'Unlock' : 'Lock'}
                    </button>
                  )}
                </div>
                {showLockForm && !isLocked && (
                  <div className="space-y-2">
                    <input type="text" value={lockReason} onChange={(e) => setLockReason(e.target.value)}
                      placeholder="Reason for locking (e.g. Suspicious activity)..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleLockToggle} disabled={lockLoading || !lockReason.trim()}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        {lockLoading ? 'Locking...' : 'Confirm Lock'}
                      </button>
                      <button onClick={() => { setShowLockForm(false); setLockReason(''); }}
                        className="px-4 py-2 text-gray-400 hover:text-white text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'crypto' && <CryptoBalancePanel user={user} />}
        </div>
      </div>
    </div>
  );
}

// Mobile user card
function UserCard({ u, onBalanceClick, onAdminToggle, onStatusToggle, actionLoading }) {
  const [expanded, setExpanded] = useState(false);
  const bal = u.portfolio?.cash_balance;
  const isLocked = u.portfolio?.balance_locked;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <User size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">{u.full_name || u.username || '—'}</p>
            <p className="text-gray-500 text-xs">{u.email}</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-500 p-1">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_COLORS[u.status] || 'bg-gray-800 text-gray-400'}`}>
          {u.status || 'active'}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${KYC_TIER_COLORS[u.kyc_tier] || 'bg-gray-800 text-gray-400'}`}>
          {u.kyc_tier || 'basic'}{u.kyc_verified && ' ✓'}
        </span>
        {u.is_admin && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <Shield size={11} /> Admin
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Balance</p>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-semibold text-sm">{bal !== undefined ? fmt(bal) : '—'}</span>
            {isLocked && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500/15 text-red-400 text-[10px] rounded">
                <Lock size={9} /> Locked
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-600">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</p>
      </div>

      {expanded && (
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-800">
          <button
            onClick={() => onBalanceClick(u)}
            disabled={!u.portfolio}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 rounded-lg text-xs transition-colors"
          >
            <DollarSign size={12} /> Balance
          </button>
          <button
            onClick={() => onAdminToggle(u.id, u.is_admin)}
            disabled={actionLoading === u.id + '-admin'}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50 ${
              u.is_admin
                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400'
                : 'bg-gray-800 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400'
            }`}
          >
            {u.is_admin ? <ShieldOff size={12} /> : <Shield size={12} />}
            {u.is_admin ? 'Revoke' : 'Admin'}
          </button>
          <button
            onClick={() => onStatusToggle(u.id, u.status)}
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
      )}
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Users</h1>
          <p className="text-gray-400 text-sm mt-1">Manage accounts, balances, and permissions</p>
        </div>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
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

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-9 h-9 bg-gray-800 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-32" />
                  <div className="h-3 bg-gray-800 rounded w-48" />
                </div>
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No users found.</div>
        ) : (
          filtered.map((u) => (
            <UserCard
              key={u.id}
              u={u}
              onBalanceClick={setBalanceTarget}
              onAdminToggle={handleAdminToggle}
              onStatusToggle={handleStatusToggle}
              actionLoading={actionLoading}
            />
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
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
                          <button
                            onClick={() => setBalanceTarget(u)}
                            disabled={!u.portfolio}
                            title="Manage balance"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-40 rounded-lg text-xs transition-colors"
                          >
                            <DollarSign size={12} />
                            Balance
                          </button>
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
