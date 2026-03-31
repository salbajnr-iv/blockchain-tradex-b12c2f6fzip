import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "@/lib/api/transactions";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { format, parseISO, startOfMonth } from "date-fns";
import { groupBy, sumBy } from "lodash";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { motion } from "framer-motion";
import { Loader2, TrendingUp, ArrowUpRight, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

const COLORS = {
  bank_transfer: "#22c55e",
  crypto_wallet: "#06b6d4",
  paypal: "#a78bfa",
  wire_transfer: "#f59e0b",
  other: "#6b7280",
};

const METHOD_LABELS = {
  bank_transfer: "Bank Transfer",
  crypto_wallet: "Crypto Wallet",
  paypal: "PayPal",
  wire_transfer: "Wire Transfer",
  other: "Other",
};

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

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0];
  return (
    <div className="bg-card border border-border/50 rounded-lg px-4 py-3 shadow-xl text-xs">
      <p className="font-semibold text-foreground">{name}</p>
      <p className="text-muted-foreground">${value?.toLocaleString()} — {(percent * 100).toFixed(1)}%</p>
    </div>
  );
};

export default function Analytics() {
  const { portfolioId } = usePortfolio();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions-analytics", portfolioId],
    queryFn: () => listTransactions(portfolioId, 500),
    enabled: !!portfolioId,
    initialData: [],
  });

  const monthlyData = useMemo(() => {
    const byMonth = groupBy(transactions, (tx) =>
      format(startOfMonth(parseISO(tx.transaction_date)), "MMM yyyy")
    );
    return Object.entries(byMonth)
      .map(([month, txs]) => ({
        month,
        Withdrawals: sumBy(txs.filter((t) => t.type === "WITHDRAWAL"), "total_amount") || 0,
        Trading: sumBy(txs.filter((t) => t.type === "BUY" || t.type === "SELL"), "total_amount") || 0,
      }))
      .sort((a, b) => new Date(a.month) - new Date(b.month))
      .slice(-12);
  }, [transactions]);

  const pieData = useMemo(() => {
    const withdrawals = transactions.filter((t) => t.type === "WITHDRAWAL");
    const methodGroups = groupBy(withdrawals, (tx) => {
      const notes = tx.notes || "";
      if (notes.toLowerCase().includes("bank")) return "bank_transfer";
      if (notes.toLowerCase().includes("crypto")) return "crypto_wallet";
      if (notes.toLowerCase().includes("paypal")) return "paypal";
      if (notes.toLowerCase().includes("wire")) return "wire_transfer";
      return "other";
    });
    return Object.entries(methodGroups)
      .map(([key, txs]) => ({
        name: METHOD_LABELS[key] || key,
        value: Math.round(sumBy(txs, "total_amount")),
        color: COLORS[key] || COLORS.other,
      }))
      .filter((d) => d.value > 0);
  }, [transactions]);

  const cumulativeData = useMemo(() => {
    let running = 0;
    return transactions
      .filter((t) => t.type === "WITHDRAWAL")
      .sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date))
      .map((tx) => {
        running += tx.total_amount || 0;
        return {
          date: format(parseISO(tx.transaction_date), "MMM d"),
          Total: Math.round(running),
        };
      });
  }, [transactions]);

  const totalWithdrawals = sumBy(transactions.filter((t) => t.type === "WITHDRAWAL"), "total_amount") || 0;
  const totalTrading = sumBy(transactions.filter((t) => t.type === "BUY" || t.type === "SELL"), "total_amount") || 0;
  const totalTxCount = transactions.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Transaction Analytics</h1>
            <p className="text-muted-foreground mt-1">Visual breakdown of your trading & withdrawal activity</p>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Withdrawals", value: `$${totalWithdrawals.toLocaleString()}`, icon: ArrowUpRight, color: "text-primary" },
            { label: "Total Trading Volume", value: `$${totalTrading.toLocaleString()}`, icon: TrendingUp, color: "text-cyan-400" },
            { label: "Total Transactions", value: totalTxCount, icon: Wallet, color: "text-violet-400" },
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
                <Bar dataKey="Withdrawals" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Trading" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    </div>
  );
}
