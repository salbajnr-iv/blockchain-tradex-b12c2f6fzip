import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight,
  TrendingUp, TrendingDown, BarChart3, Shield, Percent, Flame,
  Clock, Layers, Gem, Palette, Loader2, X, Package, ChevronDown,
  RefreshCw, AlertCircle, CheckCircle, Building2, Briefcase, Sparkles,
} from 'lucide-react';
import {
  INVESTMENT_CATEGORIES,
  INVESTMENT_INSTRUMENTS,
  getCategoryById,
  REGIONS,
  getRegionById,
} from '@/lib/investmentCatalog';
import {
  getInvestmentCatalog,
  getInvestmentOverrides,
  toggleInstrumentEnabled,
  updateInstrumentPrice,
  addCustomInstrument,
  deleteCustomInstrument,
  updateCustomInstrument,
} from '@/lib/api/investments';
import { logAdminAction } from '@/lib/api/admin';

const ICON_MAP = {
  TrendingUp, BarChart3, Shield, Percent, Flame, Clock, Layers, Gem, Palette,
  Building2, Briefcase, Sparkles,
};

const STATUS_COLORS = {
  enabled:  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  disabled: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

// ─── Edit Price Modal ────────────────────────────────────────────────────────
function EditPriceModal({ instrument, onClose, onSave }) {
  const [price, setPrice] = useState(String(instrument.price));
  const [changePct, setChangePct] = useState(String(instrument.changePct24h ?? 0));
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    const p = parseFloat(price);
    const c = parseFloat(changePct);
    if (isNaN(p) || p <= 0) { toast.error('Enter a valid price'); return; }
    if (isNaN(c)) { toast.error('Enter a valid 24h change %'); return; }
    setLoading(true);
    await onSave(instrument.id, p, c);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Edit Price</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{instrument.name} · {instrument.symbol}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">Price (USD) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number" step="any" min="0" required
                value={price} onChange={(e) => setPrice(e.target.value)}
                className="w-full pl-7 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">24h Change % *</label>
            <div className="relative">
              <input
                type="number" step="any" required
                value={changePct} onChange={(e) => setChangePct(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors flex items-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Saving...' : 'Save Price'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add / Edit Custom Instrument Modal ─────────────────────────────────────
const EMPTY_CUSTOM = {
  category: 'stocks', region: 'US', name: '', symbol: '', icon: '★', price: '',
  changePct24h: '', marketCap: '', volume24h: '', exchange: '',
  minInvestment: '1', description: '', yield: '', maturity: '', rating: '',
};

function CustomInstrumentModal({ existing, onClose, onSave }) {
  const [form, setForm] = useState(existing ? {
    ...existing,
    price: String(existing.price),
    changePct24h: String(existing.changePct24h ?? 0),
    minInvestment: String(existing.minInvestment ?? 1),
  } : EMPTY_CUSTOM);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.symbol.trim() || !form.price) {
      toast.error('Name, symbol and price are required'); return;
    }
    setLoading(true);
    const payload = {
      ...form,
      price: parseFloat(form.price),
      changePct24h: parseFloat(form.changePct24h) || 0,
      change24h: (parseFloat(form.price) * (parseFloat(form.changePct24h) || 0)) / 100,
      minInvestment: parseFloat(form.minInvestment) || 1,
      currency: 'USD',
    };
    await onSave(payload);
    setLoading(false);
  };

  const cats = INVESTMENT_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-t-2xl sm:rounded-xl p-6 w-full sm:max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {existing ? 'Edit Instrument' : 'Add New Instrument'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Name *</label>
              <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Apple Inc."
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Symbol *</label>
              <input required value={form.symbol} onChange={(e) => set('symbol', e.target.value.toUpperCase())} placeholder="AAPL"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Category *</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
                {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Region</label>
              <select value={form.region ?? 'US'} onChange={(e) => set('region', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
                {REGIONS.filter(r => r.id !== 'all').map((r) => <option key={r.id} value={r.id}>{r.flag} {r.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Icon (emoji / text)</label>
              <input value={form.icon} onChange={(e) => set('icon', e.target.value)} placeholder="🍎"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Yield (optional)</label>
              <input value={form.yield ?? ''} onChange={(e) => set('yield', e.target.value)} placeholder="4.5%"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Price (USD) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input required type="number" step="any" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00"
                  className="w-full pl-7 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">24h Change %</label>
              <div className="relative">
                <input type="number" step="any" value={form.changePct24h} onChange={(e) => set('changePct24h', e.target.value)} placeholder="0.00"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Min. Investment ($)</label>
              <input type="number" min="0" step="any" value={form.minInvestment} onChange={(e) => set('minInvestment', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Exchange</label>
              <input value={form.exchange} onChange={(e) => set('exchange', e.target.value)} placeholder="NYSE"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Market Cap</label>
              <input value={form.marketCap} onChange={(e) => set('marketCap', e.target.value)} placeholder="$2.5T"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
          </div>

          {/* Bond / Fixed income extra fields */}
          {(form.category === 'bonds' || form.category === 'fixed_income') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Maturity</label>
                <input value={form.maturity} onChange={(e) => set('maturity', e.target.value)} placeholder="10 Years"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Credit Rating</label>
                <input value={form.rating} onChange={(e) => set('rating', e.target.value)} placeholder="AAA"
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2}
              placeholder="Brief description of this instrument..."
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none" />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors flex items-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Saving...' : existing ? 'Save Changes' : 'Add Instrument'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminInvestments() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [editPriceTarget, setEditPriceTarget] = useState(null);
  const [customModal, setCustomModal] = useState(null); // null | 'new' | { ...existingCustom }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const { data: catalog = [], isLoading, refetch } = useQuery({
    queryKey: ['admin_investment_catalog'],
    queryFn: getInvestmentCatalog,
    staleTime: 0,
  });

  // Stats
  const stats = useMemo(() => {
    const total = catalog.length;
    const enabled = catalog.filter((i) => i.enabled !== false).length;
    const custom = catalog.filter((i) => i.id?.startsWith('CUSTOM_')).length;
    const byCat = {};
    INVESTMENT_CATEGORIES.forEach((c) => { byCat[c.id] = catalog.filter((i) => i.category === c.id).length; });
    return { total, enabled, disabled: total - enabled, custom, byCat };
  }, [catalog]);

  // Filtered list
  const displayed = useMemo(() => {
    let list = [...catalog];
    if (category !== 'all') list = list.filter((i) => i.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.symbol?.toLowerCase().includes(q));
    }
    return list;
  }, [catalog, category, search]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleToggle = async (instrument) => {
    const newState = instrument.enabled === false ? true : false;
    setActionLoading(instrument.id + '_toggle');
    try {
      await toggleInstrumentEnabled(instrument.id, newState);
      toast.success(`${instrument.name} ${newState ? 'enabled' : 'disabled'}`);
      queryClient.invalidateQueries(['admin_investment_catalog']);
      queryClient.invalidateQueries(['investment_catalog']);
    } catch (err) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePriceSave = async (id, price, changePct) => {
    try {
      await updateInstrumentPrice(id, price, changePct);
      toast.success('Price updated');
      setEditPriceTarget(null);
      queryClient.invalidateQueries(['admin_investment_catalog']);
      queryClient.invalidateQueries(['investment_catalog']);
    } catch (err) {
      toast.error(err.message || 'Failed to update price');
    }
  };

  const handleAddCustom = async (payload) => {
    try {
      await addCustomInstrument(payload);
      toast.success(`${payload.name} added`);
      setCustomModal(null);
      queryClient.invalidateQueries(['admin_investment_catalog']);
      queryClient.invalidateQueries(['investment_catalog']);
    } catch (err) {
      toast.error(err.message || 'Failed to add instrument');
    }
  };

  const handleEditCustom = async (payload) => {
    try {
      await updateCustomInstrument(customModal.id, payload);
      toast.success('Instrument updated');
      setCustomModal(null);
      queryClient.invalidateQueries(['admin_investment_catalog']);
      queryClient.invalidateQueries(['investment_catalog']);
    } catch (err) {
      toast.error(err.message || 'Failed to update instrument');
    }
  };

  const handleDeleteCustom = async (instrument) => {
    setActionLoading(instrument.id + '_delete');
    try {
      await deleteCustomInstrument(instrument.id);
      toast.success(`${instrument.name} deleted`);
      setDeleteTarget(null);
      queryClient.invalidateQueries(['admin_investment_catalog']);
      queryClient.invalidateQueries(['investment_catalog']);
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  const isCustom = (inst) => inst.id?.startsWith('CUSTOM_');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Investment Catalog</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage investment instruments — toggle visibility, update prices and add new offerings.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => { refetch(); queryClient.invalidateQueries(['investment_catalog']); }}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setCustomModal('new')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={16} />
            Add Instrument
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Instruments', value: stats.total, color: 'text-gray-900 dark:text-white' },
          { label: 'Active', value: stats.enabled, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Disabled', value: stats.disabled, color: 'text-red-600 dark:text-red-400' },
          { label: 'Custom Added', value: stats.custom, color: 'text-blue-600 dark:text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button onClick={() => setCategory('all')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            category === 'all' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}>
          All ({stats.total})
        </button>
        {INVESTMENT_CATEGORIES.map((cat) => {
          const Icon = ICON_MAP[cat.icon] ?? TrendingUp;
          const active = category === cat.id;
          return (
            <button key={cat.id} onClick={() => setCategory(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                active ? `${cat.bg} ${cat.text} ${cat.border}` : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}>
              <Icon size={12} />
              {cat.label} ({stats.byCat[cat.id] ?? 0})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or symbol..."
          className="w-full pl-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center gap-3 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading catalog…</span>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Package size={32} className="text-gray-300 dark:text-gray-700 mx-auto" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No instruments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Instrument</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">24h</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden lg:table-cell">Min. Inv.</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {displayed.map((inst) => {
                  const cat = getCategoryById(inst.category);
                  const Icon = cat ? (ICON_MAP[cat.icon] ?? TrendingUp) : TrendingUp;
                  const up = (inst.changePct24h ?? 0) >= 0;
                  const enabled = inst.enabled !== false;
                  const custom = isCustom(inst);
                  const isToggling = actionLoading === inst.id + '_toggle';
                  const isDeleting = actionLoading === inst.id + '_delete';

                  const fmtP = (n) => {
                    if (!n) return '$0.00';
                    if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
                    if (n >= 1)    return `$${n.toFixed(4)}`;
                    return `$${n.toFixed(6)}`;
                  };

                  return (
                    <tr key={inst.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${!enabled ? 'opacity-50' : ''}`}>
                      {/* Instrument */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${cat?.bg || 'bg-gray-100 dark:bg-gray-800'} flex items-center justify-center text-sm font-bold shrink-0`}>
                            {inst.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{inst.name}</p>
                              {custom && <span className="text-[9px] font-bold bg-blue-500/15 text-blue-500 px-1.5 py-0.5 rounded">CUSTOM</span>}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{inst.symbol}</p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cat?.bg || ''} ${cat?.text || ''}`}>
                          <Icon size={10} />
                          {cat?.label ?? inst.category}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{fmtP(inst.price)}</span>
                      </td>

                      {/* 24h */}
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {up ? '+' : ''}{inst.changePct24h?.toFixed(2)}%
                        </span>
                      </td>

                      {/* Min inv */}
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="text-xs text-gray-500 dark:text-gray-400">${inst.minInvestment ?? 1}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${enabled ? STATUS_COLORS.enabled : STATUS_COLORS.disabled}`}>
                          {enabled ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                          {enabled ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit price */}
                          <button onClick={() => setEditPriceTarget(inst)} title="Edit price"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                            <Edit2 size={14} />
                          </button>

                          {/* Toggle enable/disable */}
                          <button onClick={() => handleToggle(inst)} disabled={isToggling} title={enabled ? 'Disable' : 'Enable'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                              enabled
                                ? 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                                : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                            }`}>
                            {isToggling ? <Loader2 size={14} className="animate-spin" /> : enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          </button>

                          {/* Edit custom / Delete custom */}
                          {custom && (
                            <>
                              <button onClick={() => setCustomModal(inst)} title="Edit instrument"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => setDeleteTarget(inst)} disabled={isDeleting} title="Delete instrument"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50">
                                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Footer */}
        {!isLoading && displayed.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">Showing {displayed.length} of {catalog.length} instruments</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{stats.enabled} active · {stats.disabled} disabled</p>
          </div>
        )}
      </div>

      {/* Category breakdown */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Instruments by Category</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {INVESTMENT_CATEGORIES.map((cat) => {
            const Icon = ICON_MAP[cat.icon] ?? TrendingUp;
            const count = stats.byCat[cat.id] ?? 0;
            return (
              <button key={cat.id} onClick={() => setCategory(cat.id === category ? 'all' : cat.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center ${
                  category === cat.id ? `${cat.bg} ${cat.border}` : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                }`}>
                <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center`}>
                  <Icon size={14} className={cat.text} />
                </div>
                <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 leading-tight">{cat.label}</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {editPriceTarget && (
        <EditPriceModal
          instrument={editPriceTarget}
          onClose={() => setEditPriceTarget(null)}
          onSave={handlePriceSave}
        />
      )}

      {customModal === 'new' && (
        <CustomInstrumentModal
          onClose={() => setCustomModal(null)}
          onSave={handleAddCustom}
        />
      )}

      {customModal && customModal !== 'new' && (
        <CustomInstrumentModal
          existing={customModal}
          onClose={() => setCustomModal(null)}
          onSave={handleEditCustom}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Delete Instrument?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Cancel</button>
              <button onClick={() => handleDeleteCustom(deleteTarget)}
                disabled={actionLoading === deleteTarget.id + '_delete'}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors flex items-center gap-2">
                {actionLoading === deleteTarget.id + '_delete' && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
