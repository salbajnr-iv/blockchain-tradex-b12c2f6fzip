import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTransactions } from "@/lib/api/transactions";
import { listTrades } from "@/lib/api/portfolio";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle,
  Loader2, Send, BarChart3, Search, SlidersHorizontal, X, MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import DepositDialog from "@/components/crypto/DepositDialog";
import { useNavigate } from "react-router-dom";

const METHOD_LABELS = {
  bank_transfer: "Bank Transfer",
  crypto_wallet: "Crypto Wallet",
  paypal: "PayPal",
  wire_transfer: "Wire Transfer",
};

const DATE_RANGES = [
  { label: "All Time", value: "all" },
  { label: "Today",    value: "today" },
  { label: "Week",     value: "week" },
  { label: "Month",    value: "month" },
];

const TYPE_FILTERS = [
  { label: "All",        value: "all" },
  { label: "Buy",        value: "BUY" },
  { label: "Sell",       value: "SELL" },
  { label: "Deposit",    value: "DEPOSIT" },
  { label: "Withdrawal", value: "WITHDRAWAL" },
];

function getDateCutoff(range) {
  const now = new Date();
  switch (range) {
    case "today": return startOfDay(now);
    case "week":  return startOfWeek(now);
    case "month": return startOfMonth(now);
    default:      return null;
  }
}

