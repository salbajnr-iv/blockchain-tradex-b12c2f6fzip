import { useState, useEffect, useRef, useCallback } from "react";

let globalListeners = [];
let globalNotifications = [];

export function emitSystemNotif(notif) {
  const entry = { ...notif, id: `sys-${Date.now()}-${Math.random()}`, timestamp: new Date(), source: "system" };
  globalNotifications = [entry, ...globalNotifications].slice(0, 30);
  globalListeners.forEach((fn) => fn([...globalNotifications]));
}

export function useSystemNotifications({ cryptoList = [], portfolioTotal = 0 } = {}) {
  const [notifications, setNotifications] = useState([...globalNotifications]);
  const moverFiredRef = useRef(new Set());
  const welcomeFiredRef = useRef(false);
  const prevTotalRef = useRef(null);

  useEffect(() => {
    const listener = (list) => setNotifications(list);
    globalListeners.push(listener);
    return () => { globalListeners = globalListeners.filter((l) => l !== listener); };
  }, []);

  useEffect(() => {
    if (!welcomeFiredRef.current) {
      welcomeFiredRef.current = true;
      setTimeout(() => {
        emitSystemNotif({
          type: "welcome",
          title: "Markets are live",
          message: "Real-time prices are streaming. Your portfolio is up to date.",
          icon: "🟢",
        });
      }, 2000);
    }
  }, []);

  useEffect(() => {
    if (!cryptoList.length) return;
    cryptoList.forEach((coin) => {
      const absChange = Math.abs(coin.change24h);
      if (absChange < 5) return;
      const bucketKey = `mover-${coin.symbol}-${Math.floor(Date.now() / 3600000)}`;
      if (moverFiredRef.current.has(bucketKey)) return;
      moverFiredRef.current.add(bucketKey);
      const up = coin.change24h > 0;
      emitSystemNotif({
        type: "market_mover",
        title: `${coin.symbol} ${up ? "surging" : "dropping"}`,
        message: `${coin.name} is ${up ? "up" : "down"} ${absChange}% in the last 24 hours.`,
        icon: up ? "🚀" : "📉",
        symbol: coin.symbol,
      });
    });
  }, [cryptoList]);

  useEffect(() => {
    if (!portfolioTotal || portfolioTotal === 0) return;
    if (prevTotalRef.current === null) {
      prevTotalRef.current = portfolioTotal;
      return;
    }
    const diff = portfolioTotal - prevTotalRef.current;
    const pct = Math.abs(diff / prevTotalRef.current) * 100;
    if (pct >= 2 && Math.abs(diff) >= 10) {
      const key = `portfolio-${Math.floor(Date.now() / 3600000)}`;
      if (!moverFiredRef.current.has(key)) {
        moverFiredRef.current.add(key);
        const up = diff > 0;
        emitSystemNotif({
          type: "portfolio_change",
          title: `Portfolio ${up ? "gained" : "lost"} $${Math.abs(diff).toFixed(2)}`,
          message: `Your portfolio is ${up ? "up" : "down"} ${pct.toFixed(1)}% since last check.`,
          icon: up ? "📈" : "📊",
        });
      }
    }
    prevTotalRef.current = portfolioTotal;
  }, [portfolioTotal]);

  const dismiss = useCallback((id) => {
    globalNotifications = globalNotifications.filter((n) => n.id !== id);
    globalListeners.forEach((fn) => fn([...globalNotifications]));
  }, []);

  const clearAll = useCallback(() => {
    globalNotifications = [];
    globalListeners.forEach((fn) => fn([]));
  }, []);

  return { notifications, dismiss, clearAll };
}
