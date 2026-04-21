import { supabase } from '@/lib/supabaseClient';
import { logAdminAction } from '@/lib/api/admin';

// ── Feature flags ─────────────────────────────────────────────────────────────
export async function getFeatureFlags() {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('key');
  if (error) throw error;
  const map = {};
  (data || []).forEach((f) => { map[f.key] = f; });
  return map;
}

export async function setFeatureFlag(key, enabled) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('feature_flags')
    .update({ enabled, updated_at: new Date().toISOString(), updated_by: user?.id ?? null })
    .eq('key', key);
  if (error) throw error;
  await logAdminAction('feature_flag_changed', 'feature_flag', key, { enabled });
}

// ── IP blocklist ──────────────────────────────────────────────────────────────
export async function getIpBlocklist() {
  const { data, error } = await supabase
    .from('ip_blocklist')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addIpBlock(ip, reason = null) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('ip_blocklist')
    .insert({ ip_address: ip, reason, created_by: user?.id ?? null });
  if (error) throw error;
  await logAdminAction('ip_blocked', 'ip', ip, { reason });
}

export async function removeIpBlock(id) {
  const { error } = await supabase.from('ip_blocklist').delete().eq('id', id);
  if (error) throw error;
  await logAdminAction('ip_unblocked', 'ip', id);
}

// ── Country blocklist ─────────────────────────────────────────────────────────
export async function getCountryBlocklist() {
  const { data, error } = await supabase
    .from('country_blocklist')
    .select('*')
    .order('country_code');
  if (error) throw error;
  return data || [];
}

export async function addCountryBlock(code, reason = null) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('country_blocklist')
    .insert({ country_code: code.toUpperCase(), reason, created_by: user?.id ?? null });
  if (error) throw error;
  await logAdminAction('country_blocked', 'country', code, { reason });
}

export async function removeCountryBlock(code) {
  const { error } = await supabase.from('country_blocklist').delete().eq('country_code', code);
  if (error) throw error;
  await logAdminAction('country_unblocked', 'country', code);
}

// ── Sign-in gate (called from login) ──────────────────────────────────────────
export async function checkSignInRestrictions() {
  let ip = null, country = null;
  try {
    const r = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      ip = j.ip;
      country = j.country_code;
    }
  } catch {
    // best-effort; do not block on detection failure
  }

  if (ip) {
    const { data } = await supabase
      .from('ip_blocklist')
      .select('id, reason')
      .eq('ip_address', ip)
      .maybeSingle();
    if (data) return { allowed: false, reason: data.reason || `Your IP (${ip}) is blocked.` };
  }
  if (country) {
    const { data } = await supabase
      .from('country_blocklist')
      .select('country_code, reason')
      .eq('country_code', country)
      .maybeSingle();
    if (data) return { allowed: false, reason: data.reason || `Sign-in is restricted in ${country}.` };
  }
  return { allowed: true, ip, country };
}
