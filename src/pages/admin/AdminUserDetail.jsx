import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import {
  setUserFee, setUserLimits,
  getWhitelist, addWhitelistEntry, removeWhitelistEntry,
  setKycTier,
  getUserNotes, addUserNote, deleteUserNote,
  getUserTags, addUserTag, removeUserTag,
  startImpersonation,
  sendAdminMessage,
} from '@/lib/api/userControls';
import {
  adminFreezeUser, adminUnfreezeUser,
  adminForceLogout, adminRequirePasswordReset,
  adminRequireKycRenewal,
} from '@/lib/api/admin';
import { useAdmin } from '@/contexts/AdminContext';
import { toast } from '@/lib/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  ArrowLeft, Mail, Tag as TagIcon, FileText, Eye, Coins, Shield,
  Plus, Trash2, Send, ListChecks, AlertTriangle, LogOut, Key, RefreshCw, Snowflake,
} from 'lucide-react';

const KYC_TIERS = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Tier 1 — Basic' },
  { value: 2, label: 'Tier 2 — Advanced' },
  { value: 3, label: 'Tier 3 — Institutional' },
];

export default function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { can } = useAdmin();
  const confirm = useConfirm();
  const [u, setU] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newWl, setNewWl] = useState({ asset: 'BTC', address: '', label: '' });
  const [msg, setMsg] = useState({ subject: '', body: '' });

  const reload = async () => {
    setLoading(true);
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    setU(user);
    if (user) {
      const [n, t, w] = await Promise.all([
        getUserNotes(userId),
        getUserTags(userId),
        getWhitelist(userId),
      ]);
      setNotes(n); setTags(t); setWhitelist(w);
    }
    setLoading(false);
  };
  useEffect(() => { reload(); }, [userId]);

  const wrap = (fn) => async (...args) => {
    try { await fn(...args); await reload(); }
    catch (e) { toast.error(e.message || 'Failed'); }
  };

  const handleImpersonate = async () => {
    const reason = await confirm({
      title: 'Start read-only impersonation',
      description: `You are about to inspect ${u?.email || 'this account'} in read-only mode. Every action you take is audited. Provide a reason.`,
      confirmText: 'Start impersonation',
      tone: 'warning',
      input: { placeholder: 'e.g. customer support ticket #1234', required: true },
    });
    if (!reason) return;
    try {
      const sid = await startImpersonation(userId, reason);
      sessionStorage.setItem('impersonationSession', sid);
      sessionStorage.setItem('impersonationTarget', userId);
      window.dispatchEvent(new Event('impersonation:changed'));
      toast.success('Impersonation logged. Use admin views to inspect this user.');
    } catch (e) { toast.error(e.message || 'Failed'); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msg.body.trim()) return;
    try {
      await sendAdminMessage(userId, msg.subject || 'Message from BlockTrade', msg.body);
      setMsg({ subject: '', body: '' });
      toast.success('Message sent');
    } catch (e) { toast.error(e.message || 'Failed'); }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!u)      return <div className="p-8 text-center text-gray-400">User not found.</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-emerald-400">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">{u.full_name || u.email}</h1>
            <p className="text-xs text-gray-500">{u.email}  ·  {u.id}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {tags.map((t) => (
                <span key={t.id} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: (t.color || '#10b981') + '22', color: t.color || '#10b981' }}>
                  {t.tag}
                </span>
              ))}
              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/15 text-blue-400">
                KYC: {KYC_TIERS.find((k) => k.value === u.kyc_tier)?.label || 'None'}
              </span>
            </div>
          </div>
          {can('users.message') && (
            <button onClick={handleImpersonate} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-purple-500/10 text-purple-400 hover:bg-purple-500/20">
              <Eye size={14} /> Impersonate (read-only)
            </button>
          )}
        </div>
      </div>

      {/* KYC Tier */}
      <Card icon={Shield} title="KYC Tier">
        <div className="flex gap-2 flex-wrap">
          {KYC_TIERS.map((t) => (
            <button key={t.value}
              onClick={wrap(() => setKycTier(userId, t.value))}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                u.kyc_tier === t.value
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                  : 'border-gray-700 hover:bg-gray-800 text-gray-400'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Fees & Limits */}
      <Card icon={Coins} title="Fees & Limits">
        <FeesLimits u={u} reload={reload} />
      </Card>

      {/* Withdrawal whitelist */}
      <Card icon={ListChecks} title="Withdrawal Whitelist">
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" id="wlonly" checked={!!u.withdrawal_whitelist_only}
            onChange={(e) => wrap(() => setUserLimits(userId, { whitelistOnly: e.target.checked }))()} />
          <label htmlFor="wlonly" className="text-sm">Only allow withdrawals to whitelisted addresses</label>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); wrap(() => addWhitelistEntry(userId, newWl.asset, newWl.address, newWl.label))(); setNewWl({ asset: 'BTC', address: '', label: '' }); }} className="flex gap-2 mb-3 flex-wrap">
          <input value={newWl.asset} onChange={(e) => setNewWl({ ...newWl, asset: e.target.value })} placeholder="Asset" className="w-20 px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm uppercase" />
          <input value={newWl.address} onChange={(e) => setNewWl({ ...newWl, address: e.target.value })} placeholder="Address" className="flex-1 min-w-[180px] px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
          <input value={newWl.label} onChange={(e) => setNewWl({ ...newWl, label: e.target.value })} placeholder="Label" className="w-32 px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
          <button type="submit" className="flex items-center gap-1 px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-500"><Plus size={14} /> Add</button>
        </form>
        {whitelist.length === 0 ? <p className="text-xs text-gray-500">No whitelisted addresses.</p> : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {whitelist.map((w) => (
              <li key={w.id} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{w.label || w.asset}</div>
                  <code className="text-xs text-gray-500 break-all">{w.asset} · {w.address}</code>
                </div>
                <button onClick={wrap(() => removeWhitelistEntry(w.id, userId))} className="p-1.5 rounded hover:bg-red-500/10 text-red-500"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Tags */}
      <Card icon={TagIcon} title="Tags">
        <form onSubmit={(e) => { e.preventDefault(); if (newTag) { wrap(() => addUserTag(userId, newTag.trim()))(); setNewTag(''); } }} className="flex gap-2 mb-3">
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Tag (e.g. vip, fraud-watch)" className="flex-1 px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
          <button type="submit" className="flex items-center gap-1 px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-500"><Plus size={14} /> Add</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ backgroundColor: (t.color || '#10b981') + '22', color: t.color || '#10b981' }}>
              {t.tag}
              <button onClick={wrap(() => removeUserTag(t.id, userId))} className="hover:text-red-500">×</button>
            </span>
          ))}
          {tags.length === 0 && <p className="text-xs text-gray-500">No tags.</p>}
        </div>
      </Card>

      {/* Internal notes */}
      <Card icon={FileText} title="Internal Notes (admin-only)">
        <form onSubmit={(e) => { e.preventDefault(); if (newNote.trim()) { wrap(() => addUserNote(userId, newNote.trim()))(); setNewNote(''); } }} className="flex gap-2 mb-3">
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note…" className="flex-1 px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
          <button type="submit" className="flex items-center gap-1 px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-500"><Plus size={14} /> Add</button>
        </form>
        {notes.length === 0 ? <p className="text-xs text-gray-500">No notes yet.</p> : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="p-3 rounded bg-gray-50 dark:bg-gray-800/40 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <p>{n.body}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {n.author?.full_name || n.author?.email || 'Unknown'} · {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <button onClick={wrap(() => deleteUserNote(n.id, userId))} className="p-1.5 rounded hover:bg-red-500/10 text-red-500"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Account controls — danger zone */}
      {can('users.message') && (
        <DangerActions u={u} reload={reload} />
      )}

      {/* Direct message */}
      <Card icon={Mail} title="Send Direct Message">
        <form onSubmit={handleSendMessage} className="space-y-2">
          <input value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} placeholder="Subject" className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
          <textarea value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} placeholder="Message body" rows={4} className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
          <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-500"><Send size={14} /> Send</button>
        </form>
      </Card>
    </div>
  );
}

