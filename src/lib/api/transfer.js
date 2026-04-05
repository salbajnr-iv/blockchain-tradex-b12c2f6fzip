import { supabase } from '@/lib/supabaseClient';

export const getMyTransferId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('users')
    .select('transfer_id, username, display_name')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
};

export const lookupUserForTransfer = async (transferId) => {
  const trimmed = transferId.trim();
  if (!trimmed) throw new Error('Please enter a Transfer ID');
  const { data, error } = await supabase.rpc('fn_lookup_user_by_transfer_id', {
    p_transfer_id: trimmed,
  });
  if (error) throw error;
  return data;
};

export const executeTransfer = async (fromPortfolioId, toTransferId, amount, note) => {
  const { data, error } = await supabase.rpc('fn_transfer_funds_by_id', {
    p_from_portfolio_id: fromPortfolioId,
    p_to_transfer_id:    toTransferId,
    p_amount:            parseFloat(amount),
    p_note:              note || null,
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error || 'Transfer failed');
  return data;
};
