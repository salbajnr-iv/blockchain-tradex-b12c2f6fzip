import { supabase } from "@/lib/supabaseClient";

const DEFAULT_EMAIL_PREFS = {
  deposit_approved:    true,
  deposit_rejected:    true,
  withdrawal_approved: true,
  withdrawal_rejected: true,
  trade_executed:      false,
  order_filled:        true,
  price_alert:         true,
  admin_message:       true,
};

async function getEmailPrefsAndUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;
    const stored = user.user_metadata?.email_notif_prefs;
    const prefs = stored && typeof stored === "object"
      ? { ...DEFAULT_EMAIL_PREFS, ...stored }
      : DEFAULT_EMAIL_PREFS;
    return { userId: user.id, email: user.email, prefs };
  } catch {
    return null;
  }
}

export async function enqueueEmail(eventType, subject, templateData) {
  try {
    const ctx = await getEmailPrefsAndUser();
    if (!ctx) return;
    if (!ctx.prefs[eventType]) return;

    await supabase.from("email_queue").insert({
      user_id:   ctx.userId,
      user_email: ctx.email,
      event_type: eventType,
      subject,
      content: templateData,
      status: "pending",
    });
  } catch {
  }
}

export async function loadEmailPrefs() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const stored = user?.user_metadata?.email_notif_prefs;
    if (stored && typeof stored === "object") {
      return { ...DEFAULT_EMAIL_PREFS, ...stored };
    }
  } catch {}
  return { ...DEFAULT_EMAIL_PREFS };
}

export async function saveEmailPrefs(prefs) {
  const { error } = await supabase.auth.updateUser({
    data: { email_notif_prefs: prefs },
  });
  if (error) throw error;
}

export { DEFAULT_EMAIL_PREFS };
