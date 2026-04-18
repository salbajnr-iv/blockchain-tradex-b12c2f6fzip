import { supabase, supabaseMisconfigured } from "@/lib/supabaseClient";

// ── Conversations ─────────────────────────────────────────────────────────────

export async function getOrCreateConversation(userId, userEmail, userName) {
  const { data: existing } = await supabase
    .from("support_conversations")
    .select("*")
    .eq("user_id", userId)
    .not("status", "eq", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("support_conversations")
    .insert({ user_id: userId, user_email: userEmail, user_name: userName })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchMyConversation(userId) {
  const { data } = await supabase
    .from("support_conversations")
    .select("*")
    .eq("user_id", userId)
    .not("status", "eq", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

export async function closeConversation(conversationId) {
  const { error } = await supabase
    .from("support_conversations")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function reopenConversation(conversationId) {
  const { error } = await supabase
    .from("support_conversations")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw error;
}

export async function markReadByUser(conversationId) {
  await supabase
    .from("support_conversations")
    .update({ unread_user: 0 })
    .eq("id", conversationId);
}

export async function markReadByAdmin(conversationId) {
  await supabase
    .from("support_conversations")
    .update({ unread_admin: 0 })
    .eq("id", conversationId);
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function fetchMessages(conversationId) {
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(conversationId, senderId, senderRole, content, fileData = null) {
  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: senderRole,
      content: content?.trim() || null,
      file_url: fileData?.url || null,
      file_name: fileData?.name || null,
      file_type: fileData?.type || null,
      file_size: fileData?.size || null,
    })
    .select()
    .single();

  if (error) throw error;

  const convUpdate = {
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (senderRole === "user") {
    convUpdate.status = "open";
    convUpdate.unread_admin = 99;
    convUpdate.unread_user = 0;
  } else {
    convUpdate.status = "in_progress";
    convUpdate.unread_user = 99;
    convUpdate.unread_admin = 0;
    try {
      const { data: conv } = await supabase
        .from("support_conversations")
        .select("user_id")
        .eq("id", conversationId)
        .single();
      if (conv?.user_id) {
        await supabase.from("admin_notifications").insert({
          title: "Support Team Replied",
          message: `Our support team has replied to your chat. Open the Support page to read and respond.`,
          type: "support_reply",
          icon: "💬",
          target_type: "specific",
          target_user_ids: [conv.user_id],
          created_by: senderId,
          is_active: true,
        });
      }
    } catch (_) {}
  }

  await supabase
    .from("support_conversations")
    .update(convUpdate)
    .eq("id", conversationId);

  return data;
}

// ── File upload ───────────────────────────────────────────────────────────────

export async function uploadSupportFile(file, userId) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("support-attachments")
    .upload(path, file, { upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("support-attachments")
    .getPublicUrl(path);

  return { url: data.publicUrl, name: file.name, type: file.type, size: file.size };
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function fetchAllConversations() {
  const { data, error } = await supabase
    .from("support_conversations")
    .select("*")
    .order("last_message_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function adminUpdateStatus(conversationId, status) {
  const { error } = await supabase
    .from("support_conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw error;
}

// ── Legacy shims ──────────────────────────────────────────────────────────────

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
