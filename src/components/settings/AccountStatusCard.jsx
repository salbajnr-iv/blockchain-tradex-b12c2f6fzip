import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePortfolio } from '@/contexts/PortfolioContext';
import {
  getUserPolicy,
  getTodayTradeNotionalUsd,
  getTodayWithdrawalUsd,
} from '@/lib/api/userPolicy';
import { getTierPolicy, KYC_TIERS } from '@/lib/kycTiers';
import { ShieldCheck, TrendingUp, ArrowUpFromLine, Loader2 } from 'lucide-react';

const TIER_COLOR = {
  0: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
  1: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  2: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  3: 'text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-500/30',
};

function fmtUsd(v) {
  if (!Number.isFinite(v)) return '∞';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function UsageBar({ label, used, limit, icon: Icon }) {
  const cap = Number.isFinite(limit) && limit > 0 ? limit : 0;
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  const remaining = cap > 0 ? Math.max(0, cap - used) : Infinity;
  const danger = pct >= 90;
  const warn = pct >= 70 && !danger;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />
          <span>{label}</span>
        </div>
        <span className={`font-mono ${danger ? 'text-destructive' : warn ? 'text-yellow-400' : 'text-muted-foreground'}`}>
          {fmtUsd(used)} <span className="text-muted-foreground/60">/ {fmtUsd(cap || (Number.isFinite(limit) ? limit : Infinity))}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full transition-all ${danger ? 'bg-destructive' : warn ? 'bg-yellow-400' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {Number.isFinite(remaining) && (
        <p className="text-[10px] text-muted-foreground text-right">
          {remaining > 0 ? `${fmtUsd(remaining)} remaining today` : 'Daily limit reached'}
        </p>
      )}
    </div>
  );
}

export default function AccountStatusCard() {
  const { user } = useAuth();
  const { portfolioId } = usePortfolio();
  const [policy, setPolicy] = useState(null);
  const [usage, setUsage] = useState({ trade: 0, withdraw: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user?.id) { setLoading(false); return; }
      try {
        const [p, t, w] = await Promise.all([
          getUserPolicy(user.id),
          portfolioId ? getTodayTradeNotionalUsd(portfolioId) : 0,
          portfolioId ? getTodayWithdrawalUsd(portfolioId) : 0,
        ]);
        if (active) {
          setPolicy(p);
          setUsage({ trade: t, withdraw: w });
        }
      } catch { /* noop */ }
      finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [user?.id, portfolioId]);

  if (loading) {
    return (
      <div className="bg-card border border-border/50 rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }
  if (!policy) return null;

  const tier = Number(policy.kyc_tier ?? 0);
  const tierPolicy = getTierPolicy(tier);
  const tierColor = TIER_COLOR[tier] || TIER_COLOR[0];

  // Effective daily limits = min(per-user override, tier policy). 0 / null on user means tier policy applies.
  const userTradeOverride = Number(policy.daily_trade_limit) || 0;
  const userWithdrawOverride = Number(policy.daily_withdrawal_limit) || 0;
  // Trade is in notional USD; tier doesn't currently cap trade notional, so use override if set.
  const effectiveTradeLimit = userTradeOverride > 0 ? userTradeOverride : Infinity;
  const effectiveWithdrawLimit = userWithdrawOverride > 0
    ? Math.min(userWithdrawOverride, tierPolicy.dailyWithdrawalUsd)
    : tierPolicy.dailyWithdrawalUsd;

  const customFee = Number(policy.custom_fee_bps);
  const showCustomFee = Number.isFinite(customFee) && customFee !== 10;

  return (
    <div className="bg-card border border-border/50 rounded-xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Account Status
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Your verification tier and today's activity limits.
          </p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${tierColor}`}>
          Tier {tier} · {tierPolicy.label}
        </span>
      </div>

      {/* Per-transaction caps */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-secondary/30 rounded-lg p-3">
          <p className="text-muted-foreground">Max deposit / txn</p>
          <p className="text-foreground font-semibold mt-0.5">{fmtUsd(tierPolicy.maxDepositUsd)}</p>
        </div>
        <div className="bg-secondary/30 rounded-lg p-3">
          <p className="text-muted-foreground">Max withdrawal / txn</p>
          <p className="text-foreground font-semibold mt-0.5">{fmtUsd(tierPolicy.maxWithdrawalUsd)}</p>
        </div>
      </div>

      {/* Daily usage */}
      <div className="space-y-4">
        <UsageBar
          label="Trades today"
          used={usage.trade}
          limit={effectiveTradeLimit}
          icon={TrendingUp}
        />
        <UsageBar
          label="Withdrawals today"
          used={usage.withdraw}
          limit={effectiveWithdrawLimit}
          icon={ArrowUpFromLine}
        />
      </div>

      {/* Custom fee notice */}
      {showCustomFee && (
        <div className="text-xs bg-primary/10 border border-primary/20 rounded-lg p-3 text-primary">
          Your account has a custom trading fee of {(customFee / 100).toFixed(2)}% applied.
        </div>
      )}

      {/* Upgrade hint */}
      {tier < 3 && (
        <p className="text-xs text-muted-foreground">
          Want higher limits? Upgrade to <strong className="text-foreground">{KYC_TIERS[tier + 1].label}</strong> to unlock up to{' '}
          <strong className="text-foreground">{fmtUsd(KYC_TIERS[tier + 1].maxWithdrawalUsd)}</strong> per withdrawal.
        </p>
      )}
    </div>
  );
}
