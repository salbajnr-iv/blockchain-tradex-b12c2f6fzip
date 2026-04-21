// KYC tier policy. Mirror these limits in any DB-side enforcement (RLS / RPC).
// tier 0 = none, 1 = basic, 2 = advanced, 3 = institutional

export const KYC_TIERS = {
  0: {
    label: 'Unverified',
    canDeposit: false,
    canWithdraw: false,
    canTrade: false,
    maxDepositUsd: 0,
    maxWithdrawalUsd: 0,
    dailyWithdrawalUsd: 0,
    restrictedInstrumentTypes: ['private_equity', 'futures', 'options', 'bonds'],
  },
  1: {
    label: 'Basic',
    canDeposit: true,
    canWithdraw: true,
    canTrade: true,
    maxDepositUsd: 5_000,
    maxWithdrawalUsd: 1_000,
    dailyWithdrawalUsd: 2_500,
    restrictedInstrumentTypes: ['private_equity', 'futures', 'options'],
  },
  2: {
    label: 'Advanced',
    canDeposit: true,
    canWithdraw: true,
    canTrade: true,
    maxDepositUsd: 50_000,
    maxWithdrawalUsd: 25_000,
    dailyWithdrawalUsd: 50_000,
    restrictedInstrumentTypes: ['private_equity'],
  },
  3: {
    label: 'Institutional',
    canDeposit: true,
    canWithdraw: true,
    canTrade: true,
    maxDepositUsd: Infinity,
    maxWithdrawalUsd: Infinity,
    dailyWithdrawalUsd: Infinity,
    restrictedInstrumentTypes: [],
  },
};

export function getTierPolicy(tier) {
  const t = Math.max(0, Math.min(3, Number.isFinite(tier) ? tier : 0));
  return KYC_TIERS[t];
}

export function isInstrumentAllowed(tier, instrumentType) {
  const policy = getTierPolicy(tier);
  if (!instrumentType) return true;
  return !policy.restrictedInstrumentTypes.includes(instrumentType);
}

export function checkDepositAmount(tier, usdAmount) {
  const policy = getTierPolicy(tier);
  if (!policy.canDeposit) {
    return { ok: false, reason: 'Your account must be KYC-verified before making deposits.' };
  }
  if (usdAmount > policy.maxDepositUsd) {
    return {
      ok: false,
      reason: `Your KYC tier (${policy.label}) allows deposits up to $${policy.maxDepositUsd.toLocaleString()} per transaction.`,
    };
  }
  return { ok: true };
}

export function checkWithdrawalAmount(tier, usdAmount) {
  const policy = getTierPolicy(tier);
  if (!policy.canWithdraw) {
    return { ok: false, reason: 'Your account must be KYC-verified before withdrawing funds.' };
  }
  if (usdAmount > policy.maxWithdrawalUsd) {
    return {
      ok: false,
      reason: `Your KYC tier (${policy.label}) allows withdrawals up to $${policy.maxWithdrawalUsd.toLocaleString()} per transaction. Upgrade your KYC to raise this limit.`,
    };
  }
  return { ok: true };
}
