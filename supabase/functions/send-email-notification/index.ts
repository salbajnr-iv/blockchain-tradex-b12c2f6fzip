import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "BlockTrade <noreply@blocktrade.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface EmailQueueRecord {
  id: string;
  user_id: string;
  user_email: string;
  event_type: string;
  subject: string;
  content: Record<string, unknown>;
}

function buildHtml(eventType: string, content: Record<string, unknown>): string {
  const appName = "BlockTrade";
  const brandColor = "#10b981";

  const body = renderBody(eventType, content);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${content.subject ?? appName}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px;border-bottom:3px solid ${brandColor};">
            <span style="font-size:22px;font-weight:700;color:#ffffff;">
              Block<span style="color:${brandColor};">Trade</span>
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #334155;background:#0f172a;">
            <p style="margin:0;font-size:11px;color:#64748b;text-align:center;">
              You received this email because you have email notifications enabled on BlockTrade.<br/>
              To manage your preferences, visit <strong>Settings → Notifications</strong> in the app.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderBody(eventType: string, content: Record<string, unknown>): string {
  const brandColor = "#10b981";
  const textColor = "#e2e8f0";
  const mutedColor = "#94a3b8";

  const pill = (text: string, color: string) =>
    `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${color}22;color:${color};font-size:12px;font-weight:600;">${text}</span>`;

  const row = (label: string, value: string) =>
    `<tr>
       <td style="padding:8px 0;color:${mutedColor};font-size:13px;width:40%;">${label}</td>
       <td style="padding:8px 0;color:${textColor};font-size:13px;font-weight:600;text-align:right;">${value}</td>
     </tr>`;

  switch (eventType) {
    case "deposit_approved":
      return `
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${brandColor};text-transform:uppercase;letter-spacing:.08em;">Deposit</p>
        <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:${textColor};">Deposit Approved ✅</h1>
        <p style="margin:0 0 24px;font-size:15px;color:${mutedColor};">Your funds have been added to your portfolio.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #334155;border-radius:8px;padding:16px;background:#0f172a;">
          ${row("Amount", `$${content.amount ?? "—"}`)}
          ${row("Status", "Approved")}
          ${content.method ? row("Method", String(content.method)) : ""}
          ${row("Date", String(content.date ?? new Date().toLocaleDateString()))}
        </table>`;

    case "deposit_rejected":
      return `
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#f87171;text-transform:uppercase;letter-spacing:.08em;">Deposit</p>
        <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:${textColor};">Deposit Rejected ❌</h1>
        <p style="margin:0 0 24px;font-size:15px;color:${mutedColor};">Your deposit request was not approved. Please contact support if you have questions.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #334155;border-radius:8px;padding:16px;background:#0f172a;">
          ${row("Amount", `$${content.amount ?? "—"}`)}
          ${row("Status", "Rejected")}
          ${row("Date", String(content.date ?? new Date().toLocaleDateString()))}
        </table>`;

    case "withdrawal_approved":
      return `
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${brandColor};text-transform:uppercase;letter-spacing:.08em;">Withdrawal</p>
        <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:${textColor};">Withdrawal Approved ✅</h1>
        <p style="margin:0 0 24px;font-size:15px;color:${mutedColor};">Your withdrawal has been approved and is on its way.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #334155;border-radius:8px;padding:16px;background:#0f172a;">
          ${row("Amount", `$${content.amount ?? "—"}`)}
          ${row("Status", "Approved")}
          ${content.method ? row("Destination", String(content.method)) : ""}
          ${row("Date", String(content.date ?? new Date().toLocaleDateString()))}
        </table>`;

    case "withdrawal_rejected":
      return `
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#f87171;text-transform:uppercase;letter-spacing:.08em;">Withdrawal</p>
        <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:${textColor};">Withdrawal Rejected ❌</h1>
        <p style="margin:0 0 24px;font-size:15px;color:${mutedColor};">Your withdrawal was not processed. Your funds have been returned to your account.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #334155;border-radius:8px;padding:16px;background:#0f172a;">
          ${row("Amount", `$${content.amount ?? "—"}`)}
          ${row("Status", "Rejected")}
          ${row("Date", String(content.date ?? new Date().toLocaleDateString()))}
        </table>`;

    case "trade_executed":
      return `
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${brandColor};text-transform:uppercase;letter-spacing:.08em;">Trade Confirmation</p>
        <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:${textColor};">${content.side === "buy" ? "Buy" : "Sell"} Order Executed</h1>
        <p style="margin:0 0 24px;font-size:15px;color:${mutedColor};">Your trade was executed successfully.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #334155;border-radius:8px;padding:16px;background:#0f172a;">
          ${row("Asset", String(content.symbol ?? "—"))}
          ${row("Side", content.side === "buy" ? "Buy" : "Sell")}
          ${row("Quantity", String(content.quantity ?? "—"))}
          ${row("Price", `$${content.price ?? "—"}`)}
          ${row("Total", `$${content.total ?? "—"}`)}
          ${row("Date", String(content.date ?? new Date().toLocaleDateString()))}
        </table>`;

    case "order_filled":
      return `
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${brandColor};text-transform:uppercase;letter-spacing:.08em;">Limit Order</p>
        <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:${textColor};">Order Filled ✅</h1>
        <p style="margin:0 0 24px;font-size:15px;color:${mutedColor};">Your limit order was filled at your target price.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #334155;border-radius:8px;padding:16px;background:#0f172a;">
          ${row("Asset", String(content.symbol ?? "—"))}
          ${row("Side", content.side === "buy" ? "Buy" : "Sell")}
          ${row("Fill Price", `$${content.price ?? "—"}`)}
          ${row("Date", String(content.date ?? new Date().toLocaleDateString()))}
        </table>`;

    case "price_alert":
      return `
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#facc15;text-transform:uppercase;letter-spacing:.08em;">Price Alert</p>
        <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:${textColor};">${content.symbol} Alert Triggered</h1>
        <p style="margin:0 0 24px;font-size:15px;color:${mutedColor};">${content.message ?? "Your price alert has been triggered."}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #334155;border-radius:8px;padding:16px;background:#0f172a;">
          ${row("Asset", String(content.symbol ?? "—"))}
          ${row("Alert Type", String(content.alertType ?? "—"))}
          ${row("Target", `$${content.threshold ?? "—"}`)}
          ${row("Date", String(content.date ?? new Date().toLocaleDateString()))}
        </table>`;

    case "admin_message":
      return `
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${brandColor};text-transform:uppercase;letter-spacing:.08em;">Account Notice</p>
        <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:${textColor};">Message from BlockTrade</h1>
        <p style="margin:0 0 24px;font-size:15px;color:${mutedColor};">${content.message ?? "You have a new message from our team."}</p>`;

    default:
      return `<p style="color:${textColor};font-size:15px;">${content.message ?? "You have a new notification from BlockTrade."}</p>`;
  }
}

async function markSent(id: string, error?: string) {
  const body: Record<string, unknown> = error
    ? { status: "failed", error }
    : { status: "sent", sent_at: new Date().toISOString() };

  await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: { record?: EmailQueueRecord } = {};
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const record = payload.record;
  if (!record?.id) {
    return new Response("No record", { status: 400 });
  }

  const html = buildHtml(record.event_type, record.content);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [record.user_email],
        subject: record.subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      await markSent(record.id, text);
      return new Response("Email send failed", { status: 500 });
    }

    await markSent(record.id);
    return new Response("OK", { status: 200 });
  } catch (err) {
    await markSent(record.id, String(err));
    return new Response("Internal error", { status: 500 });
  }
});
