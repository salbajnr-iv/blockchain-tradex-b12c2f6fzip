import { supabase } from '@/lib/supabaseClient';

export const getWatchlist = async (portfolioId) => {
  if (!portfolioId) return [];
  const { data, error } = await supabase
    .from('watchlist')
    .select('symbol')
    .eq('portfolio_id', portfolioId)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.symbol);
};

export const addToWatchlist = async (portfolioId, symbol, name = '') => {
  if (!portfolioId) throw new Error('Portfolio ID required');
  const { error } = await supabase
    .from('watchlist')
    .upsert({ portfolio_id: portfolioId, symbol, name }, { onConflict: 'portfolio_id,symbol' });
  if (error) throw error;
};

export const removeFromWatchlist = async (portfolioId, symbol) => {
  if (!portfolioId) return;
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('portfolio_id', portfolioId)
    .eq('symbol', symbol);
  if (error) throw error;
};
