import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, CheckCheck, Trash2, X, TrendingUp, TrendingDown, BarChart2,
  Zap, ArrowUpRight, ArrowDownLeft, Info, ClipboardList, History,
  Megaphone, ShieldCheck, RefreshCw, ChevronRight, DollarSign,
  BellRing, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSystemNotifications } from "@/hooks/useSystemNotifications";
import { useLivePrices } from "@/hooks/useLivePrices";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { fetchAdminNotifications } from "@/lib/api/adminNotifications";
import { listAlerts } from "@/lib/api/alerts";
import { listTrades } from "@/lib/api/portfolio";
import { listTransactions } from "@/lib/api/transactions";
import { supabase } from "@/lib/supabaseClient";
import AlertManager from "@/components/crypto/AlertManager";

// ── Read state (localStorage) ─────────────────────────────────────────────────
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

// ── Icon helpers ──────────────────────────────────────────────────────────────
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
    case "transaction_deposit":
    case "DEPOSIT":                return <DollarSign className="w-4 h-4 text-emerald-500" />;
    case "transaction_withdrawal":
    case "WITHDRAWAL":             return <ArrowUpRight className="w-4 h-4 text-orange-500" />;
    case "transaction":            return <History className="w-4 h-4 text-muted-foreground" />;
    case "BUY":                    return <ArrowDownLeft className="w-4 h-4 text-primary" />;
    case "SELL":                   return <ArrowUpRight className="w-4 h-4 text-destructive" />;
    case "trade":                  return n.side === "buy" || n.message?.toLowerCase().includes("bought")
      ? <TrendingUp className="w-4 h-4 text-emerald-500" />
      : <TrendingDown className="w-4 h-4 text-red-500" />;
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
    case "transaction_deposit":
    case "DEPOSIT":                return "bg-emerald-500/10";
    case "transaction_withdrawal":
    case "WITHDRAWAL":             return "bg-orange-500/10";
    case "BUY":                    return "bg-primary/10";
    case "SELL":                   return "bg-destructive/10";
    case "trade":                  return n.message?.toLowerCase().includes("bought") ? "bg-emerald-500/10" : "bg-red-500/10";
    case "order":
    case "order_filled":           return "bg-emerald-500/10";
    case "announcement":
    case "admin":                  return "bg-violet-500/10";
    case "security":               return "bg-blue-500/10";
    default:                       return "bg-secondary/60";
  }
}

