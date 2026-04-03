import React, { useState } from "react";
import { Bell, TrendingUp, TrendingDown, Zap, CreditCard, ArrowUpRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NOTIFICATION_GROUPS = [
  {
    title: "Price Alerts",
    icon: TrendingUp,
    items: [
      { id: "price_above", label: "Price Above Target", desc: "When a coin exceeds your target price", default: true },
      { id: "price_below", label: "Price Below Target", desc: "When a coin drops below your target price", default: true },
      { id: "volatility",  label: "High Volatility",   desc: "When 24h change exceeds your threshold", default: true },
    ],
  },
  {
    title: "Trading Activity",
    icon: Zap,
    items: [
      { id: "trade_buy",  label: "Buy Orders",  desc: "When a buy order is executed", default: true },
      { id: "trade_sell", label: "Sell Orders", desc: "When a sell order is executed", default: true },
    ],
  },
  {
    title: "Account & Funds",
    icon: CreditCard,
    items: [
      { id: "deposit",    label: "Deposits",    desc: "When funds are added to your account",     default: true },
      { id: "withdrawal", label: "Withdrawals", desc: "When a withdrawal is processed",            default: true },
    ],
  },
  {
    title: "Security",
    icon: Shield,
    items: [
      { id: "login",          label: "New Sign-Ins",       desc: "When your account is signed into", default: true },
      { id: "password_change", label: "Password Changes",  desc: "When your password is changed",    default: true },
    ],
  },
];

export default function NotificationPrefs() {
  const [prefs, setPrefs] = useState(() => {
    const initial = {};
    NOTIFICATION_GROUPS.forEach(g => g.items.forEach(i => { initial[i.id] = i.default; }));
    return initial;
  });

  const toggle = (id) => setPrefs(p => ({ ...p, [id]: !p[id] }));

  const handleSave = () => {
    try {
      localStorage.setItem("bt-notif-prefs", JSON.stringify(prefs));
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    }
  };

  return (
    <div className="space-y-6">
      {NOTIFICATION_GROUPS.map(({ title, icon: Icon, items }) => (
        <div key={title} className="bg-card border border-border/50 rounded-xl p-6">
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
                <button
                  onClick={() => toggle(id)}
                  className={`w-10 h-5 rounded-full transition-colors ${prefs[id] ? "bg-primary" : "bg-secondary border border-border/50"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform m-0.5 ${prefs[id] ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
