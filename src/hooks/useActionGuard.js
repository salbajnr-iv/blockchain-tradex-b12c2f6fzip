// SERVER TODO (suggestions.md §6a): the feature-flag checks in this hook are
// advisory UX only. A user calling Supabase REST directly bypasses every one.
// To make `maintenance_mode`, `trading_enabled`, `withdrawals_enabled`,
// `deposits_enabled`, `registrations_enabled` real boundaries, install
// `fn_check_feature_flag` BEFORE INSERT triggers on `trades`, `withdrawals`,
// `transactions`, and `users` (see §6a for the SQL).
import { useCallback, useEffect, useState } from 'react';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { useAuth } from '@/lib/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { getUserPolicy } from '@/lib/api/userPolicy';

// Centralised pre-flight guard for any state-changing user action.
// Usage:
//   const guard = useActionGuard();
//   if (!guard.allow('trade')) return;     // shows toast itself
//   await doTheThing();
//
// Actions: 'trade' | 'withdraw' | 'deposit' | 'register'
const ACTION_TO_FLAG = {
  trade:    'trading_enabled',
  withdraw: 'withdrawals_enabled',
  deposit:  'deposits_enabled',
  register: 'registrations_enabled',
};

const ACTION_LABEL = {
  trade:    'Trading',
  withdraw: 'Withdrawals',
  deposit:  'Deposits',
  register: 'Registration',
};

import { toast } from '@/lib/toast';

export function useActionGuard() {
  const { isFlagOn, isMaintenance } = useFeatureFlags();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [policy, setPolicy] = useState(null);

  useEffect(() => {
    let active = true;
    if (!user?.id) { setPolicy(null); return; }
    getUserPolicy(user.id)
      .then((p) => { if (active) setPolicy(p); })
      .catch(() => { if (active) setPolicy(null); });
    return () => { active = false; };
  }, [user?.id]);

  const allow = useCallback((action) => {
    // Admins bypass platform-wide gates so they can still operate during maintenance.
    if (isAdmin) return true;

    // Account-level gates
    if (policy?.status === 'suspended' || policy?.status === 'frozen') {
      toast.error('Your account is currently suspended. Please contact support.');
      return false;
    }
    if (policy?.force_password_reset) {
      toast.error('You must reset your password before performing this action.');
      return false;
    }
    if (action !== 'register' && policy?.force_kyc_renewal) {
      toast.error('Your KYC needs renewal before you can perform this action.');
      return false;
    }

    // Platform-wide gates
    if (isMaintenance) {
      toast.error('BlockTrade is in maintenance mode. Please try again shortly.');
      return false;
    }
    const flag = ACTION_TO_FLAG[action];
    if (flag && !isFlagOn(flag, true)) {
      toast.error(`${ACTION_LABEL[action]} are temporarily disabled by the BlockTrade team.`);
      return false;
    }
    return true;
  }, [isAdmin, policy, isMaintenance, isFlagOn]);

  return { allow, policy, isAdmin };
}
