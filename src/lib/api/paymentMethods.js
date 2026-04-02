import { supabase } from '@/lib/supabaseClient';

export const listPaymentMethods = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const addPaymentMethod = async (userId, method) => {
  if (!userId) throw new Error('User ID required');
  const { data, error } = await supabase
    .from('payment_methods')
    .insert({ ...method, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deletePaymentMethod = async (id) => {
  const { error } = await supabase
    .from('payment_methods')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const setDefaultPaymentMethod = async (id, userId) => {
  await supabase
    .from('payment_methods')
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  const { error } = await supabase
    .from('payment_methods')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

export const detectCardBrand = (number) => {
  const n = number.replace(/\D/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^6(?:011|5)/.test(n)) return 'discover';
  return 'unknown';
};

export const formatCardNumber = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

export const formatExpiry = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
};
