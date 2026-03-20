import { supabase } from '@/lib/supabaseClient';

export const listTransactions = async (limit = 50) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};

export const filterTransactions = async (filters = {}, limit = 50) => {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .limit(limit);
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export const createTransaction = async (transaction) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...transaction, user_id: user?.id })
    .select()
    .single();
  if (error) throw error;
  window.dispatchEvent(new CustomEvent('transaction:created', { detail: data }));
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
