import React from "react";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "@/lib/api/transactions";
import { listTrades } from "@/lib/api/portfolio";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useTheme } from "@/contexts/ThemeContext";
import { fmtUsd } from "@/lib/formatters";

export default function PortfolioStats({ portfolioTotal, portfolioChange24h, isLoading }) {
  const { portfolioId, cashBalance } = usePortfolio();
  const { displayPrefs } = useTheme();
  const compact = displayPrefs?.compactNumbers ?? true;
  const animated = displayPrefs?.animatedCharts ?? true;

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", portfolioId],
    queryFn: () => listTransactions(portfolioId, 200),
    enabled: !!portfolioId,
    initialData: [],
  });

  const { data: trades = [] } = useQuery({
    queryKey: ["trades", portfolioId],
    queryFn: () => listTrades(portfolioId, 200),
    enabled: !!portfolioId,
    initialData: [],
  });

  const withdrawals = transactions.filter((t) => t.type === "WITHDRAWAL");
  const pendingWithdrawals = withdrawals.filter((t) => t.status === "pending").length;

  const todayTrades = trades.filter((t) => {
    const d = new Date(t.trade_date);
    return d.toDateString() === new Date().toDateString();
  }).length;

  const pnl24h = portfolioTotal * (portfolioChange24h / 100);

  const stats = [
    {
      label: "Portfolio Value",
      value: isLoading ? "Loading..." : fmtUsd(portfolioTotal, compact),
      change: isLoading ? "..." : `${portfolioChange24h >= 0 ? "+" : ""}${portfolioChange24h}%`,
      isPositive: portfolioChange24h >= 0,
      icon: DollarSign,
    },
    {
      label: "24h P&L",
      value: isLoading ? "Loading..." : `${pnl24h >= 0 ? "+" : ""}${fmtUsd(Math.abs(pnl24h), compact)}`,
      change: isLoading ? "..." : `${portfolioChange24h >= 0 ? "+" : ""}${portfolioChange24h}%`,
      isPositive: pnl24h >= 0,
      icon: pnl24h >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: "Total Trades",
      value: trades.length.toLocaleString(),
      change: `${todayTrades} today`,
      isPositive: true,
      icon: BarChart3,
    },
    {
      label: "Cash Balance",
      value: fmtUsd(cashBalance, compact),
      change: pendingWithdrawals > 0 ? `${pendingWithdrawals} withdrawal pending` : "available",
      isPositive: true,
      icon: Wallet,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={animated ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: animated ? i * 0.1 : 0 }}
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
