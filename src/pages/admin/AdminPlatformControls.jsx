import { useEffect, useState } from 'react';
import {
  getFeatureFlags,
  setFeatureFlag,
  getIpBlocklist,
  addIpBlock,
  removeIpBlock,
  getCountryBlocklist,
  addCountryBlock,
  removeCountryBlock,
} from '@/lib/api/platform';
import { toast } from '@/lib/toast';
import { Power, Globe, Shield, Trash2, Plus, RefreshCw, AlertTriangle } from 'lucide-react';

export default function AdminPlatformControls() {
  const [flags, setFlags] = useState({});
  const [ips, setIps] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState('');
  const [newIpReason, setNewIpReason] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newCountryReason, setNewCountryReason] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [f, i, c] = await Promise.all([
        getFeatureFlags(),
        getIpBlocklist(),
        getCountryBlocklist(),
      ]);
      setFlags(f);
      setIps(i);
      setCountries(c);
    } catch (e) {
      toast.error(e.message || 'Failed to load');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleFlag = async (key, current) => {
    try {
      await setFeatureFlag(key, !current);
      setFlags((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !current } }));
      toast.success(`${key} ${!current ? 'enabled' : 'disabled'}`);
    } catch (e) {
      toast.error(e.message || 'Failed');
    }
  };

  const handleAddIp = async (e) => {
    e.preventDefault();
    if (!newIp.trim()) return;
    try {
      await addIpBlock(newIp.trim(), newIpReason || null);
      setNewIp(''); setNewIpReason('');
      load();
      toast.success('IP blocked');
    } catch (e) { toast.error(e.message || 'Failed'); }
  };

  const handleAddCountry = async (e) => {
    e.preventDefault();
    if (!newCountry.trim()) return;
    try {
      await addCountryBlock(newCountry.trim().toUpperCase(), newCountryReason || null);
      setNewCountry(''); setNewCountryReason('');
      load();
      toast.success('Country blocked');
    } catch (e) { toast.error(e.message || 'Failed'); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Platform Controls</h1>
          <p className="text-xs text-gray-500">Maintenance mode, feature flags, and access restrictions.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Maintenance mode highlight */}
      {flags.maintenance_mode?.enabled && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={18} />
          <div className="text-sm text-amber-200">
            <strong>Maintenance mode is ON.</strong> Trades, deposits, and withdrawals are disabled platform-wide.
          </div>
        </div>
      )}

      {/* Feature flags */}
      <Section title="Feature Flags" icon={Power}>
        {loading ? (
          <Skeleton />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {Object.values(flags).map((f) => (
              <div key={f.key} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-sm">{f.key}</div>
                  <div className="text-xs text-gray-500">{f.description}</div>
                </div>
                <Toggle on={f.enabled} onChange={() => toggleFlag(f.key, f.enabled)} />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* IP blocklist */}
      <Section title="IP Blocklist" icon={Shield}>
        <form onSubmit={handleAddIp} className="flex gap-2 mb-3 flex-wrap">
          <input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="IP address" className="flex-1 min-w-[140px] px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
          <input value={newIpReason} onChange={(e) => setNewIpReason(e.target.value)} placeholder="Reason (optional)" className="flex-[2] min-w-[140px] px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
          <button type="submit" className="flex items-center gap-1 px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-500"><Plus size={14} /> Block</button>
        </form>
        {loading ? <Skeleton /> : ips.length === 0 ? (
          <p className="text-xs text-gray-500 py-3">No IPs blocked.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {ips.map((row) => (
              <Row key={row.id} primary={row.ip_address} secondary={row.reason} onDelete={() => removeIpBlock(row.id).then(load)} />
            ))}
          </div>
        )}
      </Section>

      {/* Country blocklist */}
      <Section title="Country Blocklist (ISO-2)" icon={Globe}>
        <form onSubmit={handleAddCountry} className="flex gap-2 mb-3 flex-wrap">
          <input value={newCountry} onChange={(e) => setNewCountry(e.target.value)} placeholder="e.g. KP" maxLength={2} className="w-24 px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm uppercase" />
          <input value={newCountryReason} onChange={(e) => setNewCountryReason(e.target.value)} placeholder="Reason (optional)" className="flex-1 min-w-[140px] px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
          <button type="submit" className="flex items-center gap-1 px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-500"><Plus size={14} /> Block</button>
        </form>
        {loading ? <Skeleton /> : countries.length === 0 ? (
          <p className="text-xs text-gray-500 py-3">No countries blocked.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {countries.map((row) => (
              <Row key={row.country_code} primary={row.country_code} secondary={row.reason} onDelete={() => removeCountryBlock(row.country_code).then(load)} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
        <Icon size={16} className="text-emerald-500" /> {title}
      </h2>
      {children}
    </div>
  );
}
function Toggle({ on, onChange }) {
  return (
    <button onClick={onChange} className={`relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-600'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}
function Row({ primary, secondary, onDelete }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <code className="text-sm font-mono">{primary}</code>
        {secondary && <p className="text-xs text-gray-500">{secondary}</p>}
      </div>
      <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-500/10 text-red-500"><Trash2 size={14} /></button>
    </div>
  );
}
function Skeleton() {
  return <div className="py-6 flex justify-center"><div className="w-5 h-5 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" /></div>;
}
