import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bell, ArrowLeft, TrendingUp, TrendingDown, BarChart2, Zap,
  ArrowUpRight, Info, ClipboardList, History, Megaphone, ShieldCheck,
  CheckCheck, Clock, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAdminNotifications } from "@/lib/api/adminNotifications";

const NOTIF_CACHE_KEY = "bt_notif_detail_cache";

function saveToCache(notif) {
  try {
    const existing = JSON.parse(localStorage.getItem(NOTIF_CACHE_KEY) || "{}");
    existing[notif.id] = { ...notif, timestamp: notif.timestamp?.toString() };
    const keys = Object.keys(existing);
    if (keys.length > 50) delete existing[keys[0]];
    localStorage.setItem(NOTIF_CACHE_KEY, JSON.stringify(existing));
  } catch {}
}

function loadFromCache(id) {
  try {
    const existing = JSON.parse(localStorage.getItem(NOTIF_CACHE_KEY) || "{}");
    const n = existing[id];
    if (!n) return null;
    return { ...n, timestamp: n.timestamp ? new Date(n.timestamp) : new Date() };
  } catch {
    return null;
  }
}

function getTypeConfig(n) {
  const map = {
    welcome:                { icon: Bell,          bg: "bg-primary/15",       color: "text-primary",       label: "Welcome" },
    market_mover:           { icon: TrendingUp,    bg: "bg-emerald-500/10",   color: "text-emerald-500",   label: "Market Update" },
    portfolio_change:       { icon: BarChart2,     bg: "bg-primary/10",       color: "text-primary",       label: "Portfolio" },
    price_above:            { icon: TrendingUp,    bg: "bg-primary/10",       color: "text-primary",       label: "Price Alert" },
    price_below:            { icon: TrendingDown,  bg: "bg-destructive/10",   color: "text-destructive",   label: "Price Alert" },
    price_volatility:       { icon: Zap,           bg: "bg-yellow-400/10",    color: "text-yellow-400",    label: "Volatility Alert" },
    volatility:             { icon: Zap,           bg: "bg-yellow-400/10",    color: "text-yellow-400",    label: "Volatility Alert" },
    transaction_deposit:    { icon: ArrowUpRight,  bg: "bg-emerald-500/10",   color: "text-emerald-500",   label: "Deposit" },
    transaction_withdrawal: { icon: ArrowUpRight,  bg: "bg-orange-500/10",    color: "text-orange-500",    label: "Withdrawal" },
    transaction:            { icon: History,       bg: "bg-secondary/60",     color: "text-muted-foreground", label: "Transaction" },
    order_filled:           { icon: CheckCheck,    bg: "bg-emerald-500/10",   color: "text-emerald-500",   label: "Order Filled" },
    order:                  { icon: ClipboardList, bg: "bg-primary/10",       color: "text-primary",       label: "Order" },
    trade:                  { icon: ClipboardList, bg: "bg-primary/10",       color: "text-primary",       label: "Trade" },
    announcement:           { icon: Megaphone,     bg: "bg-violet-500/10",    color: "text-violet-400",    label: "Announcement" },
    admin:                  { icon: Megaphone,     bg: "bg-violet-500/10",    color: "text-violet-400",    label: "Admin" },
    security:               { icon: ShieldCheck,   bg: "bg-blue-500/10",      color: "text-blue-400",      label: "Security" },
  };
  return map[n?.type] || { icon: Info, bg: "bg-secondary/60", color: "text-muted-foreground", label: "Notification" };
}

