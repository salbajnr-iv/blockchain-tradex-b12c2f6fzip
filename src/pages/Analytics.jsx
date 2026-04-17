import React, { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "@/lib/api/transactions";
import { listTrades } from "@/lib/api/portfolio";
import { writePortfolioSnapshot, getPortfolioHistory } from "@/lib/api/portfolioSnapshots";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useLivePrices } from "@/hooks/useLivePrices";
import { useTheme } from "@/contexts/ThemeContext";
import { fmtUsd } from "@/lib/formatters";
import { format, parseISO, startOfMonth } from "date-fns";
import { groupBy, sumBy } from "lodash";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import {
  Loader2, TrendingUp, ArrowUpRight, Wallet, BarChart3,
  PieChart as PieIcon, TrendingDown, DollarSign,
} from "lucide-react";
import { Link } from "react-router-dom";

const WITHDRAWAL_COLORS = {
  bank_transfer: "#22c55e",
  crypto_wallet: "#06b6d4",
  paypal: "#a78bfa",
  wire_transfer: "#f59e0b",
  other: "#6b7280",
};

const ASSET_COLORS = ["#22c55e", "#06b6d4", "#a78bfa", "#f59e0b", "#f43f5e", "#3b82f6", "#f97316", "#84cc16"];

const METHOD_LABELS = {
  bank_transfer: "Bank Transfer",
  crypto_wallet: "Crypto Wallet",
  paypal: "PayPal",
  wire_transfer: "Wire Transfer",
  other: "Other",
};

const HISTORY_RANGES = ["1W", "1M", "3M", "1Y", "ALL"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/50 rounded-lg px-4 py-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">${p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const HistoryTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/50 rounded-lg px-4 py-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="text-primary font-medium">${Number(payload[0]?.value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0];
  return (
    <div className="bg-card border border-border/50 rounded-lg px-4 py-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground">{name}</p>
      <p className="text-muted-foreground">${value?.toLocaleString(undefined, { maximumFractionDigits: 2 })} — {(percent * 100).toFixed(1)}%</p>
    </div>
  );
};

