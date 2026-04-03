import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listAlerts } from "@/lib/api/alerts";
import { listTrades } from "@/lib/api/portfolio";
import { listTransactions } from "@/lib/api/transactions";
import { useLivePrices } from "@/hooks/useLivePrices";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import AlertManager from "@/components/crypto/AlertManager";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, TrendingUp, TrendingDown, Zap, ArrowDownLeft, ArrowUpRight,
  DollarSign, Shield, Filter, CheckCircle2, Clock, AlertCircle, Trash2,
} from "lucide-react";

const FILTER_TABS = ["All", "Price Alerts", "Trades", "Deposits", "Withdrawals"];

function NotifIcon({ type }) {
  const map = {
    price_above:  { icon: TrendingUp,     bg: "bg-primary/10",     color: "text-primary" },
    price_below:  { icon: TrendingDown,   bg: "bg-destructive/10", color: "text-destructive" },
    volatility:   { icon: Zap,            bg: "bg-yellow-400/10",  color: "text-yellow-400" },
    BUY:          { icon: ArrowDownLeft,  bg: "bg-primary/10",     color: "text-primary" },
    SELL:         { icon: ArrowUpRight,   bg: "bg-destructive/10", color: "text-destructive" },
    DEPOSIT:      { icon: DollarSign,     bg: "bg-primary/10",     color: "text-primary" },
    WITHDRAWAL:   { icon: ArrowUpRight,   bg: "bg-orange-400/10",  color: "text-orange-400" },
    default:      { icon: Bell,           bg: "bg-secondary",      color: "text-muted-foreground" },
  };
  const cfg = map[type] || map.default;
  const Icon = cfg.icon;
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
      <Icon className={`w-4 h-4 ${cfg.color}`} />
    </div>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Alerts() {
  const { cryptoList } = useLivePrices();
  const { portfolioId } = usePortfolio();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("All");
  const [showManager, setShowManager] = useState(false);

  const { data: alerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ["alerts", portfolioId],
    queryFn: () => listAlerts(portfolioId),
    enabled: !!portfolioId,
    initialData: [],
  });

  const { data: trades = [] } = useQuery({
    queryKey: ["trades", portfolioId],
    queryFn: () => listTrades(portfolioId, 50),
    enabled: !!portfolioId,
    initialData: [],
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", portfolioId],
    queryFn: () => listTransactions(portfolioId, 50),
    enabled: !!portfolioId,
    initialData: [],
  });

  useEffect(() => {
    if (!portfolioId) return;
    const channel = supabase
      .channel(`realtime:alerts:${portfolioId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "price_alerts", filter: `portfolio_id=eq.${portfolioId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["alerts", portfolioId] });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [portfolioId, queryClient]);

  const cryptoPrices = cryptoList.reduce((acc, c) => { acc[c.symbol] = c.price; return acc; }, {});
  const cryptoChanges = cryptoList.reduce((acc, c) => { acc[c.symbol] = c.change24h; return acc; }, {});

  // Build unified notification list
  const allNotifications = [
    // Price alerts
    ...alerts.map(a => ({
      id: `alert-${a.id}`,
      type: a.alert_type,
      category: "Price Alerts",
      title: a.alert_type === "price_above"
        ? `${a.crypto_symbol} — Price Above Alert`
        : a.alert_type === "price_below"
        ? `${a.crypto_symbol} — Price Below Alert`
        : `${a.crypto_symbol} — Volatility Alert`,
      desc: a.is_triggered
        ? `Triggered at $${a.current_price?.toLocaleString() || a.threshold_value?.toLocaleString()}`
        : `Target: ${a.alert_type === "volatility" ? "" : "$"}${a.threshold_value?.toLocaleString()}${a.alert_type === "volatility" ? "%" : ""}`,
      status: a.is_triggered ? "triggered" : a.is_active ? "active" : "inactive",
      date: a.triggered_at || a.created_at,
    })),
    // Trades
    ...trades.map(t => ({
      id: `trade-${t.id}`,
      type: t.type,
      category: "Trades",
      title: `${t.type === "BUY" ? "Bought" : "Sold"} ${t.symbol}`,
      desc: `${Number(t.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${t.symbol} @ $${Number(t.unit_price).toLocaleString(undefined, { maximumFractionDigits: 2 })} · Total: $${Number(t.net_value || t.quantity * t.unit_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      status: "completed",
      date: t.trade_date,
    })),
    // Transactions
    ...transactions.filter(t => ["DEPOSIT","WITHDRAWAL"].includes(t.type)).map(t => ({
      id: `tx-${t.id}`,
      type: t.type,
      category: t.type === "DEPOSIT" ? "Deposits" : "Withdrawals",
      title: t.type === "DEPOSIT" ? "Funds Deposited" : "Withdrawal Processed",
      desc: `$${Number(t.total_amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${t.status === "completed" ? "· Completed" : t.status === "pending" ? "· Pending" : "· " + t.status}`,
      status: t.status,
      date: t.transaction_date,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const filtered = filter === "All"
    ? allNotifications
    : allNotifications.filter(n => n.category === filter);

  const counts = {
    All: allNotifications.length,
    "Price Alerts": allNotifications.filter(n => n.category === "Price Alerts").length,
    Trades: allNotifications.filter(n => n.category === "Trades").length,
    Deposits: allNotifications.filter(n => n.category === "Deposits").length,
    Withdrawals: allNotifications.filter(n => n.category === "Withdrawals").length,
  };

  const triggered = alerts.filter(a => a.is_triggered).length;
  const active = alerts.filter(a => a.is_active && !a.is_triggered).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All activity across your account</p>
        </div>
        <button
          onClick={() => setShowManager(!showManager)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
        >
          <Bell className="w-4 h-4" />
          Manage Price Alerts
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Events",    value: allNotifications.length, color: "text-foreground" },
          { label: "Active Alerts",   value: active,                  color: "text-primary" },
          { label: "Triggered",       value: triggered,               color: "text-yellow-400" },
          { label: "Total Trades",    value: trades.length,           color: "text-foreground" },
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
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filter === tab
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === tab ? "bg-white/20" : "bg-secondary text-muted-foreground"}`}>
              {counts[tab] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto">
              <Bell className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No {filter === "All" ? "" : filter.toLowerCase() + " "}notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/20 transition-colors"
              >
                <NotifIcon type={n.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      n.status === "triggered" || n.status === "completed"
                        ? "bg-primary/10 text-primary"
                        : n.status === "active"
                        ? "bg-yellow-400/10 text-yellow-400"
                        : n.status === "pending"
                        ? "bg-orange-400/10 text-orange-400"
                        : "bg-secondary text-muted-foreground"
                    }`}>
                      {n.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{timeAgo(n.date)}</p>
                  <span className="text-[10px] text-muted-foreground/60 capitalize">{n.category}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
