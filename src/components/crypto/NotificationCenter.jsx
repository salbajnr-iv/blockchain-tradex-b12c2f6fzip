import React, { useState, useEffect, useRef } from "react";
import { updateAlert } from "@/lib/api/alerts";
import { AlertCircle, TrendingUp, TrendingDown, Zap, X, Bell, Info, BarChart2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSystemNotifications, emitSystemNotif } from "@/hooks/useSystemNotifications";

export default function NotificationCenter({ alerts, cryptoPrices, cryptoChanges, cryptoList, portfolioTotal }) {
  const [toastQueue, setToastQueue] = useState([]);
  const triggeredRef = useRef(new Set());
  const { notifications: sysNotifs } = useSystemNotifications({ cryptoList, portfolioTotal });
  const prevSysCount = useRef(0);

  // ── Price alert checks ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!alerts.length || !Object.keys(cryptoPrices).length) return;

    const checkAlerts = () => {
      const toAdd = [];
      alerts.forEach((alert) => {
        if (!alert.is_active || alert.is_triggered) return;
        if (triggeredRef.current.has(alert.id)) return;

        const currentPrice = cryptoPrices[alert.crypto_symbol];
        const change24h = cryptoChanges?.[alert.crypto_symbol] ?? 0;
        if (currentPrice == null) return;

        let triggered = false;
        let message = "";

        switch (alert.alert_type) {
          case "price_above":
            if (currentPrice >= alert.threshold_value) {
              triggered = true;
              message = `${alert.crypto_symbol} hit $${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} — above your $${alert.threshold_value.toLocaleString()} target 🚀`;
            }
            break;
          case "price_below":
            if (currentPrice <= alert.threshold_value) {
              triggered = true;
              message = `${alert.crypto_symbol} dropped to $${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} — below your $${alert.threshold_value.toLocaleString()} target ⚠️`;
            }
            break;
          case "volatility":
            if (Math.abs(change24h) >= alert.threshold_value) {
              triggered = true;
              message = `${alert.crypto_symbol} is volatile — ${change24h >= 0 ? "+" : ""}${change24h}% in 24h (threshold: ${alert.threshold_value}%) ⚡`;
            }
            break;
        }

        if (triggered) {
          triggeredRef.current.add(alert.id);
          toAdd.push({
            tempId: `alert-${alert.id}-${Date.now()}`,
            source: "alert",
            alertId: alert.id,
            symbol: alert.crypto_symbol,
            type: alert.alert_type,
            message,
            currentPrice,
            timestamp: new Date(),
          });
          updateAlert(alert.id, {
            is_triggered: true,
            triggered_at: new Date().toISOString(),
            current_price: currentPrice,
          }).catch(console.error);
        }
      });

      if (toAdd.length > 0) {
        setToastQueue((prev) => [...toAdd, ...prev].slice(0, 6));
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 5000);
    return () => clearInterval(interval);
  }, [alerts, cryptoPrices, cryptoChanges]);

  // ── System notifications → show as toasts ──────────────────────────────────
  useEffect(() => {
    if (sysNotifs.length > prevSysCount.current) {
      const newest = sysNotifs.slice(0, sysNotifs.length - prevSysCount.current);
      const toastItems = newest.map((n) => ({
        tempId: `sys-toast-${n.id}`,
        source: "system",
        type: n.type,
        icon: n.icon,
        title: n.title,
        message: n.message,
        timestamp: n.timestamp,
      }));
      setToastQueue((prev) => [...toastItems, ...prev].slice(0, 6));
    }
    prevSysCount.current = sysNotifs.length;
  }, [sysNotifs]);

  // ── Auto-dismiss oldest toast after 10s ────────────────────────────────────
  useEffect(() => {
    if (toastQueue.length === 0) return;
    const timer = setTimeout(() => {
      setToastQueue((prev) => prev.slice(0, -1));
    }, 10000);
    return () => clearTimeout(timer);
  }, [toastQueue]);

  const dismiss = (tempId) => setToastQueue((prev) => prev.filter((n) => n.tempId !== tempId));

  // ── Icon & colors ───────────────────────────────────────────────────────────
  const getIcon = (item) => {
    if (item.source === "system") {
      switch (item.type) {
        case "welcome":        return <Bell className="w-4 h-4 text-primary" />;
        case "market_mover":  return item.message?.includes("up") || item.message?.includes("surging")
          ? <TrendingUp className="w-4 h-4 text-emerald-500" />
          : <TrendingDown className="w-4 h-4 text-red-500" />;
        case "portfolio_change": return <BarChart2 className="w-4 h-4 text-primary" />;
        default: return <Info className="w-4 h-4 text-primary" />;
      }
    }
    switch (item.type) {
      case "price_above": return <TrendingUp className="w-4 h-4 text-primary" />;
      case "price_below": return <TrendingDown className="w-4 h-4 text-destructive" />;
      case "volatility":  return <Zap className="w-4 h-4 text-yellow-400" />;
      default:            return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getBorderColor = (item) => {
    if (item.source === "system") {
      switch (item.type) {
        case "market_mover": return item.message?.includes("up") || item.message?.includes("surging")
          ? "border-l-4 border-l-emerald-500 border-border/30"
          : "border-l-4 border-l-red-500 border-border/30";
        default: return "border-l-4 border-l-primary border-border/30";
      }
    }
    switch (item.type) {
      case "price_above": return "border-l-4 border-l-primary border-border/30";
      case "price_below": return "border-l-4 border-l-destructive border-border/30";
      case "volatility":  return "border-l-4 border-l-yellow-400 border-border/30";
      default:            return "border-border/30";
    }
  };

  const getLabel = (item) => {
    if (item.source === "system") return item.title || "System";
    return "Alert Triggered";
  };

  return (
    <div className="fixed bottom-6 right-6 space-y-2 z-50 w-80 pointer-events-none">
      <AnimatePresence>
        {toastQueue.map((notif) => (
          <motion.div
            key={notif.tempId}
            initial={{ opacity: 0, x: 320, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 320, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`pointer-events-auto bg-card border rounded-xl p-4 shadow-2xl ${getBorderColor(notif)}`}
          >
            <div className="flex items-start gap-3">
              <div className="relative mt-0.5 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  {getIcon(notif)}
                </div>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <Bell className="w-3 h-3 text-primary" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wide">{getLabel(notif)}</span>
                </div>
                <p className="text-sm font-medium text-foreground leading-snug">{notif.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {notif.timestamp instanceof Date
                    ? notif.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    : new Date(notif.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              <button
                onClick={() => dismiss(notif.tempId)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