export default function Analytics() {
  const { portfolioId, cashBalance, holdings, holdingsMap } = usePortfolio();
  const { cryptoList, isLoading: pricesLoading, portfolioTotal, cryptoPortfolioValue } = useLivePrices();
  const { displayPrefs } = useTheme();
  const compact  = displayPrefs?.compactNumbers  ?? true;
  const animated = displayPrefs?.animatedCharts  ?? true;
  const [historyRange, setHistoryRange] = useState("1M");
  const [snapshotWritten, setSnapshotWritten] = useState(false);

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions-analytics", portfolioId],
    queryFn: () => listTransactions(portfolioId, 500),
    enabled: !!portfolioId,
    initialData: [],
  });

  const { data: trades = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["trades", portfolioId],
    queryFn: () => listTrades(portfolioId, 500),
    enabled: !!portfolioId,
    initialData: [],
  });

  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery({
    queryKey: ["portfolio-snapshots", portfolioId, historyRange],
    queryFn: () => getPortfolioHistory(portfolioId, historyRange),
    enabled: !!portfolioId,
    initialData: [],
  });

  // Write a daily snapshot on mount (once per session, non-blocking)
  useEffect(() => {
    if (!portfolioId || snapshotWritten || pricesLoading || portfolioTotal === 0) return;
    setSnapshotWritten(true);
    writePortfolioSnapshot(portfolioId, {
      totalValue:  portfolioTotal,
      cashBalance: cashBalance,
      cryptoValue: cryptoPortfolioValue || 0,
    }).catch(() => {}); // table might not exist — ignore
  }, [portfolioId, portfolioTotal, cashBalance, cryptoPortfolioValue, pricesLoading, snapshotWritten]);

  const isLoading = txLoading || tradesLoading || pricesLoading;

  // ── Portfolio history chart data ──────────────────────────────────────────
  const historyData = useMemo(() => {
    if (snapshots.length > 0) {
      return snapshots.map((s) => ({
        date: format(parseISO(s.snapshot_date), "MMM d"),
        Value: parseFloat(s.total_value || 0),
      }));
    }
    // Fallback: reconstruct cash-flow history from transactions
    let runningCash = 0;
    const sorted = [...transactions]
      .sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
    const daily = {};
    for (const tx of sorted) {
      if (tx.type === "DEPOSIT")    runningCash += tx.total_amount || 0;
      if (tx.type === "WITHDRAWAL") runningCash -= tx.total_amount || 0;
      const day = format(parseISO(tx.transaction_date), "MMM d");
      daily[day] = parseFloat(runningCash.toFixed(2));
    }
    return Object.entries(daily).map(([date, Value]) => ({ date, Value }));
  }, [snapshots, transactions]);

  // ── Cost Basis & P&L ─────────────────────────────────────────────────────
  const plData = useMemo(() => {
    return holdings
      .filter((h) => h.amount > 0)
      .map((h) => {
        const liveEntry = cryptoList.find((c) => c.symbol === h.symbol);
        const currentPrice = liveEntry?.price ?? h.current_price ?? 0;
        const currentValue = h.amount * currentPrice;
        const costBasis = h.amount * (h.average_cost || 0);
        const unrealizedPnl = currentValue - costBasis;
        const pnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
        return {
          symbol: h.symbol,
          name: h.name || h.symbol,
          quantity: h.amount,
          avgCost: h.average_cost || 0,
          currentPrice,
          currentValue,
          costBasis,
          unrealizedPnl,
          pnlPct,
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue);
  }, [holdings, cryptoList]);

  const totalUnrealizedPnl = sumBy(plData, "unrealizedPnl");
  const totalCostBasis     = sumBy(plData, "costBasis");
  const totalPnlPct        = totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0;

  // ── Monthly activity data ─────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const tradesByMonth = groupBy(trades, (t) =>
      format(startOfMonth(parseISO(t.trade_date)), "MMM yyyy")
    );
    const txByMonth = groupBy(
      transactions.filter((t) => t.type === "WITHDRAWAL"),
      (t) => format(startOfMonth(parseISO(t.transaction_date)), "MMM yyyy")
    );
    const allMonths = new Set([...Object.keys(tradesByMonth), ...Object.keys(txByMonth)]);
    return Array.from(allMonths)
      .map((month) => ({
        month,
        Withdrawals: Math.round(sumBy(txByMonth[month] || [], "total_amount") || 0),
        Trading: Math.round(
          sumBy(tradesByMonth[month] || [], (t) => t.quantity * t.unit_price) || 0
        ),
      }))
      .sort((a, b) => new Date(a.month) - new Date(b.month))
      .slice(-12);
  }, [trades, transactions]);

  // ── Withdrawal method pie ─────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const withdrawals = transactions.filter((t) => t.type === "WITHDRAWAL");
    const methodGroups = groupBy(withdrawals, (tx) => {
      const m = tx.payment_method || "";
      const n = tx.notes || "";
      if (m === "bank_transfer" || n.toLowerCase().includes("bank")) return "bank_transfer";
      if (m === "crypto_wallet" || n.toLowerCase().includes("crypto")) return "crypto_wallet";
      if (m === "paypal" || n.toLowerCase().includes("paypal")) return "paypal";
      if (m === "wire_transfer" || n.toLowerCase().includes("wire")) return "wire_transfer";
      return "other";
    });
    return Object.entries(methodGroups)
      .map(([key, txs]) => ({
        name: METHOD_LABELS[key] || key,
        value: Math.round(sumBy(txs, "total_amount")),
        color: WITHDRAWAL_COLORS[key] || WITHDRAWAL_COLORS.other,
      }))
      .filter((d) => d.value > 0);
  }, [transactions]);

  // ── Asset allocation pie ──────────────────────────────────────────────────
  const assetAllocationData = useMemo(() => {
    const held = cryptoList.filter((c) => c.holdings > 0);
    const data = held.map((c, i) => ({
      name: c.symbol,
      fullName: c.name,
      value: parseFloat((c.holdings * c.price).toFixed(2)),
      color: ASSET_COLORS[i % ASSET_COLORS.length],
    }));
    if (cashBalance > 0) {
      data.push({ name: "Cash", fullName: "USD Cash", value: parseFloat(cashBalance.toFixed(2)), color: "#64748b" });
    }
    return data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  }, [cryptoList, cashBalance]);

  // ── Cumulative withdrawals ────────────────────────────────────────────────
  const cumulativeData = useMemo(() => {
    let running = 0;
    return transactions
      .filter((t) => t.type === "WITHDRAWAL")
      .sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date))
      .map((tx) => {
        running += tx.total_amount || 0;
        return { date: format(parseISO(tx.transaction_date), "MMM d"), Total: Math.round(running) };
      });
  }, [transactions]);

  const totalWithdrawals = sumBy(transactions.filter((t) => t.type === "WITHDRAWAL"), "total_amount") || 0;
  const totalTradingVolume = sumBy(trades, (t) => t.quantity * t.unit_price) || 0;
  const totalTxCount = transactions.length + trades.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Analytics</h1>
            <p className="text-muted-foreground mt-1 text-sm">Portfolio breakdown, P&L, trading activity & withdrawal history</p>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
            ← Dashboard
          </Link>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: "Portfolio Value", value: fmtUsd(portfolioTotal, compact), icon: Wallet, color: "text-primary" },
            { label: "Total Withdrawals", value: fmtUsd(totalWithdrawals, compact), icon: ArrowUpRight, color: "text-yellow-400" },
            { label: "Trading Volume", value: fmtUsd(totalTradingVolume, compact), icon: TrendingUp, color: "text-cyan-400" },
            { label: "Total Activity", value: totalTxCount, icon: BarChart3, color: "text-violet-400" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card border border-border/50 rounded-xl p-5 flex items-center gap-4"
            >
              <div className={`p-3 rounded-lg bg-secondary/50 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Portfolio History Chart ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border/50 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Portfolio History</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Total portfolio value over time</p>
            </div>
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
              {HISTORY_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setHistoryRange(r)}
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                    historyRange === r
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {historyData.length < 2 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <p>Portfolio history builds up over time as you use the app.</p>
              <p className="mt-1 text-xs opacity-70">Visit this page daily — each visit records a snapshot that populates this chart.</p>
            </div>
          ) : (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => compact ? fmtUsd(v, true) : `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                  <Tooltip content={<HistoryTooltip />} />
                  <Area isAnimationActive={animated} type="monotone" dataKey="Value" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#histGrad)" name="Portfolio Value" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* ── Cost Basis & P&L ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-card border border-border/50 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Cost Basis & Unrealised P&L</h2>
            </div>
            {totalCostBasis > 0 && (
              <div className={`flex items-center gap-1.5 text-sm font-semibold ${totalUnrealizedPnl >= 0 ? "text-primary" : "text-destructive"}`}>
                {totalUnrealizedPnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {totalUnrealizedPnl >= 0 ? "+" : ""}${Math.abs(totalUnrealizedPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <span className="text-muted-foreground font-normal text-xs">({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}% overall)</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-5">Average purchase price vs. current market price per asset</p>

          {plData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">No holdings yet. Start trading to see your P&L here.</p>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    {["Asset", "Qty", "Avg Cost", "Current Price", "Cost Basis", "Current Value", "Unreal. P&L", "%"].map((h) => (
                      <th key={h} className="text-left text-[11px] text-muted-foreground font-medium pb-3 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {plData.map((row) => (
                    <tr key={row.symbol} className="hover:bg-secondary/20 transition-colors">
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-semibold text-foreground">{row.symbol}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">{row.name}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-foreground">
                        {row.quantity < 0.001
                          ? row.quantity.toExponential(3)
                          : row.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                        ${row.avgCost.toLocaleString(undefined, { maximumFractionDigits: row.avgCost < 1 ? 6 : 2 })}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-foreground">
                        ${row.currentPrice.toLocaleString(undefined, { maximumFractionDigits: row.currentPrice < 1 ? 6 : 2 })}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                        ${row.costBasis.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-foreground font-medium">
                        ${row.currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className={`py-3 pr-4 tabular-nums font-semibold ${row.unrealizedPnl >= 0 ? "text-primary" : "text-destructive"}`}>
                        {row.unrealizedPnl >= 0 ? "+" : ""}${row.unrealizedPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className={`py-3 tabular-nums font-semibold text-xs ${row.pnlPct >= 0 ? "text-primary" : "text-destructive"}`}>
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.pnlPct >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                          {row.pnlPct >= 0 ? "+" : ""}{row.pnlPct.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* ── Asset Allocation ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border/50 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <PieIcon className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Portfolio Allocation</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-6">Current holdings by value</p>

          {assetAllocationData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">No holdings yet. Start trading to see your allocation here.</p>
          ) : (
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="w-full lg:w-1/2">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={assetAllocationData}
                      cx="50%" cy="50%"
                      innerRadius={65} outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {assetAllocationData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full lg:w-1/2 space-y-2">
                {assetAllocationData.map((entry) => {
                  const pct = portfolioTotal > 0 ? ((entry.value / portfolioTotal) * 100).toFixed(1) : "0.0";
                  return (
                    <div key={entry.name} className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: entry.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="text-sm font-semibold">{entry.name}</span>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="w-full bg-secondary/50 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: entry.color }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium tabular-nums text-right min-w-[80px]">
                        ${entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Monthly Activity ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border/50 rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-foreground mb-1">Monthly Activity</h2>
          <p className="text-xs text-muted-foreground mb-6">Withdrawals vs. trading volume by month</p>
          {monthlyData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">No data yet. Start trading to see your analytics here.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} />
                <Bar isAnimationActive={animated} dataKey="Withdrawals" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar isAnimationActive={animated} dataKey="Trading" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Withdrawal Methods */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border/50 rounded-xl p-6"
          >
            <h2 className="text-lg font-semibold text-foreground mb-1">Withdrawal Methods</h2>
            <p className="text-xs text-muted-foreground mb-4">Distribution of funds by withdrawal type</p>
            {pieData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">No withdrawals yet</p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                      {entry.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Cumulative Withdrawals */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border/50 rounded-xl p-6"
          >
            <h2 className="text-lg font-semibold text-foreground mb-1">Cumulative Withdrawals</h2>
            <p className="text-xs text-muted-foreground mb-6">Running total of all withdrawal amounts</p>
            {cumulativeData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">No withdrawals yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={cumulativeData}>
                  <defs>
                    <linearGradient id="withdrawGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#withdrawGrad)" name="Total Withdrawn" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>
    </div>
  );
}
