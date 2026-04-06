import { supabase } from '@/lib/supabaseClient';
import { format, subDays, subMonths, subYears } from 'date-fns';

export const writePortfolioSnapshot = async (portfolioId, { totalValue, cashBalance, cryptoValue }) => {
  if (!portfolioId) return null;
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .upsert(
      {
        portfolio_id:  portfolioId,
        total_value:   parseFloat(totalValue.toFixed(2)),
        cash_balance:  parseFloat(cashBalance.toFixed(2)),
        crypto_value:  parseFloat((cryptoValue || 0).toFixed(2)),
        snapshot_date: today,
      },
      { onConflict: 'portfolio_id,snapshot_date' }
    )
    .select()
    .single();
  if (error) console.warn('Snapshot write error:', error.message);
  return data ?? null;
};

export const getPortfolioHistory = async (portfolioId, range = '1M') => {
  if (!portfolioId) return [];
  const now = new Date();
  let from;
  switch (range) {
    case '1W': from = subDays(now, 7); break;
    case '1M': from = subMonths(now, 1); break;
    case '3M': from = subMonths(now, 3); break;
    case '1Y': from = subYears(now, 1); break;
    case 'ALL': from = new Date('2000-01-01'); break;
    default:   from = subMonths(now, 1);
  }
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('snapshot_date, total_value, cash_balance, crypto_value')
    .eq('portfolio_id', portfolioId)
    .gte('snapshot_date', format(from, 'yyyy-MM-dd'))
    .order('snapshot_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
};
