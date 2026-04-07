import { useEffect, useState, useCallback } from 'react';
import { getPlatformSettings, updatePlatformSetting } from '@/lib/api/admin';
import { toast } from 'sonner';
import { Save, RefreshCw, Settings, Percent, DollarSign, ArrowDownToLine, AlertTriangle, CheckCircle } from 'lucide-react';

const SETTING_DEFINITIONS = [
  {
    group: 'Trading',
    icon: Percent,
    color: 'bg-blue-500/15 text-blue-500',
    settings: [
      {
        key: 'trading_fee_percent',
        label: 'Trading Fee',
        description: 'Percentage charged on every buy/sell trade.',
        suffix: '%',
        min: 0,
        max: 10,
        step: 0.01,
        decimals: 2,
      },
    ],
  },
  {
    group: 'Deposits',
    icon: DollarSign,
    color: 'bg-emerald-500/15 text-emerald-500',
    settings: [
      {
        key: 'deposit_minimum_usd',
        label: 'Minimum Deposit',
        description: 'Smallest deposit amount a user can submit.',
        prefix: '$',
        suffix: 'USD',
        min: 0,
        max: 100000,
        step: 1,
        decimals: 2,
      },
    ],
  },
  {
    group: 'Withdrawals',
    icon: ArrowDownToLine,
    color: 'bg-orange-500/15 text-orange-500',
    settings: [
      {
        key: 'withdrawal_minimum_usd',
        label: 'Minimum Withdrawal',
        description: 'Smallest withdrawal a user can request.',
        prefix: '$',
        suffix: 'USD',
        min: 0,
        max: 100000,
        step: 1,
        decimals: 2,
      },
      {
        key: 'withdrawal_maximum_usd',
        label: 'Maximum Withdrawal',
        description: 'Largest single withdrawal a user can request.',
        prefix: '$',
        suffix: 'USD',
        min: 0,
        max: 10000000,
        step: 100,
        decimals: 2,
      },
      {
        key: 'withdrawal_daily_limit_usd',
        label: 'Daily Withdrawal Limit',
        description: 'Maximum total withdrawals per user per calendar day.',
        prefix: '$',
        suffix: 'USD',
        min: 0,
        max: 10000000,
        step: 100,
        decimals: 2,
      },
    ],
  },
];

function SettingRow({ def, currentValue, onSave }) {
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (currentValue !== undefined) {
      setDraft(String(Number(currentValue).toFixed(def.decimals ?? 2)));
      setDirty(false);
    }
  }, [currentValue, def.decimals]);

  const handleChange = (e) => {
    setDraft(e.target.value);
    setDirty(e.target.value !== String(Number(currentValue).toFixed(def.decimals ?? 2)));
    setSaved(false);
  };

  const handleSave = async () => {
    const num = parseFloat(draft);
    if (isNaN(num) || num < def.min || num > def.max) {
      toast.error(`Value must be between ${def.min} and ${def.max}`);
      return;
    }
    setSaving(true);
    try {
      await onSave(def.key, num);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && dirty) handleSave();
    if (e.key === 'Escape') {
      setDraft(String(Number(currentValue).toFixed(def.decimals ?? 2)));
      setDirty(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{def.label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{def.description}</p>
        <p className="text-xs text-gray-300 dark:text-gray-600 mt-0.5 font-mono">
          Range: {def.prefix || ''}{def.min} – {def.prefix || ''}{def.max.toLocaleString()} {def.suffix || ''}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex items-center">
          {def.prefix && (
            <span className="absolute left-3 text-sm text-gray-400 dark:text-gray-500 select-none pointer-events-none">
              {def.prefix}
            </span>
          )}
          <input
            type="number"
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            min={def.min}
            max={def.max}
            step={def.step}
            className={`w-36 bg-gray-50 dark:bg-gray-800 border rounded-lg py-2 text-sm text-gray-900 dark:text-white text-right pr-10 focus:outline-none focus:ring-1 transition-colors
              ${def.prefix ? 'pl-6' : 'pl-3'}
              ${dirty
                ? 'border-amber-400 dark:border-amber-500 focus:ring-amber-400'
                : 'border-gray-300 dark:border-gray-700 focus:ring-emerald-500'
              }`}
          />
          {def.suffix && (
            <span className="absolute right-3 text-xs text-gray-400 dark:text-gray-500 select-none pointer-events-none">
              {def.suffix === 'USD' ? '' : def.suffix}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed
            ${saved
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
        >
          {saving ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : saved ? (
            <CheckCircle size={12} />
          ) : (
            <Save size={12} />
          )}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlatformSettings();
      setSettings(data);
    } catch (err) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async (key, value) => {
    await updatePlatformSetting(key, value);
    setSettings(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), value: String(value) },
    }));
    toast.success('Setting saved');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Fee & Limit Settings</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configure platform fees and deposit/withdrawal limits</p>
        </div>
        <button
          onClick={loadSettings}
          disabled={loading}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {error && (
        <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Database migration required</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              Run <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">sql/admin-features-migration.sql</code> in your Supabase SQL Editor before using this page.
              Settings are persisted in the <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">platform_settings</code> table.
            </p>
            <p className="text-xs text-red-500 dark:text-red-400 mt-1 font-mono">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-28 mb-4" />
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="flex justify-between py-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="space-y-1.5">
                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-36" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-52" />
                  </div>
                  <div className="h-9 bg-gray-200 dark:bg-gray-800 rounded w-40" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {SETTING_DEFINITIONS.map(({ group, icon: Icon, color, settings: defs }) => (
            <div
              key={group}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                  <Icon size={16} />
                </div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{group}</h2>
              </div>
              <div className="px-5">
                {defs.map(def => (
                  <SettingRow
                    key={def.key}
                    def={def}
                    currentValue={settings[def.key]?.value}
                    onSave={handleSave}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info note */}
      <div className="text-xs text-gray-400 dark:text-gray-600 flex items-start gap-2">
        <Settings size={12} className="shrink-0 mt-0.5" />
        <span>
          Changes take effect for new transactions. Existing in-progress transactions are not affected.
          Every save is recorded in the Admin Audit Log.
        </span>
      </div>
    </div>
  );
}
