import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useLivePrices } from "@/hooks/useLivePrices";
import {
  listRecurringOrders,
  createRecurringOrder,
  setRecurringOrderStatus,
} from "@/lib/api/recurringOrders";
import {
  RefreshCw, Plus, Pause, Play, X, ChevronDown, TrendingUp,
  Clock, DollarSign, Loader2, CalendarDays, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from '@/lib/toast';
import { format, parseISO } from "date-fns";

const FREQ_LABELS = {
  daily:    "Every Day",
  weekly:   "Every Week",
  biweekly: "Every 2 Weeks",
  monthly:  "Every Month",
};

const DOW_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUS_STYLES = {
  active:  "bg-primary/10 text-primary",
  paused:  "bg-yellow-400/10 text-yellow-400",
  cancelled: "bg-destructive/10 text-destructive",
};

function CoinOption({ coin, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(coin)}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors text-left"
    >
      <span className="text-xl">{coin.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{coin.symbol}</p>
        <p className="text-xs text-muted-foreground truncate">{coin.name}</p>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        ${coin.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
    </button>
  );
}

function CreateOrderForm({ portfolioId, cryptoList, cashBalance, onCreated }) {
  const [open, setOpen] = useState(false);
  const [coinSearch, setCoinSearch] = useState("");
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [showCoinDropdown, setShowCoinDropdown] = useState(false);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [loading, setLoading] = useState(false);

  const filteredCoins = useMemo(() => {
    if (!coinSearch.trim()) return cryptoList.slice(0, 20);
    const q = coinSearch.toLowerCase();
    return cryptoList.filter(
      (c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [cryptoList, coinSearch]);

  const handleSelectCoin = (coin) => {
    setSelectedCoin(coin);
    setCoinSearch(`${coin.symbol} — ${coin.name}`);
    setShowCoinDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCoin) { toast.error("Select a coin"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > cashBalance) { toast.error(`Insufficient cash (balance: $${cashBalance.toFixed(2)})`); return; }
    if (amt < 1) { toast.error("Minimum $1 per DCA order"); return; }

    setLoading(true);
    try {
      await createRecurringOrder(portfolioId, {
        symbol:    selectedCoin.symbol,
        name:      selectedCoin.name,
        amountUsd: amt,
        frequency,
        dayOfWeek: ["weekly", "biweekly"].includes(frequency) ? parseInt(dayOfWeek, 10) : null,
      });
      toast.success("DCA schedule created!", {
        description: `Will buy $${amt} of ${selectedCoin.symbol} ${FREQ_LABELS[frequency].toLowerCase()}`,
      });
      onCreated();
      setOpen(false);
      setSelectedCoin(null);
      setCoinSearch("");
      setAmount("");
      setFrequency("weekly");
    } catch (err) {
      toast.error(err.message || "Failed to create schedule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!open ? (
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New DCA Schedule
        </Button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/50 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">New DCA Schedule</h2>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Coin selector */}
            <div className="relative">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Asset</label>
              <input
                type="text"
                placeholder="Search Bitcoin, Ethereum..."
                value={coinSearch}
                onChange={(e) => { setCoinSearch(e.target.value); setShowCoinDropdown(true); setSelectedCoin(null); }}
                onFocus={() => setShowCoinDropdown(true)}
                className="w-full bg-secondary/50 border border-border/50 rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
              <AnimatePresence>
                {showCoinDropdown && filteredCoins.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-card border border-border/50 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto"
                  >
                    {filteredCoins.map((coin) => (
                      <CoinOption key={coin.symbol} coin={coin} onSelect={handleSelectCoin} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Amount (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
              {cashBalance > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Available cash: <span className="text-foreground font-medium">${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </p>
              )}
              {selectedCoin && amount && parseFloat(amount) > 0 && (
                <p className="text-xs text-primary mt-1">
                  ≈ {(parseFloat(amount) / (selectedCoin.price || 1)).toFixed(6)} {selectedCoin.symbol} at current price
                </p>
              )}
            </div>

            {/* Frequency */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequency</label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Every Day</SelectItem>
                  <SelectItem value="weekly">Every Week</SelectItem>
                  <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                  <SelectItem value="monthly">Every Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Day of week (for weekly/biweekly) */}
            <AnimatePresence>
              {["weekly", "biweekly"].includes(frequency) && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Day of Week</label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOW_LABELS.map((day, i) => (
                        <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1 gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {loading ? "Creating…" : "Create Schedule"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
}

function RecurringOrderCard({ order, onStatusChange }) {
  const [loading, setLoading] = useState(false);

  const nextDate = order.next_execution_at
    ? format(parseISO(order.next_execution_at), "MMM d, yyyy 'at' h:mm a")
    : "—";

  const handleToggle = async () => {
    setLoading(true);
    const newStatus = order.status === "active" ? "paused" : "active";
    try {
      await setRecurringOrderStatus(order.id, newStatus);
      toast.success(newStatus === "active" ? "DCA resumed" : "DCA paused");
      onStatusChange();
    } catch (err) {
      toast.error(err.message || "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this DCA schedule? This cannot be undone.")) return;
    setLoading(true);
    try {
      await setRecurringOrderStatus(order.id, "cancelled");
      toast.success("DCA schedule cancelled");
      onStatusChange();
    } catch (err) {
      toast.error(err.message || "Failed to cancel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/50 rounded-xl p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-foreground">{order.symbol}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLES[order.status] || ""}`}>
                {order.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{order.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {order.status !== "cancelled" && (
            <button
              onClick={handleToggle}
              disabled={loading}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
              title={order.status === "active" ? "Pause" : "Resume"}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : order.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}
          {order.status !== "cancelled" && (
            <button
              onClick={handleCancel}
              disabled={loading}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Amount", value: `$${order.amount_usd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: "Frequency", value: FREQ_LABELS[order.frequency] || order.frequency },
          { label: "Total Bought", value: order.total_executed > 0 ? `${order.total_executed}×` : "Not yet" },
          { label: "Total Spent", value: order.total_spent > 0 ? `$${order.total_spent.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "$0" },
        ].map((item) => (
          <div key={item.label} className="bg-secondary/30 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{item.label}</p>
            <p className="text-sm font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      {order.status === "active" && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>Next execution: <span className="text-foreground">{nextDate}</span></span>
        </div>
      )}
    </motion.div>
  );
}

export default function Recurring() {
  const { portfolioId, cashBalance } = usePortfolio();
  const { cryptoList } = useLivePrices();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ["recurring-orders", portfolioId],
    queryFn: () => listRecurringOrders(portfolioId),
    enabled: !!portfolioId,
    initialData: [],
  });

  const handleRefetch = () => {
    queryClient.invalidateQueries({ queryKey: ["recurring-orders", portfolioId] });
  };

  const activeOrders = orders.filter((o) => o.status === "active");
  const pausedOrders = orders.filter((o) => o.status === "paused");

  const totalMonthlyDca = useMemo(() => {
    return activeOrders.reduce((sum, o) => {
      if (o.frequency === "daily")    return sum + o.amount_usd * 30;
      if (o.frequency === "weekly")   return sum + o.amount_usd * 4.3;
      if (o.frequency === "biweekly") return sum + o.amount_usd * 2.15;
      if (o.frequency === "monthly")  return sum + o.amount_usd;
      return sum;
    }, 0);
  }, [activeOrders]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Recurring / DCA</h1>
            <p className="text-muted-foreground mt-1">
              Dollar-cost average into crypto automatically on a schedule
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            DCA orders execute automatically when the app is open and prices are available. Keep the app open at your scheduled time, or they'll run on your next visit.
          </p>
        </div>

        {/* Summary stats */}
        {orders.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Active Schedules",  value: activeOrders.length },
              { label: "Paused Schedules",  value: pausedOrders.length },
              { label: "Est. Monthly DCA",  value: `$${totalMonthlyDca.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border/50 rounded-xl p-5">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Create form */}
        <CreateOrderForm
          portfolioId={portfolioId}
          cryptoList={cryptoList}
          cashBalance={cashBalance}
          onCreated={handleRefetch}
        />

        {/* Order list */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/50 rounded-xl">
            <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium">No DCA schedules yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first recurring buy above to start dollar-cost averaging.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Your Schedules ({orders.length})
            </h2>
            {orders.map((order) => (
              <RecurringOrderCard key={order.id} order={order} onStatusChange={handleRefetch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
