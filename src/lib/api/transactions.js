import { supabase } from '@/lib/supabaseClient';

export const listTransactions = async (portfolioId, limit = 50) => {
  if (!portfolioId) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('transaction_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};

export const filterTransactions = async (portfolioId, filters = {}, limit = 50) => {
  if (!portfolioId) return [];
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('transaction_date', { ascending: false })
    .limit(limit);
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export const createTransaction = async (portfolioId, transaction) => {
  if (!portfolioId) throw new Error('Portfolio ID required');
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...transaction, portfolio_id: portfolioId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateTransaction = async (id, updates) => {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};
