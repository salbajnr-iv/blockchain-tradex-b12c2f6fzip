import { supabase } from '@/lib/supabaseClient';

export const getMyTransferUid = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('users')
    .select('transfer_uid, username')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return data;
};

export const lookupUserForTransfer = async (transferUid) => {
  const uid = parseInt(transferUid, 10);
  if (isNaN(uid)) throw new Error('Invalid Transfer ID — must be a number');
  const { data, error } = await supabase.rpc('fn_lookup_user_for_transfer', {
    p_transfer_uid: uid,
  });
  if (error) throw error;
  return data;
};

export const executeTransfer = async (fromPortfolioId, toTransferUid, amount, note) => {
  const { data, error } = await supabase.rpc('fn_transfer_funds', {
    p_from_portfolio_id: fromPortfolioId,
    p_to_transfer_uid:   parseInt(toTransferUid, 10),
    p_amount:            parseFloat(amount),
    p_note:              note || null,
  });
  if (error) throw error;
  if (!data.success) throw new Error(data.error || 'Transfer failed');
  return data;
};
