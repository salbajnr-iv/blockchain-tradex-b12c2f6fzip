import { supabase } from '@/lib/supabaseClient';
import { logAdminAction } from '@/lib/api/admin';

const SETTING_KEY = 'multi_account_reviewed_clusters';

function parseValue(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getReviewedClusters() {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', SETTING_KEY)
    .maybeSingle();
  if (error) return [];
  return parseValue(data?.value);
}

export function clusterId(kind, key) {
  return `${kind}:${key}`;
}

export async function markClusterReviewed(kind, key, note = null) {
  const { data: { user } } = await supabase.auth.getUser();
  const existing = await getReviewedClusters();
  const id = clusterId(kind, key);
  const filtered = existing.filter((r) => r.id !== id);
  const next = [
    ...filtered,
    {
      id,
      kind,
      key,
      note,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    },
  ];
  const { error } = await supabase
    .from('platform_settings')
    .upsert(
      {
        key: SETTING_KEY,
        value: JSON.stringify(next),
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      },
      { onConflict: 'key' }
    );
  if (error) throw error;
  await logAdminAction('multi_account_cluster_reviewed', 'cluster', id, { kind, key, note });
  return next;
}

export async function unmarkClusterReviewed(kind, key) {
  const { data: { user } } = await supabase.auth.getUser();
  const existing = await getReviewedClusters();
  const id = clusterId(kind, key);
  const next = existing.filter((r) => r.id !== id);
  const { error } = await supabase
    .from('platform_settings')
    .upsert(
      {
        key: SETTING_KEY,
        value: JSON.stringify(next),
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      },
      { onConflict: 'key' }
    );
  if (error) throw error;
  await logAdminAction('multi_account_cluster_unreviewed', 'cluster', id, { kind, key });
  return next;
}
