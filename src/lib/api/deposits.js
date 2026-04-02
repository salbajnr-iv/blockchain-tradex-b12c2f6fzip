import { supabase } from '@/lib/supabaseClient';

const DEPOSIT_FEE_RATE = 0; // 0% fee for deposits (fees apply on withdrawals)

export const createDepositRequest = async (portfolioId, userId, {
  amount,
  paymentMethodId = null,
  notes = '',
}) => {
  if (!portfolioId || !userId) throw new Error('Portfolio and user ID required');
  if (amount <= 0) throw new Error('Amount must be greater than 0');

  const fee = parseFloat((amount * DEPOSIT_FEE_RATE).toFixed(2));
  const netAmount = parseFloat((amount - fee).toFixed(2));

  const { data, error } = await supabase
    .from('deposit_requests')
    .insert({
      portfolio_id:      portfolioId,
      user_id:           userId,
      payment_method_id: paymentMethodId,
      amount:            parseFloat(amount.toFixed(2)),
      fee,
      net_amount:        netAmount,
      status:            'processing',
      notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const processDeposit = async (depositRequestId) => {
  const { data, error } = await supabase
    .rpc('fn_process_deposit', { p_deposit_request_id: depositRequestId });
  if (error) throw error;
  if (!data.success) throw new Error(data.error || 'Deposit processing failed');
  return data;
};

export const listDepositRequests = async (portfolioId, limit = 20) => {
  if (!portfolioId) return [];
  const { data, error } = await supabase
    .from('deposit_requests')
    .select(`
      *,
      payment_methods (
        type, card_brand, card_last_four, bank_name, account_last_four, paypal_email, label
      )
    `)
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
};
