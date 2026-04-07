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

export const lookupUserByEmail = async (email) => {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) throw new Error('Please enter an email address');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) throw new Error('Please enter a valid email address');

  // Try the dedicated RPC function first (requires transfer-email-lookup.sql to be applied)
  try {
    const { data, error } = await supabase.rpc('fn_lookup_user_by_email', {
      p_email: trimmed,
    });
    if (error) throw error;
    return data;
  } catch (rpcErr) {
    // RPC not yet deployed — fall back to a direct table query
    const { data: { user: me } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('users')
      .select('transfer_id, username, display_name, email')
      .ilike('email', trimmed)
      .neq('id', me?.id ?? '')
      .limit(1)
      .maybeSingle();

    if (error) throw new Error('Email lookup failed. Please try again.');
    if (!data) return { found: false };

    const e = data.email || '';
    const emailHint = e.length > 6
      ? e.slice(0, 2) + '*'.repeat(Math.max(e.length - 6, 3)) + e.slice(-4)
      : e;

    return {
      found: true,
      transfer_id:  data.transfer_id,
      username:     data.username,
      display_name: data.display_name,
      email_hint:   emailHint,
    };
  }
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
