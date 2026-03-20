import React from "react";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Activity, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function PortfolioStats({ portfolioTotal, portfolioChange24h, isLoading }) {
  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions-stats"],
    queryFn: () => base44.entities.Transaction.list("-transaction_date", 200),
    initialData: [],
  });

  const totalTrades = transactions.filter((t) => t.type === "trade").length;
  const completedTrades = transactions.filter((t) => t.type === "trade" && t.status === "completed");
  const sells = completedTrades.filter((t) => t.side === "sell");
  const winRate = completedTrades.length > 0
    ? Math.round((sells.length / completedTrades.length) * 100 * 10) / 10
    : 0;

  const withdrawals = transactions.filter((t) => t.type === "withdrawal");
  const totalWithdrawn = withdrawals.reduce((sum, t) => sum + (t.amount || 0), 0);
  const pendingWithdrawals = withdrawals.filter((t) => t.status === "pending").length;

  const pnl24h = portfolioTotal * (portfolioChange24h / 100);

  const stats = [
    {
      label: "Portfolio Value",
      value: isLoading ? "Loading..." : `$${portfolioTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      change: isLoading ? "..." : `${portfolioChange24h >= 0 ? "+" : ""}${portfolioChange24h}%`,
      isPositive: portfolioChange24h >= 0,
      icon: DollarSign,
    },
    {
      label: "24h P&L",
      value: isLoading ? "Loading..." : `${pnl24h >= 0 ? "+" : ""}$${Math.abs(pnl24h).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      change: isLoading ? "..." : `${portfolioChange24h >= 0 ? "+" : ""}${portfolioChange24h}%`,
      isPositive: pnl24h >= 0,
      icon: pnl24h >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: "Total Trades",
      value: totalTrades.toLocaleString(),
      change: `${transactions.filter((t) => {
        const d = new Date(t.transaction_date);
        return d.toDateString() === new Date().toDateString();
      }).length} today`,
      isPositive: true,
      icon: BarChart3,
    },
    {
      label: "Withdrawals",
      value: `$${totalWithdrawn.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      change: pendingWithdrawals > 0 ? `${pendingWithdrawals} pending` : `${withdrawals.length} total`,
      isPositive: pendingWithdrawals === 0,
      icon: ArrowUpRight,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-card rounded-xl p-5 border border-border/50 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <stat.icon className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold">{stat.value}</p>
          <div className="flex items-center gap-1 mt-1">
            {stat.isPositive ? (
              <TrendingUp className="w-3 h-3 text-primary" />
            ) : (
              <TrendingDown className="w-3 h-3 text-destructive" />
            )}
            <span className={`text-xs font-medium ${stat.isPositive ? "text-primary" : "text-destructive"}`}>
              {stat.change}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}