export default function Transactions() {
  const navigate = useNavigate();
  const [depositDialog, setDepositDialog] = useState(false);

  // Filters
  const [searchSymbol, setSearchSymbol] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const { portfolioId } = usePortfolio();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ["transactions", portfolioId],
    queryFn: () => listTransactions(portfolioId, 200),
    enabled: !!portfolioId,
    initialData: [],
  });

  const { data: trades = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["trades", portfolioId],
    queryFn: () => listTrades(portfolioId, 200),
    enabled: !!portfolioId,
    initialData: [],
  });

  const isLoading = txLoading || tradesLoading;

  // Supabase Realtime — subscribe to new trades and transactions
  useEffect(() => {
    if (!portfolioId) return;

    const tradesChannel = supabase
      .channel(`realtime:tx-trades:${portfolioId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "trades",
        filter: `portfolio_id=eq.${portfolioId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["trades", portfolioId] });
      })
      .subscribe();

    const txChannel = supabase
      .channel(`realtime:tx-transactions:${portfolioId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        filter: `portfolio_id=eq.${portfolioId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["transactions", portfolioId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tradesChannel);
      supabase.removeChannel(txChannel);
    };
  }, [portfolioId, queryClient]);

  // Combine all activity — BUY/SELL come from trades table to avoid duplicates
  const allActivity = useMemo(() => {
    const combined = [
      ...transactions
        .filter((t) => t.type !== "BUY" && t.type !== "SELL")
        .map((t) => ({
        ...t,
        _source: "transaction",
        _type: t.type,
        _symbol: null,
        _date: new Date(t.transaction_date),
      })),
      ...trades.map((t) => ({
        ...t,
        _source: "trade",
        _type: t.type,
        _symbol: t.symbol,
        _date: new Date(t.trade_date),
        transaction_date: t.trade_date,
      })),
    ].sort((a, b) => b._date - a._date);
    return combined;
  }, [transactions, trades]);

  // Apply filters
  const filtered = useMemo(() => {
    const cutoff = getDateCutoff(dateRange);
    return allActivity.filter((item) => {
      if (cutoff && item._date < cutoff) return false;
      if (typeFilter !== "all" && item._type !== typeFilter) return false;
      if (searchSymbol.trim()) {
        const q = searchSymbol.trim().toUpperCase();
        const sym = (item._symbol || item.symbol || "").toUpperCase();
        if (!sym.includes(q)) return false;
      }
      return true;
    });
  }, [allActivity, typeFilter, dateRange, searchSymbol]);

  const getStatusIcon = (status) => {
    switch ((status || "").toLowerCase()) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-primary" />;
      case "pending":   return <Clock className="w-5 h-5 text-yellow-400" />;
      case "failed":    return <XCircle className="w-5 h-5 text-destructive" />;
      default:          return null;
    }
  };

  const getStatusColor = (status) => {
    switch ((status || "").toLowerCase()) {
      case "completed": return "bg-primary/10 text-primary";
      case "pending":   return "bg-yellow-400/10 text-yellow-400";
      case "failed":    return "bg-destructive/10 text-destructive";
      default:          return "bg-muted text-muted-foreground";
    }
  };

  const renderActivity = (item, index) => {
    if (item._source === "trade") {
      const isBuy = item.type === "BUY";
      return (
        <motion.div
          key={`trade-${item.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(index * 0.03, 0.3) }}
          className="bg-card rounded-lg border border-border/50 p-4 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-secondary/50">
                {isBuy
                  ? <ArrowDownLeft className="w-5 h-5 text-primary" />
                  : <ArrowUpRight className="w-5 h-5 text-destructive" />}
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {isBuy ? "Buy" : "Sell"} {item.symbol}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(item._date, "MMM d, yyyy • h:mm a")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={`font-semibold ${isBuy ? "text-primary" : "text-destructive"}`}>
                  {isBuy ? "+" : "-"}{Number(item.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })} {item.symbol}
                </p>
                <p className="text-xs text-muted-foreground">
                  @${Number(item.unit_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  {item.fees > 0 && ` · fee $${Number(item.fees).toFixed(2)}`}
                </p>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${getStatusColor(item.status)}`}>
                {getStatusIcon(item.status)}
                <span className="text-xs font-medium capitalize">{item.status}</span>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    // Withdrawal / Deposit
    const typeLabel = item.type === "WITHDRAWAL" ? "Withdrawal"
      : item.type === "DEPOSIT" ? "Deposit"
      : item.type;
    const isDeposit = item.type === "DEPOSIT";

    return (
      <motion.div
        key={`tx-${item.id}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.03, 0.3) }}
        className="bg-card rounded-lg border border-border/50 p-4 hover:border-primary/30 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-secondary/50">
              {isDeposit
                ? <ArrowDownLeft className="w-5 h-5 text-primary" />
                : <ArrowUpRight className="w-5 h-5 text-yellow-400" />}
            </div>
            <div>
              <p className="font-semibold text-foreground">{typeLabel}</p>
              <p className="text-xs text-muted-foreground">
                {format(item._date, "MMM d, yyyy • h:mm a")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={`font-semibold ${isDeposit ? "text-primary" : "text-foreground"}`}>
                {isDeposit ? "+" : ""}{item.total_amount != null
                  ? `$${Number(item.total_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : "-"}
              </p>
              {item.payment_method && (
                <p className="text-xs text-muted-foreground capitalize">
                  {METHOD_LABELS[item.payment_method] || item.payment_method}
                </p>
              )}
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${getStatusColor(item.status)}`}>
              {getStatusIcon(item.status)}
              <span className="text-xs font-medium capitalize">{item.status}</span>
            </div>
          </div>
        </div>
        {item.notes && (
          <div className="mt-3 pl-14 text-xs text-muted-foreground italic">{item.notes}</div>
        )}
        {item.admin_message && (
          <div className="mt-3 pl-14 flex items-start gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-primary mb-0.5">Message from our team</p>
              <p className="text-xs text-foreground">{item.admin_message}</p>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const hasActiveFilters = typeFilter !== "all" || dateRange !== "all" || searchSymbol.trim();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Transactions</h1>
            <p className="text-muted-foreground text-sm">All trades, deposits, and withdrawals</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setDepositDialog(true)}
              variant="outline"
              className="border-primary/40 text-primary hover:bg-primary/5"
              disabled={!portfolioId}
            >
              Add Funds
            </Button>
            <Button
              onClick={() => navigate("/withdrawal")}
              className="bg-primary hover:bg-primary/90"
              disabled={!portfolioId}
            >
              <Send className="w-4 h-4 mr-2" />
              Withdraw
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 bg-card rounded-xl border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={() => { setTypeFilter("all"); setDateRange("all"); setSearchSymbol(""); }}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Symbol search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by coin (BTC, ETH…)"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                className="pl-8 bg-secondary/50 border-border/50 h-9 text-sm"
              />
            </div>

            {/* Type filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-secondary/50 border-border/50 h-9 text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range */}
            <div className="flex gap-1">
              {DATE_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDateRange(r.value)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    dateRange === r.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{filtered.length}</span> result{filtered.length !== 1 ? "s" : ""}
            {allActivity.length !== filtered.length && (
              <span>of {allActivity.length} total</span>
            )}
          </div>
        </div>

        {/* Activity list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {allActivity.length === 0
                ? "No activity yet. Start trading to see your history here."
                : "No results match your filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, index) => renderActivity(item, index))}
          </div>
        )}

        <DepositDialog open={depositDialog} onClose={() => setDepositDialog(false)} />
      </div>
    </div>
  );
}
