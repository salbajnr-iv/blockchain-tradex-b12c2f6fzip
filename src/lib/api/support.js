import { supabase, supabaseMisconfigured } from "@/lib/supabaseClient";

export async function submitSupportTicket({ subject, category, priority, message }) {
  if (supabaseMisconfigured) throw new Error("Supabase not configured");
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", user?.id)
    .single();

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user?.id,
      user_email: profile?.email || user?.email,
      user_name: profile?.full_name || user?.email,
      subject,
      category,
      priority,
      message,
      status: "open",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMyTickets() {
  if (supabaseMisconfigured) return [];
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

// Admin only
export async function fetchAllTickets() {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

export async function replyToTicket(ticketId, reply) {
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch ticket owner before updating so we can notify them
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("user_id, subject")
    .eq("id", ticketId)
    .single();

  const { error } = await supabase
    .from("support_tickets")
    .update({
      admin_reply: reply,
      replied_at: new Date().toISOString(),
      replied_by: user?.id,
      status: "answered",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);
  if (error) throw error;

  // Create a targeted in-app notification for the ticket owner
  if (ticket?.user_id) {
    await supabase.from("admin_notifications").insert({
      title: "Support Team Replied",
      message: `We've responded to your support ticket: "${ticket.subject || "your inquiry"}". Open the Support page to read our reply.`,
      type: "support_reply",
      icon: "💬",
      target_type: "specific",
      target_user_ids: [ticket.user_id],
      created_by: user?.id,
      is_active: true,
    });
  }
}

export async function closeTicket(ticketId) {
  const { error } = await supabase
    .from("support_tickets")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) throw error;
}