function fmtTime(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  const now = new Date();
  const diffM = Math.floor((now - d) / 60000);
  if (diffM < 1) return "Just now";
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTERS = [
  { id: "all",           label: "All" },
  { id: "price_alerts",  label: "Price Alerts" },
  { id: "trades",        label: "Trades" },
  { id: "transactions",  label: "Deposits & Withdrawals" },
  { id: "system",        label: "System" },
  { id: "admin",         label: "Admin" },
];

export default function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { cryptoList, portfolioTotal } = useLivePrices();
  const { portfolioId } = usePortfolio();

  const [filter, setFilter]           = useState("all");
  const [readIds, setReadIds]         = useState(getReadIds);
  const [loading, setLoading]         = useState(false);
  const [adminNotifs, setAdminNotifs] = useState([]);
  const [showManager, setShowManager] = useState(false);

  // System notifications (market movers, portfolio changes, welcome etc.)
  const { notifications: sysNotifs, dismiss, clearAll: clearSys, markAllRead: markSysAllRead, unreadCount: sysUnread } =
    useSystemNotifications({ cryptoList, portfolioTotal });

  // Price alerts from DB
  const { data: alerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ["alerts", portfolioId],
    queryFn: () => listAlerts(portfolioId),
    enabled: !!portfolioId,
    initialData: [],
  });

  // Trades from DB
  const { data: trades = [] } = useQuery({
    queryKey: ["trades", portfolioId],
    queryFn: () => listTrades(portfolioId, 50),
    enabled: !!portfolioId,
    initialData: [],
  });

  // Transactions from DB
  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", portfolioId],
    queryFn: () => listTransactions(portfolioId, 50),
    enabled: !!portfolioId,
    initialData: [],
  });

  // Admin notifications
  const loadAdminNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminNotifications();
      setAdminNotifs(data.map((n) => ({
        id: `admin-${n.id}`,
        rawId: n.id,
        type: n.type || "announcement",
        category: "admin",
        title: n.title,
        message: n.message,
        icon: n.icon,
        timestamp: new Date(n.created_at),
        source: "admin",
        clickable: true,
      })));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAdminNotifs(); }, [loadAdminNotifs]);

  // Realtime subscriptions
  useEffect(() => {
    if (!portfolioId) return;
    const ch = supabase
      .channel(`realtime:alerts-page:${portfolioId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "price_alerts", filter: `portfolio_id=eq.${portfolioId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["alerts", portfolioId] });
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [portfolioId, queryClient]);

  useEffect(() => {
    const ch = supabase
      .channel("admin_notif_unified")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, () => {
        loadAdminNotifs();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadAdminNotifs]);

  // Build price map for AlertManager
  const cryptoPrices = cryptoList.reduce((acc, c) => { acc[c.symbol] = c.price; return acc; }, {});
  const cryptoChanges = cryptoList.reduce((acc, c) => { acc[c.symbol] = c.change24h; return acc; }, {});

  // ── Build unified feed ──────────────────────────────────────────────────────
  const alertItems = alerts.map((a) => ({
    id: `alert-${a.id}`,
    type: a.alert_type,
    category: "price_alerts",
    title: a.alert_type === "price_above"
      ? `${a.crypto_symbol} — Price Above Alert`
      : a.alert_type === "price_below"
      ? `${a.crypto_symbol} — Price Below Alert`
      : `${a.crypto_symbol} — Volatility Alert`,
    message: a.is_triggered
      ? `Triggered at $${a.current_price?.toLocaleString() || a.threshold_value?.toLocaleString()}`
      : `Target: ${a.alert_type === "volatility" ? "" : "$"}${a.threshold_value?.toLocaleString()}${a.alert_type === "volatility" ? "%" : ""}`,
    statusBadge: a.is_triggered ? "triggered" : a.is_active ? "active" : "inactive",
    timestamp: new Date(a.triggered_at || a.created_at),
    source: "db",
    clickable: false,
  }));

  const tradeItems = trades.map((t) => ({
    id: `trade-${t.id}`,
    type: t.type,
    category: "trades",
    title: `${t.type === "BUY" ? "Bought" : "Sold"} ${t.symbol}`,
    message: `${Number(t.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${t.symbol} @ $${Number(t.unit_price).toLocaleString(undefined, { maximumFractionDigits: 2 })} · Total: $${Number(t.net_value || t.quantity * t.unit_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    statusBadge: "completed",
    timestamp: new Date(t.trade_date),
    source: "db",
    clickable: false,
  }));

  const txItems = transactions
    .filter((t) => ["DEPOSIT", "WITHDRAWAL"].includes(t.type))
    .map((t) => ({
      id: `tx-${t.id}`,
      type: t.type,
      category: "transactions",
      title: t.type === "DEPOSIT" ? "Funds Deposited" : "Withdrawal Processed",
      message: `$${Number(t.total_amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} · ${t.status}`,
      statusBadge: t.status,
      timestamp: new Date(t.transaction_date),
      source: "db",
      clickable: false,
    }));

  const sysItems = sysNotifs.map((n) => ({
    ...n,
    category: "system",
    message: n.message,
    timestamp: n.timestamp instanceof Date ? n.timestamp : new Date(n.timestamp),
    source: "system",
    clickable: true,
  }));

  const allItems = [
    ...adminNotifs,
    ...sysItems,
    ...alertItems,
    ...tradeItems,
    ...txItems,
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = allItems.filter((n) => {
    if (filter === "all")          return true;
    if (filter === "price_alerts") return n.category === "price_alerts";
    if (filter === "trades")       return n.category === "trades";
    if (filter === "transactions") return n.category === "transactions";
    if (filter === "system")       return n.category === "system";
    if (filter === "admin")        return n.source === "admin" || n.type === "announcement";
    return true;
  });

  const counts = FILTERS.reduce((acc, f) => {
    if (f.id === "all") { acc[f.id] = allItems.length; return acc; }
    acc[f.id] = allItems.filter((n) => {
      if (f.id === "price_alerts") return n.category === "price_alerts";
      if (f.id === "trades")       return n.category === "trades";
      if (f.id === "transactions") return n.category === "transactions";
      if (f.id === "system")       return n.category === "system";
      if (f.id === "admin")        return n.source === "admin" || n.type === "announcement";
      return false;
    }).length;
    return acc;
  }, {});

  // Unread: system + admin only (DB items don't have unread state)
  const unreadSystemIds = sysItems.filter((n) => !readIds.has(n.id)).map((n) => n.id);
  const unreadAdminIds  = adminNotifs.filter((n) => !readIds.has(n.id)).map((n) => n.id);
  const unreadCount     = sysUnread + unreadAdminIds.length;

  // Stats
  const triggeredAlerts = alerts.filter((a) => a.is_triggered).length;
  const activeAlerts    = alerts.filter((a) => a.is_active && !a.is_triggered).length;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const markAllRead = () => {
    const ids = [...sysItems, ...adminNotifs].map((n) => n.id);
    markReadInStorage(ids);
    setReadIds(getReadIds());
    markSysAllRead?.();
  };

  const markOneRead = (id) => {
    markReadInStorage([id]);
    setReadIds(getReadIds());
  };

  const handleDismiss = (n) => {
    markOneRead(n.id);
    if (n.source === "system") dismiss(n.id);
  };

  const handleClearAll = () => {
    markAllRead();
    clearSys();
  };

  const handleClick = (n) => {
    if (!n.clickable) return;
    markOneRead(n.id);
    saveDetailCache(n);
    navigate(`/notifications/${n.id}`, { state: { notif: n } });
  };

  const isUnread = (n) =>
    (n.source === "system" || n.source === "admin") && !readIds.has(n.id);

  const statusBadgeClass = (s) => {
    if (s === "triggered" || s === "completed") return "bg-primary/10 text-primary";
    if (s === "active")   return "bg-yellow-400/10 text-yellow-400";
    if (s === "pending")  return "bg-orange-400/10 text-orange-400";
    return "bg-secondary text-muted-foreground";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "All activity across your account"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowManager((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
              showManager
                ? "bg-primary/15 border-primary/30 text-primary"
                : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            <BellRing className="w-4 h-4" />
            Manage Price Alerts
          </button>
          <Button variant="ghost" size="sm" onClick={loadAdminNotifs} className="text-muted-foreground h-8 px-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs h-8 gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
          {allItems.length > 0 && (
            <Button
              variant="outline" size="sm" onClick={handleClearAll}
              className="text-xs h-8 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Events",  value: allItems.length,  color: "text-foreground" },
          { label: "Active Alerts", value: activeAlerts,      color: "text-primary" },
          { label: "Triggered",     value: triggeredAlerts,   color: "text-yellow-400" },
          { label: "Unread",        value: unreadCount,        color: "text-primary" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Alert manager panel */}
      <AnimatePresence>
        {showManager && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <AlertManager
              alerts={alerts}
              onAlertsUpdate={refetchAlerts}
              cryptoPrices={cryptoPrices}
              cryptoChanges={cryptoChanges}
              portfolioId={portfolioId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              filter === f.id ? "bg-white/20" : "bg-secondary text-muted-foreground"
            }`}>
              {counts[f.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Unified feed */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-xl py-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto">
            <Bell className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {filter === "all" ? "No notifications yet" : `No ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} yet`}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {filtered.map((n, i) => {
              const unread = isUnread(n);
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.18, delay: i < 10 ? i * 0.02 : 0 }}
                  onClick={() => handleClick(n)}
                  className={`relative flex items-start gap-3 p-4 rounded-xl border transition-colors group ${
                    n.clickable ? "cursor-pointer" : "cursor-default"
                  } ${
                    unread
                      ? "bg-primary/5 border-primary/20 hover:bg-primary/8"
                      : "bg-card border-border/40 hover:bg-secondary/30"
                  }`}
                >
                  {unread && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}

                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getIconBg(n)}`}>
                    {n.icon && typeof n.icon === "string" && n.icon.length <= 2
                      ? <span className="text-base">{n.icon}</span>
                      : getIcon(n)
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold ${unread ? "text-foreground" : "text-foreground/80"}`}>
                          {n.title}
                        </p>
                        {n.statusBadge && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBadgeClass(n.statusBadge)}`}>
                            {n.statusBadge}
                          </span>
                        )}
                        {n.source === "admin" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full">
                            <Megaphone className="w-2.5 h-2.5" />
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">{fmtTime(n.timestamp)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                    {n.clickable && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/50 group-hover:text-primary/60 transition-colors mt-1">
                        View details <ChevronRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  {(n.source === "system" || n.source === "admin") && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDismiss(n); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-muted-foreground transition-all shrink-0 mt-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
