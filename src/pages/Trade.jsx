import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useLivePrices } from "@/hooks/useLivePrices";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useQueryClient } from "@tanstack/react-query";
import { executeTrade, listTrades } from "@/lib/api/portfolio";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import DepositDialog from "@/components/crypto/DepositDialog";
import {
  TrendingUp, TrendingDown, Loader2, Wallet, PlusCircle, ArrowUpRight,
  ArrowDownLeft, Zap, RefreshCw, BarChart2, Clock, ChevronDown, Info,
  Activity,
} from "lucide-react";

// ── small helpers ─────────────────────────────────────────────────────────────
const fmt = (n, d = 2) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtCompact = (n) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${fmt(n)}`;

// ── coin icon map ─────────────────────────────────────────────────────────────
const COIN_COLORS = {
  BTC: "#F7931A", ETH: "#627EEA", SOL: "#9945FF", BNB: "#F3BA2F",
  XRP: "#00AAE4", ADA: "#0033AD", DOGE: "#C3A634", AVAX: "#E84142",
};

function CoinIcon({ symbol, size = 32 }) {
  const ICONS = { BTC: "₿", ETH: "Ξ", SOL: "◎", BNB: "◆", XRP: "✕", ADA: "₳", DOGE: "Ð", AVAX: "▲" };
  return (
    <div
      style={{ width: size, height: size, backgroundColor: `${COIN_COLORS[symbol]}20`, color: COIN_COLORS[symbol] }}
      className="rounded-full flex items-center justify-center font-bold text-sm shrink-0"
    >
      {ICONS[symbol] || symbol[0]}
    </div>
  );
}

// ── order book row ────────────────────────────────────────────────────────────
function OrderBookRow({ price, amount, total, maxTotal, side }) {
  const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  return (
    <div className="relative flex items-center justify-between text-[11px] tabular-nums py-0.5 px-1 rounded overflow-hidden">
      <div
        className={`absolute inset-0 opacity-10 ${side === "ask" ? "bg-destructive" : "bg-primary"}`}
        style={{ width: `${pct}%`, [side === "ask" ? "right" : "left"]: 0, left: side === "bid" ? 0 : "auto", right: side === "ask" ? 0 : "auto" }}
      />
      <span className={`font-medium z-10 ${side === "ask" ? "text-destructive" : "text-primary"}`}>${fmt(price)}</span>
      <span className="text-muted-foreground z-10">{fmt(amount, 4)}</span>
      <span className="text-muted-foreground z-10">{fmt(total)}</span>
    </div>
  );
}

// ── simulated order book ──────────────────────────────────────────────────────
function OrderBook({ coin }) {
  const price = coin?.price || 0;
  const rows = 8;

  const asks = Array.from({ length: rows }, (_, i) => {
    const spread = price * (0.0002 + i * 0.00015);
    const p = price + spread * (i + 1);
    const a = parseFloat((Math.random() * 2 + 0.01).toFixed(4));
    return { price: p, amount: a, total: p * a };
  }).reverse();

  const bids = Array.from({ length: rows }, (_, i) => {
    const spread = price * (0.0002 + i * 0.00015);
    const p = price - spread * (i + 1);
    const a = parseFloat((Math.random() * 2 + 0.01).toFixed(4));
    return { price: p, amount: a, total: p * a };
  });

  const maxTotal = Math.max(...asks.map(r => r.total), ...bids.map(r => r.total));

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-muted-foreground px-1 pb-1">
        <span>Price (USDT)</span>
        <span>Amount</span>
        <span>Total</span>
      </div>
      {asks.map((row, i) => <OrderBookRow key={i} {...row} maxTotal={maxTotal} side="ask" />)}
      <div className="py-1.5 px-1 flex items-center justify-between border-y border-border/30 my-1">
        <span className="text-sm font-bold tabular-nums text-foreground">${fmt(price)}</span>
        <span className={`text-xs font-medium flex items-center gap-1 ${(coin?.change24h || 0) >= 0 ? "text-primary" : "text-destructive"}`}>
          {(coin?.change24h || 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          Mark price
        </span>
      </div>
      {bids.map((row, i) => <OrderBookRow key={i} {...row} maxTotal={maxTotal} side="bid" />)}
    </div>
  );
}

// ── trade panel ───────────────────────────────────────────────────────────────
function TradePanel({ coin, side, setSide, portfolioId, cashBalance, holdingsMap, refetch, onDeposit }) {
  const [orderType, setOrderType] = useState("market");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const price = orderType === "limit" && limitPrice ? parseFloat(limitPrice) : (coin?.price || 0);
  const qty = parseFloat(amount) || 0;
  const total = qty * price;
  const fee = total * 0.001;
  const totalCost = total + fee;
  const currentHolding = holdingsMap[coin?.symbol]?.amount || 0;
  const insufficientFunds = side === "buy" && qty > 0 && totalCost > cashBalance;
  const insufficientHoldings = side === "sell" && qty > 0 && qty > currentHolding;

  // % shortcuts
  const setPercent = (pct) => {
    if (!coin) return;
    if (side === "buy") {
      const spendable = cashBalance * pct;
      const qty = spendable / price / 1.001;
      setAmount(qty > 0 ? qty.toFixed(6) : "");
    } else {
      setAmount((currentHolding * pct).toFixed(6));
    }
  };

  const handleTrade = async () => {
    if (!qty || qty <= 0) { toast.error("Enter a valid amount"); return; }
    if (!portfolioId)       { toast.error("Portfolio not loaded"); return; }
    if (!coin)              { toast.error("No coin selected"); return; }
    setIsPending(true);
    try {
      await executeTrade(portfolioId, cashBalance, {
        symbol: coin.symbol, name: coin.name,
        type: side === "buy" ? "BUY" : "SELL",
        quantity: qty, unitPrice: price,
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["trades", portfolioId] });
      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${fmt(qty, 6)} ${coin.symbol}`);
      setAmount("");
    } catch (err) {
      toast.error(err.message || "Trade failed");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Buy / Sell toggle */}
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
        {["buy", "sell"].map(s => (
          <button
            key={s}
            onClick={() => { setSide(s); setAmount(""); }}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
              side === s
                ? s === "buy" ? "bg-primary text-primary-foreground shadow-sm" : "bg-destructive text-destructive-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Order type */}
      <div className="flex gap-2">
        {["market", "limit"].map(t => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={`text-xs px-3 py-1.5 rounded-md font-medium border transition-all ${
              orderType === t
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wallet className="w-3.5 h-3.5" />
          <span className={`font-semibold tabular-nums ${cashBalance === 0 ? "text-destructive" : "text-foreground"}`}>
            ${fmt(cashBalance)}
          </span>
          <button onClick={onDeposit} className="text-primary hover:text-primary/80 flex items-center gap-0.5 font-medium">
            <PlusCircle className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Limit price input */}
      {orderType === "limit" && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Limit Price (USDT)</label>
          <div className="relative">
            <input
              type="number"
              placeholder={coin ? fmt(coin.price) : "0.00"}
              value={limitPrice}
              onChange={e => setLimitPrice(e.target.value)}
              className="w-full h-10 rounded-md border border-border/50 bg-secondary/50 px-3 pr-16 text-sm text-foreground outline-none focus:border-primary/40 transition-colors tabular-nums"
            />
            <button
              onClick={() => setLimitPrice(coin?.price?.toFixed(2) || "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary hover:text-primary/80 font-medium px-1.5 py-0.5 bg-primary/10 rounded"
            >
              MKT
            </button>
          </div>
        </div>
      )}

      {/* Amount */}
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <label className="text-xs text-muted-foreground">Amount ({coin?.symbol || "—"})</label>
          {side === "sell" && currentHolding > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Avail: {fmt(currentHolding, 6)} {coin?.symbol}
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type="number"
            placeholder="0.000000"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className={`w-full h-10 rounded-md border bg-secondary/50 px-3 pr-20 text-sm text-foreground outline-none transition-colors tabular-nums
              ${insufficientFunds || insufficientHoldings ? "border-destructive/50 focus:border-destructive" : "border-border/50 focus:border-primary/40"}`}
          />
          {coin && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
              {coin.symbol}
            </span>
          )}
        </div>

        {/* Quick fills */}
        <div className="flex gap-1.5">
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <button
              key={pct}
              onClick={() => setPercent(pct)}
              className="flex-1 py-1 text-[10px] font-semibold rounded border border-border/50 text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
            >
              {pct === 1 ? "Max" : `${pct * 100}%`}
            </button>
          ))}
        </div>
      </div>

      {/* Order summary */}
      {coin && (
        <div className="bg-secondary/30 rounded-xl p-3 space-y-2">
          {[
            { label: orderType === "market" ? "Market Price" : "Limit Price", value: `$${fmt(price)}`, highlight: false },
            { label: "Subtotal", value: `$${fmt(total)}`, highlight: false },
            { label: "Fee (0.1%)", value: `$${fmt(fee)}`, highlight: false },
            { label: side === "buy" ? "Total Cost" : "You Receive", value: `$${fmt(side === "buy" ? totalCost : total - fee)}`, highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} className={`flex justify-between text-xs ${highlight ? "border-t border-border/30 pt-2 mt-1" : ""}`}>
              <span className="text-muted-foreground">{label}</span>
              <span className={`font-semibold tabular-nums ${highlight ? "text-foreground" : ""}`}>{value}</span>
            </div>
          ))}
          {insufficientFunds && (
            <div className="border-t border-border/30 pt-2 flex justify-between text-xs">
              <span className="text-destructive font-medium">Shortfall</span>
              <span className="text-destructive font-semibold">${fmt(totalCost - cashBalance)}</span>
            </div>
          )}
        </div>
      )}

      {/* Zero balance prompt */}
      {cashBalance === 0 && side === "buy" && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Add funds to start trading</p>
          <button onClick={onDeposit} className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 mx-auto">
            <PlusCircle className="w-3.5 h-3.5" /> Fund Account
          </button>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleTrade}
        disabled={isPending || !qty || !portfolioId || !coin || insufficientFunds || insufficientHoldings}
        className={`w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          side === "buy"
            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
            : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        }`}
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {insufficientFunds ? "Insufficient Funds"
          : insufficientHoldings ? "Insufficient Holdings"
          : `${side === "buy" ? "Buy" : "Sell"} ${coin?.symbol || ""}`}
      </button>
    </div>
  );
}

// ── live trades feed ──────────────────────────────────────────────────────────
function TradeHistory({ portfolioId }) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const fetchTrades = useCallback(async () => {
    if (!portfolioId) return;
    try {
      const data = await listTrades(portfolioId, 20);
      setTrades(data);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  useEffect(() => {
    if (!portfolioId) return;
    const ch = supabase
      .channel(`trade-history:${portfolioId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "trades",
        filter: `portfolio_id=eq.${portfolioId}`,
      }, () => fetchTrades())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [portfolioId, fetchTrades]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trade History</span>
        <div className="flex items-center gap-1 text-[10px] text-primary/70 font-medium">
          <Zap className="w-3 h-3" /> Live
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : trades.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No trades yet</p>
      ) : (
        <div className="space-y-1">
          {trades.map(trade => {
            const isBuy = trade.type === "BUY";
            return (
              <div key={trade.id} className="flex items-center gap-3 py-2 border-b border-border/20 last:border-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isBuy ? "bg-primary/10" : "bg-destructive/10"}`}>
                  {isBuy
                    ? <ArrowDownLeft className="w-3.5 h-3.5 text-primary" />
                    : <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{trade.symbol}/USDT</span>
                    <span className={`text-xs font-semibold tabular-nums ${isBuy ? "text-primary" : "text-destructive"}`}>
                      {isBuy ? "+" : "-"}{fmt(trade.quantity, 4)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(trade.trade_date).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      @${fmt(trade.unit_price)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── position card ─────────────────────────────────────────────────────────────
function PositionCard({ coin, holdingsMap, cashBalance }) {
  const holding = holdingsMap[coin?.symbol];
  if (!holding || !coin) return null;

  const value = holding.amount * coin.price;
  const pnl = value - holding.amount * holding.average_cost;
  const pnlPct = holding.average_cost > 0 ? (pnl / (holding.amount * holding.average_cost)) * 100 : 0;

  return (
    <div className="bg-secondary/30 rounded-xl p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Position</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Holdings",   value: `${fmt(holding.amount, 6)} ${coin.symbol}` },
          { label: "Avg Cost",   value: `$${fmt(holding.average_cost)}` },
          { label: "Mkt Value",  value: `$${fmt(value)}` },
          { label: "P&L",        value: `${pnl >= 0 ? "+" : ""}$${fmt(Math.abs(pnl))} (${pnlPct >= 0 ? "+" : ""}${fmt(pnlPct)}%)`,
            color: pnl >= 0 ? "text-primary" : "text-destructive" },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className={`text-xs font-semibold tabular-nums mt-0.5 ${color || "text-foreground"}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN TRADE PAGE ───────────────────────────────────────────────────────────
export default function Trade() {
  const { cryptoList, isLoading: pricesLoading } = useLivePrices();
  const { portfolioId, cashBalance, holdingsMap, refetch } = usePortfolio();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSymbol, setSelectedSymbol] = useState(
    searchParams.get("coin")?.toUpperCase() || "BTC"
  );
  const [side, setSide] = useState("buy");
  const [depositOpen, setDepositOpen] = useState(false);
  const [showOrderBook, setShowOrderBook] = useState(true);

  const coin = cryptoList.find(c => c.symbol === selectedSymbol) || null;

  useEffect(() => {
    const coin = searchParams.get("coin")?.toUpperCase();
    if (coin) setSelectedSymbol(coin);
  }, []);

  // Dynamically import chart to avoid circular deps
  const [PriceChart, setPriceChart] = useState(null);
  useEffect(() => {
    import("@/components/crypto/PriceChart").then(m => setPriceChart(() => m.default));
  }, []);

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trade</h1>
          <p className="text-sm text-muted-foreground">Execute orders at live market prices</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-primary/70 font-medium bg-primary/5 border border-primary/15 px-2.5 py-1.5 rounded-lg">
            <Activity className="w-3 h-3" />
            <span>Live Market</span>
          </div>
        </div>
      </div>

      {/* Coin selector strip */}
      <div className="bg-card border border-border/50 rounded-xl p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {pricesLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 w-28 rounded-lg bg-secondary/50 animate-pulse shrink-0" />
              ))
            : cryptoList.map(c => {
                const active = c.symbol === selectedSymbol;
                const isUp = c.change24h >= 0;
                return (
                  <button
                    key={c.symbol}
                    onClick={() => setSelectedSymbol(c.symbol)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg shrink-0 border transition-all ${
                      active
                        ? "bg-primary/10 border-primary/30"
                        : "border-transparent hover:bg-secondary/50 hover:border-border/50"
                    }`}
                  >
                    <CoinIcon symbol={c.symbol} size={28} />
                    <div className="text-left">
                      <p className={`text-xs font-bold ${active ? "text-primary" : "text-foreground"}`}>{c.symbol}</p>
                      <p className={`text-[10px] font-medium ${isUp ? "text-primary" : "text-destructive"}`}>
                        {isUp ? "+" : ""}{c.change24h}%
                      </p>
                    </div>
                  </button>
                );
              })}
        </div>
      </div>

      {/* Stats bar */}
      {coin && (
        <div className="bg-card border border-border/50 rounded-xl px-4 py-3 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-3">
            <CoinIcon symbol={coin.symbol} size={36} />
            <div>
              <p className="text-xs text-muted-foreground">{coin.name}</p>
              <p className="text-xl font-bold tabular-nums">${fmt(coin.price)}</p>
            </div>
            <div className={`flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-lg ${
              coin.change24h >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}>
              {coin.change24h >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {coin.change24h >= 0 ? "+" : ""}{coin.change24h}%
            </div>
          </div>
          <div className="flex gap-6 ml-auto flex-wrap">
            {[
              { label: "24h Volume", value: coin.volume },
              { label: "Market Cap", value: coin.marketCap },
              { label: "Holdings", value: `${fmt(coin.holdings, 4)} ${coin.symbol}` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="text-xs font-semibold text-foreground tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Chart — left 2/3 */}
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            {PriceChart
              ? <div className="p-5"><PriceChart /></div>
              : <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
          </div>

          {/* Order book + trade history in a 2-col grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border/50 rounded-xl p-4">
              <button
                className="flex items-center justify-between w-full mb-3"
                onClick={() => setShowOrderBook(v => !v)}
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 className="w-3.5 h-3.5" /> Order Book
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showOrderBook ? "" : "-rotate-90"}`} />
              </button>
              {showOrderBook && coin && <OrderBook coin={coin} />}
            </div>

            <div className="bg-card border border-border/50 rounded-xl p-4">
              <TradeHistory portfolioId={portfolioId} />
            </div>
          </div>
        </div>

        {/* Trade panel — right 1/3 */}
        <div className="space-y-4">
          <div className="bg-card border border-border/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Place Order</h3>
            </div>
            {pricesLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : (
              <TradePanel
                coin={coin}
                side={side}
                setSide={setSide}
                portfolioId={portfolioId}
                cashBalance={cashBalance}
                holdingsMap={holdingsMap}
                refetch={refetch}
                onDeposit={() => setDepositOpen(true)}
              />
            )}
          </div>

          {/* Position card */}
          {coin && holdingsMap[coin.symbol] && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border/50 rounded-xl p-5"
            >
              <PositionCard coin={coin} holdingsMap={holdingsMap} cashBalance={cashBalance} />
            </motion.div>
          )}

          {/* Market info */}
          {coin && (
            <div className="bg-card border border-border/50 rounded-xl p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Info className="w-3.5 h-3.5" /> Market Info
              </p>
              {[
                { label: "Symbol",      value: `${coin.symbol}/USDT` },
                { label: "24h Change",  value: `${coin.change24h >= 0 ? "+" : ""}${coin.change24h}%`, color: coin.change24h >= 0 ? "text-primary" : "text-destructive" },
                { label: "Volume",      value: coin.volume },
                { label: "Market Cap",  value: coin.marketCap },
                { label: "Fee Rate",    value: "0.10%" },
                { label: "Min Order",   value: `0.000001 ${coin.symbol}` },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-medium tabular-nums ${color || "text-foreground"}`}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} />
    </div>
  );
}
