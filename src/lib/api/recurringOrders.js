import { supabase } from '@/lib/supabaseClient';
import { addDays, addWeeks, addMonths, nextDay, startOfDay } from 'date-fns';

// day: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
function computeNextExecution(frequency, dayOfWeek) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const target = dayOfWeek ?? 1; // default Monday

  switch (frequency) {
    case 'daily':
      return addDays(now, 1).toISOString();
    case 'weekly':
      return nextDay(todayStart, target).toISOString();
    case 'biweekly':
      return addWeeks(nextDay(todayStart, target), 1).toISOString();
    case 'monthly':
      return addMonths(now, 1).toISOString();
    default:
      return addDays(now, 1).toISOString();
  }
}

export const listRecurringOrders = async (portfolioId) => {
  if (!portfolioId) return [];
  const { data, error } = await supabase
    .from('recurring_orders')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const createRecurringOrder = async (portfolioId, { symbol, name, amountUsd, frequency, dayOfWeek }) => {
  const nextExecution = computeNextExecution(frequency, dayOfWeek ?? null);
  const { data, error } = await supabase
    .from('recurring_orders')
    .insert({
      portfolio_id:      portfolioId,
      symbol,
      name,
      amount_usd:        parseFloat(amountUsd),
      frequency,
      day_of_week:       dayOfWeek ?? null,
      next_execution_at: nextExecution,
      status:            'active',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const setRecurringOrderStatus = async (orderId, status) => {
  const { data, error } = await supabase
    .from('recurring_orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const listDueRecurringOrders = async (portfolioId) => {
  if (!portfolioId) return [];
  const { data, error } = await supabase
    .from('recurring_orders')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .eq('status', 'active')
    .lte('next_execution_at', new Date().toISOString());
  if (error) throw error;
  return data ?? [];
};

// Called after a successful DCA execution
export const advanceRecurringOrder = async (order, amountSpent) => {
  const nextExecution = computeNextExecution(order.frequency, order.day_of_week);
  const { error } = await supabase
    .from('recurring_orders')
    .update({
      next_execution_at: nextExecution,
      total_executed:    (order.total_executed || 0) + 1,
      total_spent:       parseFloat(((order.total_spent || 0) + amountSpent).toFixed(2)),
    })
    .eq('id', order.id);
  if (error) throw error;
};
