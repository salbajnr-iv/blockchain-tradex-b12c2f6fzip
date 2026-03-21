import { supabase } from '@/lib/supabaseClient';

// Maps frontend alert fields -> DB schema fields
function toDbAlert(alert, portfolioId) {
  let condition = 'ABOVE';
  if (alert.alert_type === 'price_below') condition = 'BELOW';

  return {
    portfolio_id: portfolioId,
    symbol: alert.crypto_symbol,
    name: alert.crypto_symbol,
    condition,
    target_price: parseFloat(alert.threshold_value),
    is_active: alert.is_active ?? true,
    description: alert.alert_type,
  };
}

// Maps DB schema fields -> frontend alert fields
function toFrontendAlert(dbAlert) {
  const alertType = dbAlert.description || (dbAlert.condition === 'ABOVE' ? 'price_above' : 'price_below');
  return {
    ...dbAlert,
    crypto_symbol: dbAlert.symbol,
    alert_type: alertType,
    threshold_value: dbAlert.target_price,
    is_triggered: !!dbAlert.triggered_at,
    current_price: dbAlert.triggered_price ?? null,
  };
}

export const listAlerts = async (portfolioId) => {
  if (!portfolioId) return [];
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toFrontendAlert);
};

export const createAlert = async (portfolioId, alert) => {
  if (!portfolioId) throw new Error('Portfolio ID required');
  const { data, error } = await supabase
    .from('price_alerts')
    .insert(toDbAlert(alert, portfolioId))
    .select()
    .single();
  if (error) throw error;
  return toFrontendAlert(data);
};

export const updateAlert = async (id, updates) => {
  const dbUpdates = {};

  if ('is_active' in updates) dbUpdates.is_active = updates.is_active;
  if ('is_triggered' in updates) {
    dbUpdates.triggered_at = updates.is_triggered ? (updates.triggered_at || new Date().toISOString()) : null;
    dbUpdates.triggered_price = updates.current_price ?? null;
  }
  if ('triggered_at' in updates) dbUpdates.triggered_at = updates.triggered_at;
  if ('current_price' in updates) dbUpdates.triggered_price = updates.current_price;
  if ('notification_sent' in updates) dbUpdates.notification_sent = updates.notification_sent;

  const { data, error } = await supabase
    .from('price_alerts')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return toFrontendAlert(data);
};

export const deleteAlert = async (id) => {
  const { error } = await supabase
    .from('price_alerts')
    .delete()
    .eq('id', id);
  if (error) throw error;
};