function fmtFull(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleString([], {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getRelatedLink(n) {
  if (!n) return null;
  if (n.type === "transaction_deposit" || n.type === "transaction_withdrawal" || n.type === "transaction") {
    return { label: "View Transactions", path: "/transactions" };
  }
  if (n.type === "order" || n.type === "order_filled") {
    return { label: "View Orders", path: "/orders" };
  }
  if (n.type === "trade") {
    return { label: "View Transactions", path: "/transactions" };
  }
  if (n.type === "price_above" || n.type === "price_below" || n.type === "price_volatility" || n.type === "volatility") {
    return { label: "Manage Alerts", path: "/alerts" };
  }
  if (n.type === "market_mover") {
    const sym = n.symbol;
    return sym ? { label: `Trade ${sym}`, path: `/trade?coin=${sym}` } : { label: "View Markets", path: "/markets" };
  }
  if (n.type === "portfolio_change") {
    return { label: "View Portfolio", path: "/assets" };
  }
  return null;
}

const MARK_READ_KEY = "bt_notif_read_ids";
function markRead(id) {
  try {
    const existing = new Set(JSON.parse(localStorage.getItem(MARK_READ_KEY) || "[]"));
    existing.add(id);
    localStorage.setItem(MARK_READ_KEY, JSON.stringify([...existing]));
  } catch {}
}

export default function NotificationDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [notif, setNotif] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fromState = location.state?.notif;
    if (fromState) {
      const n = { ...fromState, timestamp: fromState.timestamp ? new Date(fromState.timestamp) : new Date() };
      setNotif(n);
      saveToCache(n);
      markRead(id);
      return;
    }

    const fromCache = loadFromCache(id);
    if (fromCache) {
      setNotif(fromCache);
      markRead(id);
      return;
    }

    if (id?.startsWith("admin-")) {
      setLoading(true);
      fetchAdminNotifications()
        .then((data) => {
          const rawId = id.replace("admin-", "");
          const found = data.find((n) => String(n.id) === rawId);
          if (found) {
            const n = {
              id,
              rawId: found.id,
              type: found.type || "announcement",
              title: found.title,
              message: found.message,
              icon: found.icon,
              timestamp: new Date(found.created_at),
              source: "admin",
            };
            setNotif(n);
            saveToCache(n);
            markRead(id);
          } else {
            setError("Notification not found.");
          }
        })
        .catch(() => setError("Could not load notification."))
        .finally(() => setLoading(false));
    } else {
      setError("Notification not found. It may have expired.");
    }
  }, [id, location.state]);

  const cfg = getTypeConfig(notif);
  const Icon = cfg.icon;
  const relatedLink = getRelatedLink(notif);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to notifications
      </Button>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-24 space-y-3">
          <Bell className="w-12 h-12 text-muted-foreground/20 mx-auto" />
          <p className="text-muted-foreground font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/notifications")}>
            Go to Notifications
          </Button>
        </div>
      )}

      {notif && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Header card */}
          <div className="bg-card border border-border/40 rounded-2xl p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                {notif.icon && typeof notif.icon === "string" && notif.icon.length <= 2 ? (
                  <span className="text-2xl">{notif.icon}</span>
                ) : (
                  <Icon className={`w-6 h-6 ${cfg.color}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  {notif.source === "admin" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/10 text-violet-400">
                      <Megaphone className="w-2.5 h-2.5" />
                      Admin
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-foreground leading-tight">{notif.title}</h1>
              </div>
            </div>

            <p className="text-sm text-foreground/80 leading-relaxed bg-secondary/30 rounded-xl p-4">
              {notif.message}
            </p>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{fmtFull(notif.timestamp)}</span>
            </div>
          </div>

          {/* Meta details card */}
          <div className="bg-card border border-border/40 rounded-2xl divide-y divide-border/40 overflow-hidden">
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</span>
              <span className="text-sm text-foreground font-medium">{cfg.label}</span>
            </div>
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source</span>
              <span className="text-sm text-foreground font-medium capitalize">
                {notif.source === "admin" ? "Platform Admin" : "System"}
              </span>
            </div>
            {notif.symbol && (
              <div className="px-5 py-3.5 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Asset</span>
                <span className="text-sm text-foreground font-semibold">{notif.symbol}</span>
              </div>
            )}
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notification ID</span>
              <span className="text-xs text-muted-foreground font-mono">{notif.id}</span>
            </div>
          </div>

          {/* Related action */}
          {relatedLink && (
            <div className="bg-card border border-border/40 rounded-2xl p-5 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Related</p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-sm w-full justify-between"
                onClick={() => navigate(relatedLink.path)}
              >
                <span>{relatedLink.label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
