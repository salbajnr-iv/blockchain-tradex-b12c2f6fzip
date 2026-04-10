import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Bell, CheckCheck, Trash2, X, TrendingUp, TrendingDown, BarChart2,
  Zap, ArrowUpRight, Info, ClipboardList, History, Megaphone, ShieldCheck,
  RefreshCw, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";
import { useLivePrices } from "@/hooks/useLivePrices";
import { fetchAdminNotifications } from "@/lib/api/adminNotifications";
import { supabase } from "@/lib/supabaseClient";

const DETAIL_CACHE_KEY = "bt_notif_detail_cache";
function saveDetailCache(notif) {
  try {
    const existing = JSON.parse(localStorage.getItem(DETAIL_CACHE_KEY) || "{}");
    existing[notif.id] = { ...notif, timestamp: notif.timestamp?.toString() };
    const keys = Object.keys(existing);
    if (keys.length > 50) delete existing[keys[0]];
    localStorage.setItem(DETAIL_CACHE_KEY, JSON.stringify(existing));
  } catch {}
}

const READ_KEY = "bt_notif_read_ids";

function getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); }
  catch { return new Set(); }
}
function markReadInStorage(ids) {
  const existing = getReadIds();
  ids.forEach((id) => existing.add(id));
  localStorage.setItem(READ_KEY, JSON.stringify([...existing]));
}

function getIcon(n) {
  switch (n.type) {
    case "welcome":                return <Bell className="w-4 h-4 text-primary" />;
    case "market_mover":           return n.message?.includes("up") || n.message?.includes("surging")
      ? <TrendingUp className="w-4 h-4 text-emerald-500" />
      : <TrendingDown className="w-4 h-4 text-red-500" />;
    case "portfolio_change":       return <BarChart2 className="w-4 h-4 text-primary" />;
    case "price_above":            return <TrendingUp className="w-4 h-4 text-primary" />;
    case "price_below":            return <TrendingDown className="w-4 h-4 text-destructive" />;
    case "price_volatility":
    case "volatility":             return <Zap className="w-4 h-4 text-yellow-400" />;
    case "transaction_deposit":    return <ArrowUpRight className="w-4 h-4 text-emerald-500" />;
    case "transaction_withdrawal": return <ArrowUpRight className="w-4 h-4 text-orange-500 rotate-90" />;
    case "transaction":            return <History className="w-4 h-4 text-muted-foreground" />;
    case "order_filled":           return <CheckCheck className="w-4 h-4 text-emerald-500" />;
    case "order":                  return <ClipboardList className="w-4 h-4 text-primary" />;
    case "announcement":
    case "admin":                  return <Megaphone className="w-4 h-4 text-violet-400" />;
    case "security":               return <ShieldCheck className="w-4 h-4 text-blue-400" />;
    default:                       return <Info className="w-4 h-4 text-muted-foreground" />;
  }
}

function getIconBg(n) {
  switch (n.type) {
    case "welcome":                return "bg-primary/15";
    case "market_mover":           return n.message?.includes("up") ? "bg-emerald-500/10" : "bg-red-500/10";
    case "portfolio_change":       return "bg-primary/10";
    case "price_above":            return "bg-primary/10";
    case "price_below":            return "bg-destructive/10";
    case "price_volatility":
    case "volatility":             return "bg-yellow-400/10";
    case "transaction_deposit":    return "bg-emerald-500/10";
    case "transaction_withdrawal": return "bg-orange-500/10";
    case "announcement":
    case "admin":                  return "bg-violet-500/10";
    case "security":               return "bg-blue-500/10";
    default:                       return "bg-secondary/60";
  }
}

const FILTERS = ["all", "market", "portfolio", "transaction", "admin"];

export default function Notifications() {
  const navigate = useNavigate();
  const { cryptoList } = useLivePrices();
  const { notifications: sysNotifs, dismiss, clearAll } = useSystemNotifications({ cryptoList });
  const [adminNotifs, setAdminNotifs] = useState([]);
  const [readIds, setReadIds] = useState(getReadIds);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const loadAdminNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminNotifications();
      setAdminNotifs(data.map((n) => ({
        id: `admin-${n.id}`,
        rawId: n.id,
        type: n.type || "announcement",
        title: n.title,
        message: n.message,
        icon: n.icon,
        timestamp: new Date(n.created_at),
        source: "admin",
      })));
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdminNotifs(); }, [loadAdminNotifs]);

  // Realtime admin notif subscription
  useEffect(() => {
    const ch = supabase
      .channel("admin_notif_page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, () => {
        loadAdminNotifs();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadAdminNotifs]);

  const allNotifs = [
    ...adminNotifs,
    ...sysNotifs.map((n) => ({ ...n, source: n.source || "system" })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const filtered = allNotifs.filter((n) => {
    if (filter === "all") return true;
    if (filter === "market") return ["market_mover", "price_above", "price_below", "price_volatility", "volatility", "welcome"].includes(n.type);
    if (filter === "portfolio") return ["portfolio_change", "trade", "order", "order_filled"].includes(n.type);
    if (filter === "transaction") return n.type?.startsWith("transaction");
    if (filter === "admin") return n.source === "admin" || n.type === "announcement";
    return true;
  });

  const unreadCount = allNotifs.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = () => {
    const ids = allNotifs.map((n) => n.id);
    markReadInStorage(ids);
    setReadIds(getReadIds());
  };

  const markOneRead = (id) => {
    markReadInStorage([id]);
    setReadIds(getReadIds());
  };

  const handleDismiss = (n) => {
    markOneRead(n.id);
    if (n.source !== "admin") dismiss(n.id);
  };

  const handleNotifClick = (n) => {
    markOneRead(n.id);
    saveDetailCache(n);
    navigate(`/notifications/${n.id}`, { state: { notif: n } });
  };

  const handleClearAll = () => {
    markAllRead();
    clearAll();
  };

  const fmtTime = (ts) => {
    const d = ts instanceof Date ? ts : new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffM = Math.floor(diffMs / 60000);
    if (diffM < 1) return "Just now";
    if (diffM < 60) return `${diffM}m ago`;
    const diffH = Math.floor(diffM / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadAdminNotifs} className="text-muted-foreground h-8 px-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs h-8 gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
          {allNotifs.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll} className="text-xs h-8 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No notifications</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {filter === "all" ? "System and market alerts will appear here" : `No ${filter} notifications yet`}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {filtered.map((n) => {
              const isUnread = !readIds.has(n.id);
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handleNotifClick(n)}
                  className={`relative flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer group ${
                    isUnread
                      ? "bg-primary/5 border-primary/20 hover:bg-primary/8"
                      : "bg-card border-border/40 hover:bg-secondary/30"
                  }`}
                >
                  {isUnread && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getIconBg(n)}`}>
                    {n.icon && typeof n.icon === "string" && n.icon.length <= 2 ? (
                      <span className="text-base">{n.icon}</span>
                    ) : (
                      getIcon(n)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold ${isUnread ? "text-foreground" : "text-foreground/80"}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5">{fmtTime(n.timestamp)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {n.source === "admin" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full">
                          <Megaphone className="w-2.5 h-2.5" />
                          Admin
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/50 group-hover:text-primary/60 transition-colors">
                        View details <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDismiss(n); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-muted-foreground transition-all shrink-0 mt-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
