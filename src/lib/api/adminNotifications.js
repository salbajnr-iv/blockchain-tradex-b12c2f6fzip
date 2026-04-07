import { supabase, supabaseMisconfigured } from "@/lib/supabaseClient";

export async function fetchAdminNotifications() {
  if (supabaseMisconfigured) return [];
  const { data, error } = await supabase
    .from("admin_notifications")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

export async function sendAdminNotification({ title, message, type = "announcement", icon = "📢", targetType = "all", targetUserIds = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("admin_notifications")
    .insert({
      title,
      message,
      type,
      icon,
      target_type: targetType,
      target_user_ids: targetUserIds,
      created_by: user?.id,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAdminNotification(id) {
  const { error } = await supabase
    .from("admin_notifications")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchAllAdminUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email")
    .order("full_name");
  if (error) return [];
  return data || [];
}
