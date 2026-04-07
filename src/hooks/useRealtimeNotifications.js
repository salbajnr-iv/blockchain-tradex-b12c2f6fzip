import { useEffect, useRef } from "react";
import { supabase, supabaseMisconfigured } from "@/lib/supabaseClient";
import { emitSystemNotif } from "./useSystemNotifications";

let pushPermissionRequested = false;

async function requestPushPermission() {
  if (pushPermissionRequested || !("Notification" in window)) return;
  pushPermissionRequested = true;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (e) {
      // Silently ignore — some environments block this
    }
  }
}

function showBrowserNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch (e) {
    // Ignore — service worker may be required in some contexts
  }
}

export function useRealtimeNotifications({ portfolioId } = {}) {
  const channelRef = useRef(null);

  useEffect(() => {
    requestPushPermission();
  }, []);

  useEffect(() => {
    if (!portfolioId || supabaseMisconfigured) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`rt-notifications-${portfolioId}`)

      // ── New transactions ─────────────────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions", filter: `portfolio_id=eq.${portfolioId}` },
        (payload) => {
          const tx = payload.new;
          const type = (tx.type || "").toUpperCase();
          const amount = Number(tx.total_amount || tx.amount || 0);
          const fmt = amount.toLocaleString(undefined, { maximumFractionDigits: 2 });

          let title, message, icon, notifType;
          if (type === "DEPOSIT") {
            title = "Deposit Received";
            message = `$${fmt} has been added to your portfolio.`;
            icon = "💰";
            notifType = "transaction_deposit";
          } else if (type === "WITHDRAWAL") {
            title = "Withdrawal Initiated";
            message = `$${fmt} withdrawal is being processed.`;
            icon = "💸";
            notifType = "transaction_withdrawal";
          } else {
            title = "Transaction Recorded";
            message = `A ${type.toLowerCase() || "new"} transaction of $${fmt} was recorded.`;
            icon = "📋";
            notifType = "transaction";
          }

          emitSystemNotif({ type: notifType, title, message, icon });
          showBrowserNotification(title, message);
        }
      )

      // ── New trades ───────────────────────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trades", filter: `portfolio_id=eq.${portfolioId}` },
        (payload) => {
          const trade = payload.new;
          const side = trade.side || "buy";
          const symbol = trade.crypto_symbol || "";
          const qty = Number(trade.quantity || 0);
          const price = Number(trade.unit_price || 0);
          const isBuy = side === "buy";

          const title = isBuy ? `Bought ${symbol}` : `Sold ${symbol}`;
          const message = `${isBuy ? "Bought" : "Sold"} ${qty.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol} at $${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`;
          const icon = isBuy ? "🟢" : "🔴";

          emitSystemNotif({ type: "trade", title, message, icon, side, symbol });
          showBrowserNotification(title, message);
        }
      )

      // ── New pending / limit orders ───────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pending_orders", filter: `portfolio_id=eq.${portfolioId}` },
        (payload) => {
          const order = payload.new;
          const side = order.side || "buy";
          const symbol = order.crypto_symbol || "";
          const price = Number(order.target_price || 0);
          const isBuy = side === "buy";

          const title = "Limit Order Placed";
          const message = `${isBuy ? "Buy" : "Sell"} order for ${symbol} set at $${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`;
          const icon = "📌";

          emitSystemNotif({ type: "order", title, message, icon, side, symbol });
          showBrowserNotification(title, message);
        }
      )

      // ── Pending orders filled ────────────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pending_orders", filter: `portfolio_id=eq.${portfolioId}` },
        (payload) => {
          const updated = payload.new;
          const old = payload.old;
          if (old.status !== "filled" && updated.status === "filled") {
            const symbol = updated.crypto_symbol || "";
            const side = updated.side || "buy";
            const price = Number(updated.target_price || 0);
            const isBuy = side === "buy";

            const title = `Order Filled: ${symbol}`;
            const message = `Your ${isBuy ? "buy" : "sell"} limit order for ${symbol} was filled at $${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`;
            const icon = "✅";

            emitSystemNotif({ type: "order_filled", title, message, icon, side, symbol });
            showBrowserNotification(title, message);
          }
        }
      )

      // ── Price alerts triggered ───────────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "alerts", filter: `portfolio_id=eq.${portfolioId}` },
        (payload) => {
          const updated = payload.new;
          const old = payload.old;
          if (!old.is_triggered && updated.is_triggered) {
            const symbol = updated.crypto_symbol || "";
            const threshold = Number(updated.threshold_value || 0);
            const alertType = updated.alert_type || "";

            let title, message, icon;
            if (alertType === "price_above") {
              title = `Price Alert: ${symbol} 🚀`;
              message = `${symbol} has risen above your $${threshold.toLocaleString()} target.`;
              icon = "🚀";
            } else if (alertType === "price_below") {
              title = `Price Alert: ${symbol} ⚠️`;
              message = `${symbol} dropped below your $${threshold.toLocaleString()} target.`;
              icon = "⚠️";
            } else {
              title = `Volatility Alert: ${symbol} ⚡`;
              message = `${symbol} exceeded your ${threshold}% volatility threshold.`;
              icon = "⚡";
            }

            emitSystemNotif({ type: `price_${alertType}`, title, message, icon, symbol });
            showBrowserNotification(title, message);
          }
        }
      )

      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[BlockTrade] Realtime notifications active for portfolio", portfolioId);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [portfolioId]);
}
