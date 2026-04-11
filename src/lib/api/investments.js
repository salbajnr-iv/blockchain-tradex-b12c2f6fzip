import { supabase } from '@/lib/supabaseClient';
import { INVESTMENT_INSTRUMENTS, mergeWithOverrides } from '@/lib/investmentCatalog';
import { logAdminAction } from '@/lib/api/admin';

const OVERRIDES_KEY = 'investment_catalog_overrides';

// ─────────────────────────────────────────────────────────────────────────────
// Read catalog (static + admin overrides)
// ─────────────────────────────────────────────────────────────────────────────
export const getInvestmentCatalog = async () => {
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', OVERRIDES_KEY)
      .maybeSingle();

    if (error || !data?.value) return mergeWithOverrides({});

    const overrides = typeof data.value === 'string'
      ? JSON.parse(data.value)
      : data.value;

    return mergeWithOverrides(overrides);
  } catch {
    return mergeWithOverrides({});
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Read raw overrides object (for admin editor)
// ─────────────────────────────────────────────────────────────────────────────
export const getInvestmentOverrides = async () => {
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', OVERRIDES_KEY)
      .maybeSingle();

    if (error || !data?.value) return {};

    return typeof data.value === 'string'
      ? JSON.parse(data.value)
      : data.value;
  } catch {
    return {};
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Save overrides (admin only)
// ─────────────────────────────────────────────────────────────────────────────
export const saveInvestmentOverrides = async (overrides) => {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('platform_settings')
    .upsert({
      key: OVERRIDES_KEY,
      value: JSON.stringify(overrides),
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    }, { onConflict: 'key' });

  if (error) throw new Error(`Failed to save investment overrides: ${error.message}`);

  await logAdminAction('investment_catalog_updated', 'platform_setting', OVERRIDES_KEY, {
    instrument_count: Object.keys(overrides).length,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Toggle a single instrument enabled/disabled
// ─────────────────────────────────────────────────────────────────────────────
export const toggleInstrumentEnabled = async (instrumentId, enabled) => {
  const overrides = await getInvestmentOverrides();
  overrides[instrumentId] = { ...(overrides[instrumentId] ?? {}), enabled };
  await saveInvestmentOverrides(overrides);
};

// ─────────────────────────────────────────────────────────────────────────────
// Update instrument price / change
// ─────────────────────────────────────────────────────────────────────────────
export const updateInstrumentPrice = async (instrumentId, price, changePct24h) => {
  const overrides = await getInvestmentOverrides();
  const change24h = (price * changePct24h) / 100;
  overrides[instrumentId] = {
    ...(overrides[instrumentId] ?? {}),
    price: Number(price),
    change24h,
    changePct24h: Number(changePct24h),
  };
  await saveInvestmentOverrides(overrides);
};

// ─────────────────────────────────────────────────────────────────────────────
// Add a custom instrument (admin-created)
// ─────────────────────────────────────────────────────────────────────────────
export const addCustomInstrument = async (instrument) => {
  const overrides = await getInvestmentOverrides();
  const custom = overrides.__custom ?? [];

  // Ensure unique id
  const id = `CUSTOM_${instrument.symbol}_${Date.now()}`;
  custom.push({ ...instrument, id, enabled: true });
  overrides.__custom = custom;

  await saveInvestmentOverrides(overrides);
  return id;
};

// ─────────────────────────────────────────────────────────────────────────────
// Delete a custom instrument
// ─────────────────────────────────────────────────────────────────────────────
export const deleteCustomInstrument = async (instrumentId) => {
  const overrides = await getInvestmentOverrides();
  const custom = (overrides.__custom ?? []).filter((c) => c.id !== instrumentId);
  overrides.__custom = custom;
  await saveInvestmentOverrides(overrides);
};

// ─────────────────────────────────────────────────────────────────────────────
// Update a custom instrument's details
// ─────────────────────────────────────────────────────────────────────────────
export const updateCustomInstrument = async (instrumentId, updates) => {
  const overrides = await getInvestmentOverrides();
  const custom = overrides.__custom ?? [];
  const idx = custom.findIndex((c) => c.id === instrumentId);
  if (idx === -1) throw new Error('Custom instrument not found');
  custom[idx] = { ...custom[idx], ...updates };
  overrides.__custom = custom;
  await saveInvestmentOverrides(overrides);
};

// ─────────────────────────────────────────────────────────────────────────────
// Record a user investment buy/sell
// ─────────────────────────────────────────────────────────────────────────────
export const createInvestmentTransaction = async (portfolioId, { type, instrument, amount, units, pricePerUnit }) => {
  if (!portfolioId) throw new Error('Portfolio ID required');

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      portfolio_id: portfolioId,
      type,
      symbol: instrument.symbol,
      total_amount: Number(amount),
      quantity: Number(units),
      price_per_unit: Number(pricePerUnit),
      status: 'pending',
      notes: `${type === 'INVESTMENT_BUY' ? 'Buy' : 'Sell'} ${units} × ${instrument.name} @ $${pricePerUnit.toLocaleString()} — Category: ${instrument.category}`,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch user's investment transactions (INVESTMENT_BUY / INVESTMENT_SELL)
// ─────────────────────────────────────────────────────────────────────────────
export const getUserInvestmentTransactions = async (portfolioId) => {
  if (!portfolioId) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .in('type', ['INVESTMENT_BUY', 'INVESTMENT_SELL'])
    .order('transaction_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
};

// ─────────────────────────────────────────────────────────────────────────────
// Derive user's current investment positions from transactions
// Returns: { [symbol]: { symbol, name, category, units, avgCost, totalCost } }
// ─────────────────────────────────────────────────────────────────────────────
export const deriveInvestmentPositions = (transactions) => {
  const positions = {};

  for (const tx of transactions) {
    const sym = tx.symbol;
    if (!positions[sym]) {
      positions[sym] = { symbol: sym, units: 0, totalCost: 0, transactions: [] };
    }

    const qty = Number(tx.quantity) || 0;
    const amt = Number(tx.total_amount) || 0;

    if (tx.type === 'INVESTMENT_BUY') {
      positions[sym].units += qty;
      positions[sym].totalCost += amt;
    } else if (tx.type === 'INVESTMENT_SELL') {
      positions[sym].units -= qty;
      positions[sym].totalCost -= amt;
    }

    positions[sym].transactions.push(tx);
  }

  // Filter out zero or negative positions
  return Object.fromEntries(
    Object.entries(positions).filter(([, p]) => p.units > 0.0000001)
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin: fetch all investment transactions across all users
// ─────────────────────────────────────────────────────────────────────────────
export const adminGetAllInvestmentTransactions = async () => {
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('*')
    .in('type', ['INVESTMENT_BUY', 'INVESTMENT_SELL'])
    .order('transaction_date', { ascending: false });

  if (error) throw error;
  if (!txs || txs.length === 0) return [];

  const portfolioIds = [...new Set(txs.map((t) => t.portfolio_id).filter(Boolean))];
  if (portfolioIds.length === 0) return txs;

  const { data: portfolios } = await supabase
    .from('portfolios')
    .select('id, user_id')
    .in('id', portfolioIds);

  const userIds = [...new Set((portfolios ?? []).map((p) => p.user_id).filter(Boolean))];

  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in('id', userIds);

  const portfolioMap = Object.fromEntries((portfolios ?? []).map((p) => [p.id, p]));
  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));

  return txs.map((tx) => {
    const portfolio = portfolioMap[tx.portfolio_id] ?? null;
    const user = portfolio ? (userMap[portfolio.user_id] ?? null) : null;
    return { ...tx, user };
  });
};
