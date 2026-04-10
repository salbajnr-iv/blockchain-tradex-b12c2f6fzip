import { supabase } from '@/lib/supabaseClient';

export const createWithdrawalRequest = async (portfolioId, { amount, method, withdrawalDetails, notes }) => {
  if (!portfolioId) throw new Error('Portfolio ID required');
  const parsedAmount = parseFloat(amount);
  if (!parsedAmount || parsedAmount <= 0) throw new Error('Invalid withdrawal amount');

  // Step 1: Deduct the amount from the portfolio cash_balance.
  // We use a conditional update (cash_balance >= amount) to prevent overdraft.
  const { data: portfolio, error: fetchErr } = await supabase
    .from('portfolios')
    .select('cash_balance')
    .eq('id', portfolioId)
    .single();

  if (fetchErr) throw new Error('Could not verify portfolio balance');

  const currentBalance = Number(portfolio?.cash_balance ?? 0);
  if (currentBalance < parsedAmount) {
    throw new Error('Insufficient balance for this withdrawal');
  }

  const { error: deductErr } = await supabase
    .from('portfolios')
    .update({ cash_balance: currentBalance - parsedAmount })
    .eq('id', portfolioId)
    .gte('cash_balance', parsedAmount);

  if (deductErr) {
    throw new Error('Failed to hold withdrawal funds — please try again');
  }

  // Step 2: Create the withdrawal transaction record.
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      portfolio_id: portfolioId,
      type: 'WITHDRAWAL',
      total_amount: parsedAmount,
      status: 'pending',
      payment_method: method,
      withdrawal_details: withdrawalDetails,
      transaction_date: new Date().toISOString(),
      notes,
    })
    .select()
    .single();

  if (error) {
    // If the transaction insert fails, restore the deducted balance
    await supabase
      .from('portfolios')
      .update({ cash_balance: currentBalance })
      .eq('id', portfolioId);
    throw error;
  }

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
