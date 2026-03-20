import { supabase } from '@/lib/supabaseClient';

export const listAlerts = async () => {
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const createAlert = async (alert) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('price_alerts')
    .insert({ ...alert, user_id: user?.id })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateAlert = async (id, updates) => {
  const { data, error } = await supabase
    .from('price_alerts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteAlert = async (id) => {
  const { error } = await supabase
    .from('price_alerts')
    .delete()
    .eq('id', id);
  if (error) throw error;
};
