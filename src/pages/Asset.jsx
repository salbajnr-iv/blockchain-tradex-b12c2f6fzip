import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMarketCoins } from "@/hooks/useMarketCoins";
import { useCandlestickChart } from "@/hooks/useCandlestickChart";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { executeTrade } from "@/lib/api/portfolio";
import { createPendingOrder } from "@/lib/api/pendingOrders";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "@/lib/api/watchlist";
import CandlestickChart from "@/components/crypto/CandlestickChart";
import DepositDialog from "@/components/crypto/DepositDialog";
import TradeConfirmModal from "@/components/crypto/TradeConfirmModal";
import { toast } from '@/lib/toast';
import { motion } from "framer-motion";
import {
  ArrowLeft, Star, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft,
  Loader2, RefreshCw, ExternalLink, Globe, Zap, BarChart2, Activity,
  DollarSign, Info,
} from "lucide-react";

const fmt = (n, d = 2) =>
  n == null ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtCompact = (n) => {
  if (!n) return "$0";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
};

const priceFmt = (n) => {
  if (!n) return "$0";
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
};

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, color }) {
  return (
    <div className="bg-secondary/30 rounded-xl px-4 py-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-bold text-sm ${color || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Inline Trade Widget ───────────────────────────────────────────────────────
function TradeWidget({ coin, portfolioId, cashBalance, holdingsMap, refetch }) {
  const [side, setSide] = useState("BUY");
  const [orderType, setOrderType] = useState("market");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const queryClient = useQueryClient();

  const price = orderType === "limit" && limitPrice ? parseFloat(limitPrice) : (coin?.price || 0);
  const qty = parseFloat(amount) || 0;
  const total = qty * price;
  const fees = total * 0.001;
  const isBuy = side === "BUY";
  const holding = holdingsMap[coin?.symbol];

  const canAfford = isBuy ? cashBalance >= total + fees : (holding?.amount || 0) >= qty;

  const handleTrade = async () => {
    if (!portfolioId || !coin) return;
    setIsPending(true);
    try {
      if (orderType === "limit") {
        await createPendingOrder(portfolioId, {
          symbol: coin.symbol,
          name: coin.name,
          side,
          quantity: qty,
          limitPrice: price,
        });
        toast.success(`Limit order placed at ${priceFmt(price)}`, {
          description: `${isBuy ? "Buy" : "Sell"} ${fmt(qty, 6)} ${coin.symbol} when price ${isBuy ? "≤" : "≥"} ${priceFmt(price)}`,
        });
      } else {
        await executeTrade(portfolioId, cashBalance, {
          symbol: coin.symbol,
          name: coin.name,
          type: side,
          quantity: qty,
          unitPrice: coin.price,
        });
        toast.success(`${isBuy ? "Bought" : "Sold"} ${fmt(qty, 4)} ${coin.symbol}!`);
        queryClient.invalidateQueries({ queryKey: ["trades", portfolioId] });
      }
      await refetch();
      setAmount("");
      setLimitPrice("");
    } catch (err) {
      toast.error(err.message || "Trade failed");
    } finally {
      setIsPending(false);
      setConfirmOpen(false);
    }
  };

  const quickFill = (pct) => {
    if (isBuy) {
      const available = cashBalance * pct;
      const q = available / price;
      setAmount(q > 0 ? q.toFixed(8) : "");
    } else {
      const q = (holding?.amount || 0) * pct;
      setAmount(q > 0 ? q.toFixed(8) : "");
    }
  };

  if (!coin) return null;

  return (
    <>
      <div className="space-y-4">
        {/* Side toggle */}
        <div className="grid grid-cols-2 gap-1 bg-secondary/50 rounded-xl p-1">
          {["BUY", "SELL"].map((s) => (
            <button
              key={s}
              onClick={() => { setSide(s); setAmount(""); }}
              className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                side === s
                  ? s === "BUY"
                    ? "bg-emerald-500 text-white"
                    : "bg-red-500 text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Order type */}
        <div className="flex gap-1 bg-secondary/30 rounded-lg p-1">
          {["market", "limit"].map((ot) => (
            <button
              key={ot}
              onClick={() => setOrderType(ot)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                orderType === ot ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ot}
            </button>
          ))}
        </div>

        {/* Balance info */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{isBuy ? "Available" : `${coin.symbol} Balance`}</span>
          <button onClick={() => setDepositOpen(true)} className="flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors">
            {isBuy ? `$${fmt(cashBalance)}` : `${fmt(holding?.amount || 0, 6)} ${coin.symbol}`}
          </button>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Amount ({coin.symbol})</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-secondary/50 border border-border/40 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary/50 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">{coin.symbol}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[0.25, 0.5, 0.75, 1].map((p) => (
              <button
                key={p}
                onClick={() => quickFill(p)}
                className="py-1 bg-secondary/50 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                {p * 100}%
              </button>
            ))}
          </div>
        </div>

        {/* Limit price (if limit order) */}
        {orderType === "limit" && (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Limit Price (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={priceFmt(coin.price).replace("$", "")}
                className="w-full bg-secondary/50 border border-border/40 rounded-xl pl-6 pr-4 py-3 text-sm font-mono focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Order summary */}
        {qty > 0 && (
          <div className="bg-secondary/30 rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{orderType === "limit" ? "Limit Price" : "Market Price"}</span>
              <span className="font-mono">{priceFmt(price)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono">${fmt(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fee (0.1%)</span>
              <span className="font-mono">${fmt(fees)}</span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold">
              <span>{isBuy ? "Total Cost" : "You Receive"}</span>
              <span className="font-mono text-foreground">${fmt(isBuy ? total + fees : total - fees)}</span>
            </div>
          </div>
        )}

        {!canAfford && qty > 0 && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            {isBuy ? "Insufficient cash balance" : `Insufficient ${coin.symbol} holding`}
          </p>
        )}

        <button
          onClick={() => qty > 0 && canAfford && setConfirmOpen(true)}
          disabled={!qty || !canAfford || isPending}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            isBuy
              ? "bg-emerald-500 hover:bg-emerald-400 text-white"
              : "bg-red-500 hover:bg-red-400 text-white"
          }`}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Processing...
            </span>
          ) : orderType === "limit" ? (
            `Place Limit ${side === "BUY" ? "Buy" : "Sell"} Order`
          ) : (
            `${side === "BUY" ? "Buy" : "Sell"} ${coin.symbol}`
          )}
        </button>
      </div>

      {depositOpen && <DepositDialog open={depositOpen} onOpenChange={setDepositOpen} />}
      {confirmOpen && (
        <TradeConfirmModal
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          trade={{
            type: side,
            symbol: coin.symbol,
            name: coin.name,
            quantity: qty,
            unitPrice: price,
            total,
            fees,
          }}
          onConfirm={handleTrade}
          isLoading={isPending}
        />
      )}
    </>
  );
}

// ── Main Asset page ───────────────────────────────────────────────────────────
export default function Asset() {
  const { coinId } = useParams();
  const navigate = useNavigate();
  const { coins, isLoading: coinsLoading, refetch: refetchCoins } = useMarketCoins();
  const { portfolioId, cashBalance, holdingsMap, refetch: refetchPortfolio } = usePortfolio();
  const queryClient = useQueryClient();

  const [timeframe, setTimeframe] = useState("1D");
  const [chartType, setChartType] = useState("candlestick");
  const [activeIndicators, setActiveIndicators] = useState([]);

  const { candles, indicators, isLoading: chartLoading, error: chartError, refetch: refetchChart } = useCandlestickChart(coinId, timeframe);

  const coin = coins.find((c) => c.id === coinId);

  const { data: watchlistSymbols = [] } = useQuery({
    queryKey: ["watchlist", portfolioId],
    queryFn: () => getWatchlist(portfolioId),
    enabled: !!portfolioId,
    initialData: [],
  });

  const isWatched = coin && watchlistSymbols.includes(coin.symbol);

  const toggleWatch = async () => {
    if (!portfolioId || !coin) return;
    queryClient.setQueryData(["watchlist", portfolioId], (prev = []) =>
      isWatched ? prev.filter((s) => s !== coin.symbol) : [...prev, coin.symbol]
    );
    try {
      isWatched
        ? await removeFromWatchlist(portfolioId, coin.symbol)
        : await addToWatchlist(portfolioId, coin.symbol, coin.name);
    } catch {
      queryClient.invalidateQueries({ queryKey: ["watchlist", portfolioId] });
    }
  };

  const isPositive = (coin?.change24h || 0) >= 0;

  return (
    <div className="space-y-5">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-muted-foreground/30">/</span>
        <Link to="/markets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Markets</Link>
        {coin && (
          <>
            <span className="text-muted-foreground/30">/</span>
            <span className="text-sm font-medium">{coin.name}</span>
          </>
        )}
      </div>

      {coinsLoading && !coin ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !coin ? (
        <div className="text-center py-24">
          <p className="text-muted-foreground">Coin not found: {coinId}</p>
          <button onClick={() => navigate("/markets")} className="mt-4 text-primary hover:underline text-sm">← Back to Markets</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
          {/* LEFT — chart + stats */}
          <div className="space-y-5">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/50 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <img
                    src={coin.image}
                    alt={coin.name}
                    className="w-12 h-12 rounded-full"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-xl font-bold">{coin.name}</h1>
                      <span className="text-xs font-mono bg-secondary/60 px-2 py-0.5 rounded-md text-muted-foreground">{coin.symbol}</span>
                      <span className="text-[10px] bg-secondary/40 text-muted-foreground px-1.5 py-0.5 rounded">#{coin.rank}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold tabular-nums">{priceFmt(coin.price)}</span>
                      <span className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {isPositive ? "+" : ""}{fmt(coin.change24h)}%
                        <span className="text-muted-foreground font-normal text-xs ml-0.5">24h</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleWatch}
                    className={`p-2 rounded-lg border transition-all ${isWatched ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400" : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"}`}
                  >
                    <Star className={`w-4 h-4 ${isWatched ? "fill-yellow-400" : ""}`} />
                  </button>
                  <button
                    onClick={() => refetchCoins()}
                    className="p-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate(`/trade?coin=${coin.symbol}`)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-secondary/60 hover:bg-secondary text-sm font-medium rounded-lg transition-colors"
                  >
                    <BarChart2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Trade Terminal</span>
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Stats grid */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border/50 rounded-xl p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                <StatTile label="24h High" value={priceFmt(coin.high24h)} color="text-emerald-500" />
                <StatTile label="24h Low"  value={priceFmt(coin.low24h)}  color="text-red-500" />
                <StatTile label="24h Volume" value={`$${coin.volume}`} />
                <StatTile label="Market Cap" value={`$${coin.marketCap}`} />
                <StatTile label="All-Time High" value={priceFmt(coin.ath)} sub={`${coin.athChangePercent}% from ATH`} color="text-primary" />
                <StatTile
                  label="Circulating Supply"
                  value={coin.circulatingSupply >= 1e9 ? `${(coin.circulatingSupply / 1e9).toFixed(2)}B` : `${(coin.circulatingSupply / 1e6).toFixed(1)}M`}
                  sub={coin.symbol}
                />
                <StatTile label="7d Change" value={`${coin.change7d >= 0 ? "+" : ""}${fmt(coin.change7d)}%`} color={coin.change7d >= 0 ? "text-emerald-500" : "text-red-500"} />
                {holdingsMap[coin.symbol] && (
                  <StatTile
                    label="Your Holdings"
                    value={`$${fmt(holdingsMap[coin.symbol].amount * coin.price)}`}
                    sub={`${fmt(holdingsMap[coin.symbol].amount, 6)} ${coin.symbol}`}
                    color="text-primary"
                  />
                )}
              </div>
            </motion.div>

            {/* Chart */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border/50 rounded-xl p-4" style={{ height: 520 }}>
              {chartError && (
                <div className="flex items-center gap-2 mb-3 text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Chart data unavailable (CoinGecko rate limit). Try again in a moment.
                </div>
              )}
              <CandlestickChart
                candles={candles}
                indicators={indicators}
                isLoading={chartLoading}
                timeframe={timeframe}
                setTimeframe={setTimeframe}
                chartType={chartType}
                setChartType={setChartType}
                activeIndicators={activeIndicators}
                setActiveIndicators={setActiveIndicators}
              />
            </motion.div>
          </div>

          {/* RIGHT — trade widget */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="space-y-4">
            <div className="bg-card border border-border/50 rounded-xl p-5 sticky top-4">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Quick Trade
              </h2>
              <TradeWidget
                coin={coin}
                portfolioId={portfolioId}
                cashBalance={cashBalance}
                holdingsMap={holdingsMap}
                refetch={refetchPortfolio}
              />
            </div>

            {/* Market info card */}
            <div className="bg-card border border-border/50 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> Market Data
              </h3>
              {[
                ["Rank", `#${coin.rank}`],
                ["Price", priceFmt(coin.price)],
                ["24h Change", `${coin.change24h >= 0 ? "+" : ""}${fmt(coin.change24h)}%`],
                ["Volume (24h)", `$${coin.volume}`],
                ["Market Cap", `$${coin.marketCap}`],
                ["All-Time High", priceFmt(coin.ath)],
                ["ATH Distance", `${coin.athChangePercent}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium tabular-nums">{v}</span>
                </div>
              ))}
              <a
                href={`https://www.coingecko.com/en/coins/${coinId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-2"
              >
                <Globe className="w-3.5 h-3.5" />
                View on CoinGecko
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
