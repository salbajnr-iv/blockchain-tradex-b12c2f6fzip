import { supabase } from '@/lib/supabaseClient';

// Fetches all the per-user policy fields we need for client-side guards.
// Server-side enforcement still happens via RLS / RPCs; these are UX-friendly
// pre-checks that prevent the request from being sent in the first place.
export async function getUserPolicy(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, status, is_admin, admin_role,
      kyc_tier, kyc_verified,
      custom_fee_bps,
      daily_trade_limit, daily_withdrawal_limit,
      withdrawal_whitelist_only,
      force_password_reset, force_kyc_renewal
    `)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUserWhitelist(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('withdrawal_whitelist')
    .select('asset, address, label')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

// Sums today's (UTC) trade notional for this user, in USD.
export async function getTodayTradeNotionalUsd(portfolioId) {
  if (!portfolioId) return 0;
  const startUtc = new Date();
  startUtc.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('trades')
    .select('quantity, unit_price')
    .eq('portfolio_id', portfolioId)
    .gte('trade_date', startUtc.toISOString());
  if (error) throw error;
  return (data || []).reduce(
    (sum, t) => sum + Number(t.quantity || 0) * Number(t.unit_price || 0),
    0
  );
}

// Sums today's (UTC) withdrawal request totals (pending + completed) in USD.
export async function getTodayWithdrawalUsd(portfolioId) {
  if (!portfolioId) return 0;
  const startUtc = new Date();
  startUtc.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('transactions')
    .select('total_amount, status')
    .eq('portfolio_id', portfolioId)
    .eq('type', 'WITHDRAWAL')
    .neq('status', 'rejected')
    .gte('transaction_date', startUtc.toISOString());
  if (error) throw error;
  return (data || []).reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
}

export function normalizeAddress(asset, address) {
  if (!address) return '';
  const a = address.trim();
  // EVM-style chains use case-insensitive comparison
  const evm = ['ETH', 'USDT', 'USDC', 'BNB', 'MATIC', 'ARB', 'OP', 'AVAX'];
  if (evm.includes(String(asset).toUpperCase())) return a.toLowerCase();
  return a;
}
