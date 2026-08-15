import { supabase } from './supabaseClient';

// Attaches `reporter_display_name` to each row from its `user_id`, via the
// public-safe get_public_profiles RPC (id + display_name only, batched to
// avoid one round trip per reporter).
export async function attachReporterNames(rows) {
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  if (userIds.length === 0) return rows;
  const { data } = await supabase.rpc('get_public_profiles', { p_user_ids: userIds });
  const nameById = new Map((data || []).map((p) => [p.id, p.display_name]));
  return rows.map((r) => ({
    ...r,
    reporter_display_name: r.user_id ? nameById.get(r.user_id) ?? null : null,
  }));
}
