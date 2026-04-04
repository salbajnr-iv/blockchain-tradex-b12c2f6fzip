import { supabase } from '@/lib/supabaseClient';

export const createWithdrawalRequest = async (portfolioId, { amount, method, withdrawalDetails, notes }) => {
  if (!portfolioId) throw new Error('Portfolio ID required');
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      portfolio_id: portfolioId,
      type: 'WITHDRAWAL',
      total_amount: parseFloat(amount),
      status: 'pending',
      payment_method: method,
      withdrawal_details: withdrawalDetails,
      transaction_date: new Date().toISOString(),
      notes,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getWithdrawalTransaction = async (transactionId) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();
  if (error) throw error;
  return data;
};

export const subscribeToWithdrawalStatus = (transactionId, onUpdate) => {
  const channel = supabase
    .channel(`withdrawal:${transactionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions',
        filter: `id=eq.${transactionId}`,
      },
      (payload) => onUpdate(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export const getUserKycStatus = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('id, status, tier, submitted_at')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const adminUpdateWithdrawal = async (transactionId, status, adminMessage) => {
  const { error } = await supabase.rpc('fn_admin_update_withdrawal', {
    p_transaction_id: transactionId,
    p_status: status,
    p_admin_message: adminMessage || null,
  });
  if (error) throw error;
};
