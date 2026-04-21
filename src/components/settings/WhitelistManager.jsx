import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  getWhitelist,
  addWhitelistEntry,
  removeWhitelistEntry,
} from '@/lib/api/userControls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Wallet, Plus, Trash2, Loader2, Lock, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ASSET_OPTIONS = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'BNB', 'MATIC', 'TRX', 'XRP', 'LTC'];

function shortAddress(addr) {
  if (!addr) return '';
  return addr.length > 16 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr;
}

export default function WhitelistManager({ whitelistOnly }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const [asset, setAsset] = useState('BTC');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');

  const load = async () => {
    if (!user?.id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      setItems(await getWhitelist(user.id));
    } catch (err) {
      toast.error(err.message || 'Failed to load whitelist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!asset) { toast.error('Pick an asset'); return; }
    const trimmed = address.trim();
    if (!trimmed || trimmed.length < 10) { toast.error('Enter a valid wallet address'); return; }
    setAdding(true);
    try {
      await addWhitelistEntry(user.id, asset, trimmed, label.trim() || null);
      toast.success(`${asset} address added to whitelist`);
      setAddress(''); setLabel('');
      await load();
    } catch (err) {
      toast.error(err.message || 'Failed to add address');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (entry) => {
    const ok = await confirm({
      title: 'Remove whitelisted address',
      description: `Remove ${entry.label || shortAddress(entry.address)} (${entry.asset}) from your withdrawal whitelist? You will need to re-add it before withdrawing to this address again.`,
      confirmText: 'Remove address',
      tone: 'danger',
    });
    if (!ok) return;
    setRemovingId(entry.id);
    try {
      await removeWhitelistEntry(entry.id, user.id);
      toast.success('Address removed');
      setItems((prev) => prev.filter((x) => x.id !== entry.id));
    } catch (err) {
      toast.error(err.message || 'Failed to remove address');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Withdrawal Whitelist
        </h2>
        {whitelistOnly && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
            <Lock className="w-3 h-3" /> Enforced
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {whitelistOnly
          ? 'Whitelist mode is active. Crypto withdrawals are only allowed to addresses in this list.'
          : 'Add trusted crypto addresses for fast, safe withdrawals. Whitelist mode can be turned on by support to require all withdrawals go to these addresses.'}
      </p>

      {/* Add form */}
      <form onSubmit={handleAdd} className="bg-secondary/30 border border-border/40 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Asset</label>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-md bg-background border border-border/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {ASSET_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Label <span className="text-muted-foreground/60">(optional)</span></label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. My Ledger, Cold storage"
              className="mt-1 bg-background"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{asset} Wallet Address</label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={`Paste your ${asset} address`}
            className="mt-1 bg-background font-mono text-sm"
          />
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Double-check the address. We treat each entry as trusted — if your account is configured for whitelist-only withdrawals, removing or adding entries can take effect immediately.</span>
        </div>
        <Button type="submit" disabled={adding} className="gap-2">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {adding ? 'Adding…' : 'Add to Whitelist'}
        </Button>
      </form>

      {/* List */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Saved addresses {items.length > 0 && <span className="text-foreground">({items.length})</span>}
        </h3>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center bg-secondary/20 rounded-lg">
            No whitelisted addresses yet.
          </p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence>
              {items.map((entry) => (
                <motion.li
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-background/50"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/15 text-primary shrink-0">
                    {entry.asset}
                  </span>
                  <div className="min-w-0 flex-1">
                    {entry.label && <p className="text-sm font-medium text-foreground truncate">{entry.label}</p>}
                    <p className="text-xs text-muted-foreground font-mono truncate">{shortAddress(entry.address)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(entry)}
                    disabled={removingId === entry.id}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    title="Remove from whitelist"
                  >
                    {removingId === entry.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