function Card({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
        <Icon size={16} className="text-emerald-500" /> {title}
      </h2>
      {children}
    </div>
  );
}

function DangerActions({ u, reload }) {
  const [busy, setBusy] = useState(null);
  const confirm = useConfirm();
  const isFrozen = u.status === 'frozen' || u.status === 'suspended';

  const run = async (key, label, confirmOpts, fn) => {
    if (confirmOpts) {
      const ok = await confirm(confirmOpts);
      if (!ok) return;
    }
    setBusy(key);
    try { await fn(); toast.success(label); await reload(); }
    catch (e) { toast.error(e.message || `${label} failed`); }
    finally { setBusy(null); }
  };

  const Action = ({ k, icon: Icon, label, danger, onClick, disabled }) => (
    <button
      onClick={onClick}
      disabled={!!busy || disabled}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition disabled:opacity-50 ${
        danger
          ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
      }`}
    >
      <Icon size={14} />
      {busy === k ? 'Working…' : label}
    </button>
  );

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold mb-1 text-red-400">
        <AlertTriangle size={16} /> Account Controls
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        These actions are audited and take effect immediately. Use them when an account needs to be re-verified, locked, or re-authenticated.
      </p>
      <div className="flex flex-wrap gap-2">
        <Action
          k="logout"
          icon={LogOut}
          label="Force Logout"
          onClick={() => run('logout', 'User signed out of all sessions', {
            title: 'Force sign-out',
            description: `Sign ${u.email} out of every active session immediately.`,
            confirmText: 'Force sign-out',
            tone: 'warning',
          }, () => adminForceLogout(u.id))}
        />
        <Action
          k="pwreset"
          icon={Key}
          label="Require Password Reset"
          onClick={() => run('pwreset', 'Password reset required & email sent', {
            title: 'Require password reset',
            description: `Send a password-reset email to ${u.email} and require them to set a new password before they can sign in again.`,
            confirmText: 'Send & require reset',
            tone: 'warning',
          }, () => adminRequirePasswordReset(u.id, u.email))}
        />
        <Action
          k="kyc"
          icon={RefreshCw}
          label="Require KYC Renewal"
          onClick={() => run('kyc', 'KYC renewal required', {
            title: 'Require KYC renewal',
            description: 'Trades, deposits and withdrawals will be blocked until this user re-verifies their identity.',
            confirmText: 'Require renewal',
            tone: 'warning',
          }, () => adminRequireKycRenewal(u.id))}
        />
        {isFrozen ? (
          <Action
            k="unfreeze"
            icon={Snowflake}
            label="Unfreeze Account"
            danger
            onClick={() => run('unfreeze', 'Account unfrozen', {
              title: 'Unfreeze account',
              description: `${u.email} will regain full access to their account.`,
              confirmText: 'Unfreeze',
            }, () => adminUnfreezeUser(u.id))}
          />
        ) : (
          <Action
            k="freeze"
            icon={Snowflake}
            label="Freeze Account"
            danger
            onClick={async () => {
              const reason = await confirm({
                title: 'Freeze account',
                description: `Freezing ${u.email} blocks all activity immediately. Provide a reason for the audit log.`,
                confirmText: 'Freeze account',
                tone: 'danger',
                input: { placeholder: 'e.g. fraud review, chargeback, KYC mismatch', required: true },
              });
              if (reason === null) return;
              run('freeze', 'Account frozen', null, () => adminFreezeUser(u.id, reason));
            }}
          />
        )}
      </div>
      {u.force_password_reset && <p className="mt-3 text-xs text-amber-400">⚠ Password reset is currently required for this user.</p>}
      {u.force_kyc_renewal && <p className="mt-1 text-xs text-amber-400">⚠ KYC renewal is currently required for this user.</p>}
      {isFrozen && <p className="mt-1 text-xs text-red-400">⚠ Account is frozen — all activity is blocked.</p>}
    </div>
  );
}

function FeesLimits({ u, reload }) {
  const [fee, setFee] = useState(u.custom_fee_bps ?? '');
  const [dw, setDw]   = useState(u.daily_withdrawal_limit ?? '');
  const [dt, setDt]   = useState(u.daily_trade_limit ?? '');
  const submit = async (e) => {
    e.preventDefault();
    try {
      await setUserFee(u.id, fee === '' ? null : Number(fee));
      await setUserLimits(u.id, {
        dailyWithdrawal: dw === '' ? null : Number(dw),
        dailyTrade:      dt === '' ? null : Number(dt),
      });
      toast.success('Saved');
      reload();
    } catch (e) { toast.error(e.message || 'Failed'); }
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Field label="Custom fee (bps)" hint="Override platform fee. 25 = 0.25%">
        <input type="number" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="—" className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
      </Field>
      <Field label="Daily withdrawal limit" hint="USD value">
        <input type="number" value={dw} onChange={(e) => setDw(e.target.value)} placeholder="No limit" className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
      </Field>
      <Field label="Daily trade limit" hint="USD value">
        <input type="number" value={dt} onChange={(e) => setDt(e.target.value)} placeholder="No limit" className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm" />
      </Field>
      <div className="sm:col-span-3">
        <button type="submit" className="px-4 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-500">Save fees & limits</button>
      </div>
    </form>
  );
}
function Field({ label, hint, children }) {
  return (
    <label className="block text-xs">
      <div className="font-medium text-gray-700 dark:text-gray-300">{label}</div>
      {hint && <div className="text-gray-500">{hint}</div>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
