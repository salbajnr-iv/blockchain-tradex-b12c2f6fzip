import React from "react";
import { useOutletContext } from "react-router-dom";
import PortfolioStats from "@/components/crypto/PortfolioStats";
import PriceChart from "@/components/crypto/PriceChart";
import RecentTrades from "@/components/crypto/RecentTrades";
import { useLivePrices } from "@/hooks/useLivePrices";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useQuery } from "@tanstack/react-query";
import { listTrades } from "@/lib/api/portfolio";
import { listTransactions } from "@/lib/api/transactions";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, Zap,
  PlusCircle, ArrowUpRight as WithdrawIcon, BarChart3, Bell,
  DollarSign, Activity, Target, Clock, Sparkles,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

function MarketTicker({ cryptoList }) {
  return (
    <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30">
        <Activity className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Market</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-primary font-medium">
          <Zap className="w-3 h-3" /> Live
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border/30">
        {cryptoList.slice(0, 4).map((coin) => {
          const isPos = (coin.change24h || 0) >= 0;
          return (
            <Link to={`/trade?coin=${coin.symbol}`} key={coin.symbol} className="px-4 py-3 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{coin.icon}</span>
                  <span className="text-xs font-bold text-foreground">{coin.symbol}</span>
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isPos ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                  {isPos ? "+" : ""}{coin.change24h?.toFixed(2)}%
                </span>
              </div>
              <p className="text-sm font-bold text-foreground tabular-nums">
                ${coin.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-muted-foreground">{coin.name}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TopMovers({ cryptoList }) {
  const sorted = [...cryptoList].sort((a, b) => Math.abs(b.change24h || 0) - Math.abs(a.change24h || 0));
  const gainers = sorted.filter(c => (c.change24h || 0) > 0).slice(0, 3);
  const losers = sorted.filter(c => (c.change24h || 0) < 0).slice(0, 3);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-card border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Gainers</span>
        </div>
        <div className="space-y-2.5">
          {gainers.map((coin) => (
            <Link to={`/trade?coin=${coin.symbol}`} key={coin.symbol} className="flex items-center justify-between hover:bg-secondary/30 rounded-lg px-2 py-1 -mx-2 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-lg">{coin.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{coin.symbol}</p>
                  <p className="text-[10px] text-muted-foreground">{coin.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">+{coin.change24h?.toFixed(2)}%</p>
                <p className="text-[10px] text-muted-foreground">${coin.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-4 h-4 text-destructive" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Losers</span>
        </div>
        <div className="space-y-2.5">
          {losers.map((coin) => (
            <Link to={`/trade?coin=${coin.symbol}`} key={coin.symbol} className="flex items-center justify-between hover:bg-secondary/30 rounded-lg px-2 py-1 -mx-2 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-lg">{coin.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{coin.symbol}</p>
                  <p className="text-[10px] text-muted-foreground">{coin.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-destructive">{coin.change24h?.toFixed(2)}%</p>
                <p className="text-[10px] text-muted-foreground">${coin.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickActions({ onDeposit, onWithdraw }) {
  const navigate = useNavigate();
  const actions = [
    { label: "Trade Now",    icon: ArrowUpRight,  color: "bg-primary/10 text-primary border-primary/20",      action: () => navigate("/trade") },
    { label: "Add Funds",    icon: PlusCircle,    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",   action: onDeposit },
    { label: "Withdraw",     icon: WithdrawIcon,  color: "bg-orange-400/10 text-orange-400 border-orange-400/20", action: onWithdraw },
    { label: "Set Alert",    icon: Bell,          color: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20", action: () => navigate("/alerts") },
    { label: "Markets",      icon: BarChart3,     color: "bg-violet-400/10 text-violet-400 border-violet-400/20", action: () => navigate("/markets") },
    { label: "Analytics",    icon: Activity,      color: "bg-pink-400/10 text-pink-400 border-pink-400/20",    action: () => navigate("/analytics") },
  ];

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {actions.map(({ label, icon: Icon, color, action }) => (
          <button
            key={label}
            onClick={action}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all hover:scale-105 ${color}`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RecentActivity({ trades, transactions }) {
  const allActivity = [
    ...trades.slice(0, 5).map(t => ({
      id: `trade-${t.id}`,
      icon: t.type === "BUY" ? ArrowDownLeft : ArrowUpRight,
      iconColor: t.type === "BUY" ? "text-primary" : "text-destructive",
      iconBg: t.type === "BUY" ? "bg-primary/10" : "bg-destructive/10",
      title: `${t.type === "BUY" ? "Bought" : "Sold"} ${t.symbol}`,
      amount: `${t.type === "BUY" ? "+" : "-"}${Number(t.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${t.symbol}`,
      value: `$${Number(t.net_value || t.quantity * t.unit_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      date: t.trade_date,
      positive: t.type === "BUY",
    })),
    ...transactions.slice(0, 3).map(t => ({
      id: `tx-${t.id}`,
      icon: t.type === "DEPOSIT" ? DollarSign : ArrowUpRight,
      iconColor: t.type === "DEPOSIT" ? "text-primary" : "text-orange-400",
      iconBg: t.type === "DEPOSIT" ? "bg-primary/10" : "bg-orange-400/10",
      title: t.type === "DEPOSIT" ? "Deposit" : "Withdrawal",
      amount: t.type === "DEPOSIT" ? `+$${Number(t.total_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `-$${Number(t.total_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      value: t.status,
      date: t.transaction_date,
      positive: t.type === "DEPOSIT",
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  const timeAgo = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-card border border-border/50 rounded-xl"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</span>
        </div>
        <Link to="/transactions" className="text-xs text-primary hover:text-primary/80 font-medium">View all</Link>
      </div>
      {allActivity.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No activity yet</p>
      ) : (
        <div className="divide-y divide-border/20">
          {allActivity.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/20 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.iconBg}`}>
                  <Icon className={`w-4 h-4 ${item.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(item.date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${item.positive ? "text-primary" : "text-destructive"}`}>{item.amount}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function HoldingsSummary({ cryptoList }) {
  const holdings = cryptoList.filter(c => c.holdings > 0);
  if (holdings.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-card border border-border/50 rounded-xl"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Holdings</span>
        </div>
        <Link to="/analytics" className="text-xs text-primary hover:text-primary/80 font-medium">Analytics</Link>
      </div>
      <div className="divide-y divide-border/20">
        {holdings.map((coin) => {
          const isPos = (coin.change24h || 0) >= 0;
          const value = coin.holdings * coin.price;
          return (
            <Link to={`/trade?coin=${coin.symbol}`} key={coin.symbol} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/20 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">{coin.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{coin.symbol}</p>
                  <p className="text-xs text-muted-foreground">{Number(coin.holdings).toLocaleString(undefined, { maximumFractionDigits: 6 })} coins</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                <p className={`text-xs font-medium ${isPos ? "text-primary" : "text-destructive"}`}>
                  {isPos ? "+" : ""}{coin.change24h?.toFixed(2)}%
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { onDepositOpen, onWithdrawOpen } = useOutletContext() || {};
  const { cryptoList, isLoading, portfolioTotal, portfolioChange24h } = useLivePrices();
  const { portfolioId } = usePortfolio();

  const { data: trades = [] } = useQuery({
    queryKey: ["trades", portfolioId],
    queryFn: () => listTrades(portfolioId, 50),
    enabled: !!portfolioId,
    initialData: [],
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", portfolioId],
    queryFn: () => listTransactions(portfolioId, 50),
    enabled: !!portfolioId,
    initialData: [],
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Live data
        </span>
      </div>

      {/* Stats */}
      <PortfolioStats
        portfolioTotal={portfolioTotal}
        portfolioChange24h={portfolioChange24h}
        isLoading={isLoading}
      />

      {/* Market ticker */}
      <MarketTicker cryptoList={cryptoList} />

      {/* Quick actions */}
      <QuickActions onDeposit={onDepositOpen} onWithdraw={onWithdrawOpen} />

      {/* Chart + Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <PriceChart />
        </div>
        <div>
          <RecentTrades />
        </div>
      </div>

      {/* Top movers */}
      <TopMovers cryptoList={cryptoList} />

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentActivity trades={trades} transactions={transactions} />
        <HoldingsSummary cryptoList={cryptoList} />
      </div>
    </div>
  );
}
