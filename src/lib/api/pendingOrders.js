import { supabase } from '@/lib/supabaseClient';

export const createPendingOrder = async (portfolioId, { symbol, name, side, quantity, limitPrice, notes }) => {
  const { data, error } = await supabase
    .from('pending_orders')
    .insert({
      portfolio_id: portfolioId,
      symbol,
      name: name || symbol,
      side,
      quantity: parseFloat(quantity),
      limit_price: parseFloat(limitPrice),
      status: 'pending',
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const listPendingOrders = async (portfolioId, status = 'pending') => {
  if (!portfolioId) return [];
  let query = supabase
    .from('pending_orders')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};

export const cancelPendingOrder = async (orderId) => {
  const { data, error } = await supabase
    .from('pending_orders')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fillPendingOrder = async (orderId) => {
  const { data, error } = await supabase
    .from('pending_orders')
    .update({ status: 'filled', filled_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
};
