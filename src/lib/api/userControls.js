import { supabase } from '@/lib/supabaseClient';
import { logAdminAction } from '@/lib/api/admin';

// ── Per-user fees / limits / whitelisting ───────────────────────────────────
export async function setUserFee(userId, customFeeBps) {
  const { error } = await supabase
    .from('users')
    .update({ custom_fee_bps: customFeeBps })
    .eq('id', userId);
  if (error) throw error;
  await logAdminAction('user_fee_changed', 'user', userId, { custom_fee_bps: customFeeBps });
}

export async function setUserLimits(userId, { dailyWithdrawal, dailyTrade, whitelistOnly }) {
  const patch = {};
  if (dailyWithdrawal !== undefined) patch.daily_withdrawal_limit = dailyWithdrawal;
  if (dailyTrade !== undefined)      patch.daily_trade_limit      = dailyTrade;
  if (whitelistOnly !== undefined)   patch.withdrawal_whitelist_only = whitelistOnly;
  const { error } = await supabase.from('users').update(patch).eq('id', userId);
  if (error) throw error;
  await logAdminAction('user_limits_changed', 'user', userId, patch);
}

export async function getWhitelist(userId) {
  const { data, error } = await supabase
    .from('withdrawal_whitelist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addWhitelistEntry(userId, asset, address, label) {
  const { error } = await supabase
    .from('withdrawal_whitelist')
    .insert({ user_id: userId, asset: asset.toUpperCase(), address, label });
  if (error) throw error;
  await logAdminAction('whitelist_added', 'user', userId, { asset, address });
}

export async function removeWhitelistEntry(id, userId) {
  const { error } = await supabase.from('withdrawal_whitelist').delete().eq('id', id);
  if (error) throw error;
  await logAdminAction('whitelist_removed', 'user', userId, { id });
}

// ── KYC tier ────────────────────────────────────────────────────────────────
export async function setKycTier(userId, tier) {
  const { error } = await supabase
    .from('users')
    .update({ kyc_tier: tier, kyc_verified: tier > 0 })
    .eq('id', userId);
  if (error) throw error;
  await logAdminAction('kyc_tier_changed', 'user', userId, { kyc_tier: tier });
}

// ── Notes ───────────────────────────────────────────────────────────────────
export async function getUserNotes(userId) {
  const { data, error } = await supabase
    .from('user_notes')
    .select('*, author:created_by ( email, full_name )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function addUserNote(userId, body) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('user_notes')
    .insert({ user_id: userId, body, created_by: user?.id ?? null });
  if (error) throw error;
  await logAdminAction('note_added', 'user', userId);
}
export async function deleteUserNote(id, userId) {
  const { error } = await supabase.from('user_notes').delete().eq('id', id);
  if (error) throw error;
  await logAdminAction('note_deleted', 'user', userId, { id });
}

// ── Tags ────────────────────────────────────────────────────────────────────
const TAG_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
export async function getUserTags(userId) {
  const { data, error } = await supabase
    .from('user_tags').select('*').eq('user_id', userId).order('created_at');
  if (error) throw error;
  return data || [];
}
export async function addUserTag(userId, tag) {
  const { data: { user } } = await supabase.auth.getUser();
  const color = TAG_COLORS[Math.abs(hash(tag)) % TAG_COLORS.length];
  const { error } = await supabase
    .from('user_tags').insert({ user_id: userId, tag, color, created_by: user?.id ?? null });
  if (error) throw error;
  await logAdminAction('tag_added', 'user', userId, { tag });
}
export async function removeUserTag(id, userId) {
  const { error } = await supabase.from('user_tags').delete().eq('id', id);
  if (error) throw error;
  await logAdminAction('tag_removed', 'user', userId, { id });
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i); return h; }

// ── Impersonation (read-only audit) ─────────────────────────────────────────
export async function startImpersonation(targetId, reason) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('impersonation_sessions')
    .insert({ admin_id: user.id, target_id: targetId, reason })
    .select('id')
    .single();
  if (error) throw error;
  await logAdminAction('impersonation_started', 'user', targetId, { reason, session_id: data.id });
  return data.id;
}
export async function endImpersonation(sessionId) {
  const { error } = await supabase
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
  await logAdminAction('impersonation_ended', 'impersonation', sessionId);
}

// ── Direct messages ─────────────────────────────────────────────────────────
export async function sendAdminMessage(userId, subject, body) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('admin_messages')
    .insert({ user_id: userId, admin_id: user?.id ?? null, subject, body });
  if (error) throw error;
  await logAdminAction('admin_message_sent', 'user', userId, { subject });
}
export async function getMyAdminMessages() {
  const { data, error } = await supabase
    .from('admin_messages')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function markMessageRead(id) {
  const { error } = await supabase
    .from('admin_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ── Announcements ───────────────────────────────────────────────────────────
export async function getActiveAnnouncements() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function getAllAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createAnnouncement(payload) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('announcements')
    .insert({ ...payload, created_by: user?.id ?? null });
  if (error) throw error;
  await logAdminAction('announcement_created', 'announcement', null, payload);
}
export async function updateAnnouncement(id, patch) {
  const { error } = await supabase.from('announcements').update(patch).eq('id', id);
  if (error) throw error;
  await logAdminAction('announcement_updated', 'announcement', id, patch);
}
export async function deleteAnnouncement(id) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
  await logAdminAction('announcement_deleted', 'announcement', id);
}
