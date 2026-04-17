import { supabase } from '@/lib/supabaseClient';
import { format, subDays, subMonths, subYears } from 'date-fns';

const lsKey = (portfolioId) => `bt-snapshots-${portfolioId}`;

// ── LocalStorage helpers ───────────────────────────────────────────────────────
function lsRead(portfolioId) {
  try {
    return JSON.parse(localStorage.getItem(lsKey(portfolioId)) || '{}');
  } catch {
    return {};
  }
}

function lsWrite(portfolioId, dateStr, entry) {
  try {
    const stored = lsRead(portfolioId);
    stored[dateStr] = entry;
    const keys = Object.keys(stored).sort();
    if (keys.length > 400) {
      keys.slice(0, keys.length - 400).forEach((k) => delete stored[k]);
    }
    localStorage.setItem(lsKey(portfolioId), JSON.stringify(stored));
  } catch {}
}

function lsGetRange(portfolioId, from) {
  const stored = lsRead(portfolioId);
  const fromStr = format(from, 'yyyy-MM-dd');
  return Object.values(stored)
    .filter((s) => s.snapshot_date >= fromStr)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Write (or upsert) today's snapshot.
 * Always writes to localStorage immediately. Also tries the database.
 */
export const writePortfolioSnapshot = async (portfolioId, { totalValue, cashBalance, cryptoValue }) => {
  if (!portfolioId) return null;

  const today = format(new Date(), 'yyyy-MM-dd');
  const entry = {
    snapshot_date: today,
    total_value:   parseFloat((totalValue  ?? 0).toFixed(2)),
    cash_balance:  parseFloat((cashBalance ?? 0).toFixed(2)),
    crypto_value:  parseFloat((cryptoValue ?? 0).toFixed(2)),
  };

  // Always persist to localStorage — works even without a DB table
  lsWrite(portfolioId, today, entry);

  // Best-effort DB write (table may not exist yet)
  try {
    const { data, error } = await supabase
      .from('portfolio_snapshots')
      .upsert(
        { portfolio_id: portfolioId, ...entry },
        { onConflict: 'portfolio_id,snapshot_date' }
      )
      .select()
      .single();

    if (error) console.debug('Snapshot DB write skipped:', error.message);
    return data ?? entry;
  } catch {
    return entry;
  }
};

/**
 * Retrieve portfolio history for the given range.
 * Merges DB rows with localStorage so the chart always has data to show.
 */
export const getPortfolioHistory = async (portfolioId, range = '1M') => {
  if (!portfolioId) return [];

  const now = new Date();
  let from;
  switch (range) {
    case '1W':  from = subDays(now, 7);        break;
    case '1M':  from = subMonths(now, 1);      break;
    case '3M':  from = subMonths(now, 3);      break;
    case '1Y':  from = subYears(now, 1);       break;
    case 'ALL': from = new Date('2000-01-01'); break;
    default:    from = subMonths(now, 1);
  }

  const fromStr = format(from, 'yyyy-MM-dd');

  // localStorage (always available)
  const lsSnapshots = lsGetRange(portfolioId, from);

  // Database (best-effort)
  let dbSnapshots = [];
  try {
    const { data, error } = await supabase
      .from('portfolio_snapshots')
      .select('snapshot_date, total_value, cash_balance, crypto_value')
      .eq('portfolio_id', portfolioId)
      .gte('snapshot_date', fromStr)
      .order('snapshot_date', { ascending: true });

    if (!error && data) dbSnapshots = data;
  } catch {
    // DB unavailable — fall through to localStorage only
  }

  // Merge: DB takes priority for any given date
  const merged = new Map();
  for (const s of lsSnapshots)  merged.set(s.snapshot_date, s);
  for (const s of dbSnapshots)  merged.set(s.snapshot_date, s);

  return Array.from(merged.values()).sort((a, b) =>
    a.snapshot_date.localeCompare(b.snapshot_date)
  );
};
