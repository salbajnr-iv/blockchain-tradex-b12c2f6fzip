import { useState, useEffect, useRef, useCallback } from "react";

let globalListeners = [];
let globalNotifications = [];

function getNotifPrefKey(type, side) {
  switch (type) {
    case 'market_mover':
    case 'price_volatility':
      return 'volatility';
    case 'price_above':
      return 'price_above';
    case 'price_below':
      return 'price_below';
    case 'trade':
      return side === 'buy' ? 'trade_buy' : 'trade_sell';
    case 'transaction_deposit':
    case 'deposit':
      return 'deposit';
    case 'transaction_withdrawal':
    case 'withdrawal':
      return 'withdrawal';
    case 'login':
    case 'new_login':
      return 'login';
    case 'password_change':
      return 'password_change';
    default:
      return null;
  }
}

function isAllowedByPrefs(notif) {
  try {
    const prefs = JSON.parse(localStorage.getItem('bt-notif-prefs') || '{}');
    const key = getNotifPrefKey(notif.type, notif.side);
    if (key && prefs[key] === false) return false;
  } catch {}
  return true;
}

const READ_STORAGE_KEY = "bt_notif_read_ids";

function getStoredReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || "[]")); }
  catch { return new Set(); }
}

function persistReadIds(ids) {
  try {
    const existing = getStoredReadIds();
    ids.forEach((id) => existing.add(id));
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...existing]));
  } catch { /* ignore */ }
}

export function emitSystemNotif(notif) {
  if (!isAllowedByPrefs(notif)) return;
  const entry = { ...notif, id: `sys-${Date.now()}-${Math.random()}`, timestamp: new Date(), source: "system" };
  globalNotifications = [entry, ...globalNotifications].slice(0, 30);
  globalListeners.forEach((fn) => fn([...globalNotifications]));
}

export function useSystemNotifications({ cryptoList = [], portfolioTotal = 0 } = {}) {
  const [notifications, setNotifications] = useState([...globalNotifications]);
  const [readIds, setReadIds] = useState(getStoredReadIds);
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

  const refreshReadIds = useCallback(() => setReadIds(getStoredReadIds()), []);

  const dismiss = useCallback((id) => {
    persistReadIds([id]);
    globalNotifications = globalNotifications.filter((n) => n.id !== id);
    globalListeners.forEach((fn) => fn([...globalNotifications]));
    setReadIds(getStoredReadIds());
  }, []);

  const clearAll = useCallback(() => {
    persistReadIds(globalNotifications.map((n) => n.id));
    globalNotifications = [];
    globalListeners.forEach((fn) => fn([]));
    setReadIds(getStoredReadIds());
  }, []);

  const markAllRead = useCallback(() => {
    persistReadIds(globalNotifications.map((n) => n.id));
    setReadIds(getStoredReadIds());
  }, []);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  return { notifications, dismiss, clearAll, markAllRead, readIds, unreadCount, refreshReadIds };
}
