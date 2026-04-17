import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, Plus, Pencil, Trash2, Check, X, Copy, CheckCheck,
  ToggleLeft, ToggleRight, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  getAllMasterWallets,
  addMasterWallet,
  updateMasterWallet,
  toggleMasterWalletActive,
  deleteMasterWallet,
} from '@/lib/api/cryptoDeposits';

const COMMON_ASSETS = [
  'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL',
  'XRP', 'ADA', 'DOGE', 'TRX', 'LTC', 'MATIC',
];

const COMMON_NETWORKS = [
  'Bitcoin',
  'Ethereum (ERC-20)',
  'BNB Smart Chain (BEP-20)',
  'Tron (TRC-20)',
  'Solana',
  'Polygon',
  'Avalanche',
  'Arbitrum One',
  'Optimism',
  'Base',
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="text-gray-400 hover:text-white transition-colors p-1 rounded shrink-0"
      title="Copy address"
    >
      {copied
        ? <CheckCheck size={13} className="text-emerald-400" />
        : <Copy size={13} />}
    </button>
  );
}

function WalletModal({ initial, onSave, onClose }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    asset:   initial?.asset   ?? '',
    network: initial?.network ?? '',
    address: initial?.address ?? '',
    label:   initial?.label   ?? '',
  });
  const [customNetwork, setCustomNetwork] = useState('');
  const [saving, setSaving] = useState(false);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const effectiveNetwork = COMMON_NETWORKS.includes(form.network)
    ? form.network
    : (customNetwork || form.network);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const net = effectiveNetwork.trim();
    if (!form.asset.trim() || !net || !form.address.trim()) {
      toast.error('Asset, network, and address are required');
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form, network: net });
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to save wallet');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Wallet size={16} className="text-emerald-400" />
            {isEdit ? 'Edit Wallet Address' : 'Add Deposit Wallet'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!isEdit ? (
            <>
              {/* Asset picker */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Asset Symbol *</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_ASSETS.map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => upd('asset', a)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
                        form.asset === a
                          ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500'
                          : 'bg-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <input
                  value={form.asset}
                  onChange={e => upd('asset', e.target.value.toUpperCase())}
                  placeholder="Or type custom symbol (e.g. LINK)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Network picker */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Network *</label>
                <select
                  value={COMMON_NETWORKS.includes(form.network) ? form.network : '__custom__'}
                  onChange={e => {
                    if (e.target.value === '__custom__') {
                      upd('network', '');
                    } else {
                      upd('network', e.target.value);
                      setCustomNetwork('');
                    }
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Select network…</option>
                  {COMMON_NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                  <option value="__custom__">Other / custom…</option>
                </select>
                {(!COMMON_NETWORKS.includes(form.network)) && (
                  <input
                    value={customNetwork}
                    onChange={e => setCustomNetwork(e.target.value)}
                    placeholder="Type custom network name"
                    className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-gray-800/60 rounded-lg">
              <span className="text-sm font-mono font-bold text-emerald-400">{initial.asset}</span>
              <span className="text-gray-600">·</span>
              <span className="text-sm text-gray-400">{initial.network}</span>
            </div>
          )}

          {/* Address */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Wallet Address *</label>
            <input
              value={form.address}
              onChange={e => upd('address', e.target.value.trim())}
              placeholder="0x… or bc1…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Label (optional)</label>
            <input
              value={form.label}
              onChange={e => upd('label', e.target.value)}
              placeholder="e.g. Hot Wallet, Cold Storage"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-gray-400 border border-gray-700 rounded-lg text-sm hover:text-white hover:border-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {saving
                ? <RefreshCw size={14} className="animate-spin" />
                : <Check size={14} />}
              {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Wallet')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminDepositAddresses() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);

  const { data: wallets = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-master-wallets'],
    queryFn: getAllMasterWallets,
  });

  const addMutation = useMutation({
    mutationFn: addMasterWallet,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-master-wallets'] });
      qc.invalidateQueries({ queryKey: ['masterWallets'] });
      toast.success('Wallet address added');
    },
    onError: (e) => toast.error(e.message || 'Failed to add wallet'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, address, label }) => updateMasterWallet(id, { address, label }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-master-wallets'] });
      qc.invalidateQueries({ queryKey: ['masterWallets'] });
      toast.success('Wallet address updated');
    },
    onError: (e) => toast.error(e.message || 'Failed to update wallet'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => toggleMasterWalletActive(id, is_active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-master-wallets'] });
      qc.invalidateQueries({ queryKey: ['masterWallets'] });
    },
    onError: (e) => toast.error(e.message || 'Failed to toggle status'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMasterWallet,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-master-wallets'] });
      qc.invalidateQueries({ queryKey: ['masterWallets'] });
      toast.success('Wallet address removed');
    },
    onError: (e) => toast.error(e.message || 'Failed to remove wallet'),
  });

  const handleSave = async (form) => {
    if (editEntry) {
      await updateMutation.mutateAsync({ id: editEntry.id, address: form.address, label: form.label });
    } else {
      await addMutation.mutateAsync(form);
    }
  };

  const handleDelete = (wallet) => {
    if (!confirm(`Remove the ${wallet.asset} (${wallet.network}) wallet? Users will see "coming soon" for this coin.`)) return;
    deleteMutation.mutate(wallet.id);
  };

  const openAdd = () => { setEditEntry(null); setShowModal(true); };
  const openEdit = (w) => { setEditEntry(w); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditEntry(null); };

  const grouped = wallets.reduce((acc, w) => {
    if (!acc[w.asset]) acc[w.asset] = [];
    acc[w.asset].push(w);
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Deposit Addresses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
            Configure the platform's receive addresses per coin and network.
            Users see these when making crypto deposits. Inactive addresses are hidden from users.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={16} /> Add Wallet
          </button>
        </div>
      </div>

      {/* Setup notice */}
      <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
        <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Requires the <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">master_wallets</code> table.
          If you see an error below, run <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">sql/crypto-deposits-migration.sql</code> in the Supabase SQL Editor first.
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error.message}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-16 mb-4" />
              <div className="h-10 bg-gray-100 dark:bg-gray-800/50 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && wallets.length === 0 && (
        <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-14 text-center">
          <Wallet size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No deposit addresses configured</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 mb-5">
            Users will see "coming soon" for all crypto deposits until you add at least one address.
          </p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={14} /> Add First Wallet
          </button>
        </div>
      )}

      {/* Wallet groups by asset */}
      {!isLoading && wallets.length > 0 && (
        <div className="space-y-3">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([asset, entries]) => (
              <div
                key={asset}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden"
              >
                {/* Asset header */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                  <span className="text-sm font-bold font-mono text-gray-900 dark:text-white">{asset}</span>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <span className="text-xs text-gray-400">
                    {entries.length} network{entries.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <span className={`text-xs font-medium ${entries.some(e => e.is_active) ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {entries.filter(e => e.is_active).length} active
                  </span>
                </div>

                {/* Network rows */}
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {entries.map(w => (
                    <div
                      key={w.id}
                      className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-opacity ${!w.is_active ? 'opacity-50' : ''}`}
                    >
                      {/* Address info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{w.network}</span>
                          {w.label && (
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded">
                              {w.label}
                            </span>
                          )}
                          {!w.is_active && (
                            <span className="text-[10px] bg-red-100 dark:bg-red-500/10 text-red-500 px-2 py-0.5 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs text-gray-800 dark:text-gray-300 font-mono truncate max-w-[260px] sm:max-w-md">
                            {w.address}
                          </code>
                          <CopyButton text={w.address} />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle active */}
                        <button
                          onClick={() => toggleMutation.mutate({ id: w.id, is_active: !w.is_active })}
                          disabled={toggleMutation.isPending}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            w.is_active
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
                          title={w.is_active ? 'Click to deactivate' : 'Click to activate'}
                        >
                          {w.is_active
                            ? <ToggleRight size={14} />
                            : <ToggleLeft size={14} />}
                          {w.is_active ? 'Active' : 'Inactive'}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => openEdit(w)}
                          className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                          title="Edit address or label"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(w)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                          title="Remove this wallet"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Summary stats */}
      {!isLoading && wallets.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500 pt-2">
          <span>{wallets.length} total address{wallets.length !== 1 ? 'es' : ''}</span>
          <span>{wallets.filter(w => w.is_active).length} active</span>
          <span>{Object.keys(grouped).length} coin{Object.keys(grouped).length !== 1 ? 's' : ''} configured</span>
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <WalletModal
          initial={editEntry}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
