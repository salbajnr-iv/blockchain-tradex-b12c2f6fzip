import React, { useState, useEffect } from "react";
import { Bell, TrendingUp, Zap, CreditCard, Shield, Mail, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { loadEmailPrefs, saveEmailPrefs, DEFAULT_EMAIL_PREFS } from "@/lib/emailQueue";
import { toast } from "sonner";

// ── In-app notification groups ────────────────────────────────────────────────
const INAPP_GROUPS = [
  {
    title: "Price Alerts",
    icon: TrendingUp,
    items: [
      { id: "price_above", label: "Price Above Target",  desc: "When a coin exceeds your target price",     default: true },
      { id: "price_below", label: "Price Below Target",  desc: "When a coin drops below your target price", default: true },
      { id: "volatility",  label: "High Volatility",     desc: "When 24h change exceeds your threshold",    default: true },
    ],
  },
  {
    title: "Trading Activity",
    icon: Zap,
    items: [
      { id: "trade_buy",  label: "Buy Orders",  desc: "When a buy order is executed",  default: true },
      { id: "trade_sell", label: "Sell Orders", desc: "When a sell order is executed", default: true },
    ],
  },
  {
    title: "Account & Funds",
    icon: CreditCard,
    items: [
      { id: "deposit",    label: "Deposits",    desc: "When funds are added to your account", default: true },
      { id: "withdrawal", label: "Withdrawals", desc: "When a withdrawal is processed",       default: true },
    ],
  },
  {
    title: "Security",
    icon: Shield,
    items: [
      { id: "login",           label: "New Sign-Ins",     desc: "When your account is signed into", default: true },
      { id: "password_change", label: "Password Changes", desc: "When your password is changed",    default: true },
    ],
  },
];

// ── Email notification groups ─────────────────────────────────────────────────
const EMAIL_GROUPS = [
  {
    title: "Deposits & Withdrawals",
    icon: CreditCard,
    items: [
      { id: "deposit_approved",    label: "Deposit Approved",    desc: "Email when your deposit is approved and credited" },
      { id: "deposit_rejected",    label: "Deposit Rejected",    desc: "Email when your deposit request is declined" },
      { id: "withdrawal_approved", label: "Withdrawal Approved", desc: "Email when your withdrawal is approved and sent" },
      { id: "withdrawal_rejected", label: "Withdrawal Rejected", desc: "Email when your withdrawal is not processed" },
    ],
  },
  {
    title: "Trading",
    icon: Zap,
    items: [
      { id: "trade_executed", label: "Trade Executed",  desc: "Email confirmation for every buy or sell trade" },
      { id: "order_filled",   label: "Limit Order Filled", desc: "Email when your limit order hits its target price" },
    ],
  },
  {
    title: "Alerts & Notices",
    icon: TrendingUp,
    items: [
      { id: "price_alert",   label: "Price Alerts",         desc: "Email when a price alert you set is triggered" },
      { id: "admin_message", label: "Admin Notifications",  desc: "Important messages and notices from our team" },
    ],
  },
];

function buildInAppDefaults() {
  const d = {};
  INAPP_GROUPS.forEach(g => g.items.forEach(i => { d[i.id] = i.default; }));
  return d;
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${
        checked ? "bg-primary" : "bg-secondary border border-border/50"
      }`}
      aria-label={label}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function PrefsSection({ title, icon: Icon, items, prefs, onToggle }) {
  return (
    <div className="bg-card border border-border/50 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
      </div>
      <div className="space-y-4">
        {items.map(({ id, label, desc }) => (
          <div key={id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <Toggle checked={!!prefs[id]} onChange={() => onToggle(id)} label={`Toggle ${label}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NotificationPrefs() {
  const [inAppPrefs, setInAppPrefs]   = useState(buildInAppDefaults);
  const [emailPrefs, setEmailPrefs]   = useState({ ...DEFAULT_EMAIL_PREFS });
  const [userEmail, setUserEmail]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [loaded, setLoaded]           = useState(false);
  const [activeTab, setActiveTab]     = useState("inapp");

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserEmail(user?.email ?? "");

        // Load in-app prefs from user_metadata
        const metaInApp = user?.user_metadata?.notif_prefs;
        if (metaInApp && typeof metaInApp === "object") {
          setInAppPrefs({ ...buildInAppDefaults(), ...metaInApp });
        } else {
          try {
            const local = localStorage.getItem("bt-notif-prefs");
            if (local) setInAppPrefs({ ...buildInAppDefaults(), ...JSON.parse(local) });
          } catch {}
        }

        // Load email prefs
        const emailP = await loadEmailPrefs();
        setEmailPrefs(emailP);
      } catch {
        try {
          const local = localStorage.getItem("bt-notif-prefs");
          if (local) setInAppPrefs({ ...buildInAppDefaults(), ...JSON.parse(local) });
        } catch {}
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  const toggleInApp = (id) => setInAppPrefs(p => ({ ...p, [id]: !p[id] }));
  const toggleEmail = (id) => setEmailPrefs(p => ({ ...p, [id]: !p[id] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save in-app prefs to user_metadata
      const { error: inAppError } = await supabase.auth.updateUser({
        data: { notif_prefs: inAppPrefs },
      });
      if (inAppError) throw inAppError;
      localStorage.setItem("bt-notif-prefs", JSON.stringify(inAppPrefs));

      // Save email prefs
      await saveEmailPrefs(emailPrefs);

      toast.success("Notification preferences saved");
    } catch (err) {
      try {
        localStorage.setItem("bt-notif-prefs", JSON.stringify(inAppPrefs));
        toast.success("Preferences saved locally");
      } catch {
        toast.error(err?.message || "Failed to save preferences");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Tab switcher */}
      <div className="flex gap-1 bg-secondary/40 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("inapp")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "inapp"
              ? "bg-card text-foreground shadow-sm border border-border/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          In-App
        </button>
        <button
          onClick={() => setActiveTab("email")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "email"
              ? "bg-card text-foreground shadow-sm border border-border/40"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          Email
        </button>
      </div>

      {/* In-App tab */}
      {activeTab === "inapp" && (
        <>
          {INAPP_GROUPS.map(({ title, icon, items }) => (
            <PrefsSection
              key={title}
              title={title}
              icon={icon}
              items={items}
              prefs={inAppPrefs}
              onToggle={toggleInApp}
            />
          ))}
        </>
      )}

      {/* Email tab */}
      {activeTab === "email" && (
        <>
          {/* Email address display */}
          <div className="bg-card border border-border/50 rounded-xl p-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Sending emails to</p>
              <p className="text-sm text-primary font-mono truncate">{userEmail || "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This is your account email. To change it, update your profile.
              </p>
            </div>
          </div>

          {/* Setup notice */}
          <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
            <Info className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-500">Email delivery requires setup</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Your preferences are saved here. To activate email delivery, a Supabase Edge Function and Resend API key must be deployed. See <code className="text-xs bg-secondary px-1 rounded">sql/email-notifications-setup.sql</code> for instructions.
              </p>
            </div>
          </div>

          {EMAIL_GROUPS.map(({ title, icon, items }) => (
            <PrefsSection
              key={title}
              title={title}
              icon={icon}
              items={items}
              prefs={emailPrefs}
              onToggle={toggleEmail}
            />
          ))}
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "Saving…" : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
}
