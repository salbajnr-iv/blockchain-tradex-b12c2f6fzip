import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Search, ChevronRight, X,
  ArrowUpRight, ArrowDownLeft, Loader2, CheckCircle2,
  BarChart3, Shield, Percent, Flame, Clock, Layers, Gem, Palette,
  Info, AlertCircle, Wallet, RefreshCw, Star, SlidersHorizontal,
  ChevronDown, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import {
  INVESTMENT_CATEGORIES,
  getCategoryById,
  getInstrumentById,
} from "@/lib/investmentCatalog";
import {
  getInvestmentCatalog,
  getUserInvestmentTransactions,
  createInvestmentTransaction,
  deriveInvestmentPositions,
} from "@/lib/api/investments";

// ─── Icon map ────────────────────────────────────────────────────────────────
const ICON_MAP = {
  TrendingUp, BarChart3, Shield, Percent, Flame, Clock, Layers, Gem, Palette,
};

const fmtUsd = (n) => {
  if (n == null || isNaN(n)) return "$0.00";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1000) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
};

const fmtPrice = (n) => {
  if (!n) return "$0.00";
  if (n >= 100)  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
};

// ─── Category chip bar ───────────────────────────────────────────────────────
function CategoryBar({ selected, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => onChange("all")}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
          selected === "all"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30"
        }`}
      >
        All
      </button>
      {INVESTMENT_CATEGORIES.map((cat) => {
        const Icon = ICON_MAP[cat.icon] ?? TrendingUp;
        const active = selected === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              active
                ? `${cat.bg} ${cat.text} ${cat.border}`
                : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            <Icon className="w-3 h-3" />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Instrument card ─────────────────────────────────────────────────────────
function InstrumentCard({ instrument, position, onClick }) {
  const cat = getCategoryById(instrument.category);
  const up = instrument.changePct24h >= 0;
  const hasPosition = position && position.units > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 hover:shadow-lg transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl ${cat?.bg || "bg-secondary/40"} flex items-center justify-center shrink-0 text-base font-bold`}>
          {instrument.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate leading-tight">{instrument.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">{instrument.symbol}</span>
                {cat && <span className={`text-[10px] font-semibold ${cat.text}`}>{cat.label}</span>}
                {hasPosition && <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Held</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-foreground tabular-nums">{fmtPrice(instrument.price)}</p>
              <p className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${up ? "text-emerald-500" : "text-red-500"}`}>
                {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {up ? "+" : ""}{instrument.changePct24h?.toFixed(2)}%
              </p>
            </div>
          </div>

          {hasPosition && (
            <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Your position</span>
              <span className="font-semibold text-foreground">
                {position.units < 1 ? position.units.toFixed(6) : position.units.toFixed(4)} units
                <span className="text-muted-foreground ml-1">
                  ≈ {fmtUsd(position.units * instrument.price)}
                </span>
              </span>
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUY FLOW
// ─────────────────────────────────────────────────────────────────────────────
function BuyFlow({ instrument, cashBalance, portfolioId, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [amountStr, setAmountStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cat = getCategoryById(instrument.category);
  const amount = parseFloat(amountStr) || 0;
  const fee = amount * 0.005;
  const totalCost = amount + fee;
  const units = instrument.price > 0 ? amount / instrument.price : 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await createInvestmentTransaction(portfolioId, {
        type: "INVESTMENT_BUY",
        instrument,
        amount: totalCost,
        units,
        pricePerUnit: instrument.price,
      });
      toast.success(`Buy order placed! ${units.toFixed(6)} ${instrument.symbol} pending settlement.`);
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || "Failed to place buy order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Steps */}
      <div className="flex items-center gap-2">
        {["Amount", "Review"].map((label, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
              step === i + 1 ? "bg-primary text-primary-foreground" : step > i + 1 ? "bg-emerald-500/20 text-emerald-500" : "bg-secondary/50 text-muted-foreground"
            }`}>
              {step > i + 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
              {label}
            </div>
            {i < 1 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            {/* Instrument display */}
            <div className={`flex items-center gap-3 p-3 ${cat?.bg || "bg-secondary/40"} rounded-xl`}>
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg font-bold">{instrument.icon}</div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${cat?.text || "text-foreground"}`}>{instrument.name}</p>
                <p className="text-xs text-muted-foreground">{instrument.symbol} · {cat?.label}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">{fmtPrice(instrument.price)}</p>
                <p className={`text-xs font-semibold ${instrument.changePct24h >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {instrument.changePct24h >= 0 ? "+" : ""}{instrument.changePct24h?.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Amount input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Investment Amount (USD)</label>
                <span className="text-xs text-muted-foreground">
                  Balance: <button className="text-primary font-semibold" onClick={() => setAmountStr(Math.max(0, cashBalance - (cashBalance * 0.005)).toFixed(2))}>{fmtUsd(cashBalance)}</button>
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                <Input
                  type="number" step="any" min="0" placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="bg-secondary/40 border-border pl-7 text-lg font-semibold"
                />
              </div>
              {amount < instrument.minInvestment && amount > 0 && (
                <p className="text-xs text-amber-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />Minimum investment: {fmtUsd(instrument.minInvestment)}
                </p>
              )}
              {amount > cashBalance && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />Insufficient cash balance
                </p>
              )}
            </div>

            {/* Amount presets */}
            <div className="flex gap-2">
              {[100, 500, 1000, 5000].map((v) => (
                <button key={v} onClick={() => setAmountStr(String(v))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    amount === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                  }`}>
                  ${v >= 1000 ? `${v / 1000}K` : v}
                </button>
              ))}
            </div>

            {amount > 0 && (
              <div className="bg-secondary/40 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">You invest</span><span className="font-semibold">{fmtUsd(amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (0.5%)</span><span className="font-semibold">{fmtUsd(fee)}</span></div>
                <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold"><span>Total</span><span>{fmtUsd(totalCost)}</span></div>
                <div className="flex justify-between text-emerald-500 font-semibold"><span>Units received ≈</span><span>{units < 1 ? units.toFixed(8) : units.toFixed(6)} {instrument.symbol}</span></div>
              </div>
            )}

            <Button
              onClick={() => {
                if (amount < instrument.minInvestment) { toast.error(`Minimum investment is ${fmtUsd(instrument.minInvestment)}`); return; }
                if (amount > cashBalance) { toast.error("Insufficient cash balance"); return; }
                if (amount <= 0) { toast.error("Enter an amount"); return; }
                setStep(2);
              }}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Review Order →
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Buy Order Summary</p>
              <div className="flex items-center gap-3 p-3 bg-background rounded-xl border border-border">
                <span className="text-2xl">{instrument.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">{instrument.name}</p>
                  <p className="text-xs text-muted-foreground">{instrument.symbol} · {cat?.label}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Investment</span><span className="font-semibold">{fmtUsd(amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (0.5%)</span><span className="font-semibold">{fmtUsd(fee)}</span></div>
                <div className="flex justify-between border-t border-border/40 pt-2 font-bold"><span>Total deducted</span><span>{fmtUsd(totalCost)}</span></div>
                <div className="flex justify-between font-semibold text-emerald-500"><span>Units received ≈</span><span>{units.toFixed(6)} {instrument.symbol}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Price per unit</span><span className="font-mono">{fmtPrice(instrument.price)}</span></div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-2">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Orders are reviewed and settled within 1 business day. Units will appear in your portfolio upon settlement.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 rounded-xl" disabled={submitting}>← Back</Button>
              <Button onClick={handleSubmit} className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white" disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Placing…</> : "Confirm Buy"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SELL FLOW
// ─────────────────────────────────────────────────────────────────────────────
function SellFlow({ instrument, position, portfolioId, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [unitsStr, setUnitsStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cat = getCategoryById(instrument.category);
  const held = position?.units ?? 0;
  const units = parseFloat(unitsStr) || 0;
  const proceeds = units * instrument.price;
  const fee = proceeds * 0.005;
  const netProceeds = proceeds - fee;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await createInvestmentTransaction(portfolioId, {
        type: "INVESTMENT_SELL",
        instrument,
        amount: proceeds,
        units,
        pricePerUnit: instrument.price,
      });
      toast.success(`Sell order placed! You'll receive ${fmtUsd(netProceeds)} after settlement.`);
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || "Failed to place sell order");
    } finally {
      setSubmitting(false);
    }
  };

  if (held <= 0) {
    return (
      <div className="text-center py-10 space-y-3">
        <Package className="w-12 h-12 text-muted-foreground/30 mx-auto" />
        <p className="text-sm text-muted-foreground">You don't hold any {instrument.symbol}</p>
        <p className="text-xs text-muted-foreground/60">Buy some to start building your position</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {["Units", "Review"].map((label, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
              step === i + 1 ? "bg-red-500 text-white" : step > i + 1 ? "bg-emerald-500/20 text-emerald-500" : "bg-secondary/50 text-muted-foreground"
            }`}>
              {step > i + 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
              {label}
            </div>
            {i < 1 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Your position</p>
                <p className="text-sm font-bold text-foreground">{held < 1 ? held.toFixed(6) : held.toFixed(4)} {instrument.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Current value</p>
                <p className="text-sm font-bold text-foreground">{fmtUsd(held * instrument.price)}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Units to Sell</label>
                <button className="text-xs text-primary font-semibold" onClick={() => setUnitsStr(held.toString())}>
                  Sell all ({held < 1 ? held.toFixed(6) : held.toFixed(4)})
                </button>
              </div>
              <div className="relative">
                <Input
                  type="number" step="any" min="0" placeholder="0.000000"
                  value={unitsStr}
                  onChange={(e) => setUnitsStr(e.target.value)}
                  className="bg-secondary/40 border-border pr-20 text-lg font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">{instrument.symbol}</span>
              </div>
              {units > held && <p className="text-xs text-destructive flex items-center gap-1"><Info className="w-3.5 h-3.5" />Exceeds your position</p>}
            </div>

            {units > 0 && (
              <div className="bg-secondary/40 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Gross proceeds</span><span className="font-semibold">{fmtUsd(proceeds)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (0.5%)</span><span className="font-semibold text-destructive">-{fmtUsd(fee)}</span></div>
                <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold text-emerald-500"><span>Net proceeds</span><span>{fmtUsd(netProceeds)}</span></div>
              </div>
            )}

            <Button
              onClick={() => {
                if (units <= 0) { toast.error("Enter units to sell"); return; }
                if (units > held) { toast.error("Exceeds your position"); return; }
                setStep(2);
              }}
              className="w-full rounded-xl bg-red-500 hover:bg-red-600 text-white"
            >
              Review Order →
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sell Order Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">You sell</span><span className="font-semibold">{units < 1 ? units.toFixed(6) : units.toFixed(4)} {instrument.symbol}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Price per unit</span><span className="font-mono">{fmtPrice(instrument.price)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gross proceeds</span><span className="font-semibold">{fmtUsd(proceeds)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (0.5%)</span><span className="font-semibold text-destructive">-{fmtUsd(fee)}</span></div>
                <div className="flex justify-between border-t border-border/40 pt-2 font-bold text-emerald-500"><span>Net proceeds</span><span>{fmtUsd(netProceeds)}</span></div>
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">Proceeds will be added to your cash balance upon settlement (1 business day).</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 rounded-xl" disabled={submitting}>← Back</Button>
              <Button onClick={handleSubmit} className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white" disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Placing…</> : "Confirm Sell"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUMENT DETAIL SHEET
// ─────────────────────────────────────────────────────────────────────────────
function InstrumentSheet({ instrument, position, cashBalance, portfolioId, onClose, onSuccess }) {
  const [tab, setTab] = useState("buy");
  const cat = getCategoryById(instrument.category);
  const up = instrument.changePct24h >= 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="bg-card border border-border w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${cat?.bg || "bg-secondary/40"} flex items-center justify-center text-base font-bold`}>
              {instrument.icon}
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{instrument.name}</h2>
              <p className={`text-xs font-semibold ${cat?.text || "text-muted-foreground"}`}>{instrument.symbol} · {cat?.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">{fmtPrice(instrument.price)}</p>
              <p className={`text-xs font-semibold ${up ? "text-emerald-500" : "text-red-500"}`}>
                {up ? "+" : ""}{instrument.changePct24h?.toFixed(2)}%
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Info cards */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {instrument.marketCap && instrument.marketCap !== "—" && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Market Cap</p>
                <p className="font-bold text-foreground">{instrument.marketCap}</p>
              </div>
            )}
            {instrument.volume24h && instrument.volume24h !== "—" && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">24h Volume</p>
                <p className="font-bold text-foreground">{instrument.volume24h}</p>
              </div>
            )}
            {instrument.yield && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Yield</p>
                <p className="font-bold text-emerald-500">{instrument.yield}</p>
              </div>
            )}
            {instrument.maturity && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Maturity</p>
                <p className="font-bold text-foreground">{instrument.maturity}</p>
              </div>
            )}
            {instrument.rating && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Credit Rating</p>
                <p className="font-bold text-foreground">{instrument.rating}</p>
              </div>
            )}
            {instrument.exchange && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Exchange</p>
                <p className="font-bold text-foreground">{instrument.exchange}</p>
              </div>
            )}
            {instrument.optionType && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Option Type</p>
                <p className="font-bold text-foreground">{instrument.optionType}</p>
              </div>
            )}
            {instrument.strike && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Strike</p>
                <p className="font-bold text-foreground">{instrument.strike}</p>
              </div>
            )}
            {instrument.expiry && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Expiry</p>
                <p className="font-bold text-foreground">{instrument.expiry}</p>
              </div>
            )}
            {instrument.expiryDate && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Contract Expiry</p>
                <p className="font-bold text-foreground">{instrument.expiryDate}</p>
              </div>
            )}
            {instrument.contractSize && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Contract Size</p>
                <p className="font-bold text-foreground">{instrument.contractSize}</p>
              </div>
            )}
            {instrument.floorPrice && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Floor Price</p>
                <p className="font-bold text-foreground">{instrument.floorPrice}</p>
              </div>
            )}
            {instrument.supply && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Collection Size</p>
                <p className="font-bold text-foreground">{instrument.supply}</p>
              </div>
            )}
            <div className="bg-secondary/30 rounded-xl p-3">
              <p className="text-muted-foreground mb-0.5">Min. Investment</p>
              <p className="font-bold text-foreground">{fmtUsd(instrument.minInvestment)}</p>
            </div>
          </div>

          {/* Description */}
          {instrument.description && (
            <div className="bg-secondary/20 rounded-xl p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{instrument.description}</p>
            </div>
          )}

          {/* Position card */}
          {position && position.units > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Your position</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{position.units < 1 ? position.units.toFixed(6) : position.units.toFixed(4)} {instrument.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Current value</p>
                <p className="text-sm font-bold text-foreground">{fmtUsd(position.units * instrument.price)}</p>
              </div>
            </div>
          )}

          {/* Buy / Sell tabs */}
          <div className="flex border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setTab("buy")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                tab === "buy" ? "bg-emerald-500 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setTab("sell")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
                tab === "sell" ? "bg-red-500 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sell
            </button>
          </div>

          {tab === "buy" ? (
            <BuyFlow
              instrument={instrument}
              cashBalance={cashBalance}
              portfolioId={portfolioId}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          ) : (
            <SellFlow
              instrument={instrument}
              position={position}
              portfolioId={portfolioId}
              onClose={onClose}
              onSuccess={onSuccess}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: "default",    label: "Default" },
  { key: "name",       label: "Name" },
  { key: "price_asc",  label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
  { key: "change",     label: "24h Change" },
  { key: "held",       label: "Held First" },
];

export default function Investments() {
  const { user } = useAuth();
  const { cashBalance, portfolioId } = usePortfolio();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selected, setSelected] = useState(null);

  // Fetch catalog (static + admin overrides)
  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ["investment_catalog"],
    queryFn: getInvestmentCatalog,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user positions
  const { data: txns = [] } = useQuery({
    queryKey: ["investment_transactions", portfolioId],
    queryFn: () => getUserInvestmentTransactions(portfolioId),
    enabled: !!portfolioId,
    staleTime: 60 * 1000,
  });

  const positions = useMemo(() => deriveInvestmentPositions(txns), [txns]);

  // Stats
  const totalInvested = useMemo(() => {
    return catalog
      .filter((i) => positions[i.symbol])
      .reduce((sum, i) => sum + (positions[i.symbol].units * i.price), 0);
  }, [catalog, positions]);

  // Filter + sort
  const displayed = useMemo(() => {
    let list = catalog.filter((i) => i.enabled !== false);

    if (category !== "all") list = list.filter((i) => i.category === category);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(q) || i.symbol.toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      if (sort === "name")       return a.name.localeCompare(b.name);
      if (sort === "price_asc")  return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      if (sort === "change")     return (b.changePct24h ?? 0) - (a.changePct24h ?? 0);
      if (sort === "held") {
        const aHeld = positions[a.symbol]?.units > 0 ? 1 : 0;
        const bHeld = positions[b.symbol]?.units > 0 ? 1 : 0;
        return bHeld - aHeld;
      }
      return 0;
    });

    return list;
  }, [catalog, category, search, sort, positions]);

  const handleSuccess = useCallback(() => {
    setSelected(null);
    queryClient.invalidateQueries(["investment_transactions", portfolioId]);
  }, [portfolioId, queryClient]);

  const selectedPosition = selected ? positions[selected.symbol] : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Investments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Diversify your portfolio across stocks, ETFs, bonds, commodities, metals, NFTs and more.
        </p>
      </motion.div>

      {/* Summary bar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Cash Available", value: fmtUsd(cashBalance), sub: "Ready to invest", color: "text-emerald-500" },
          { label: "Invested Value", value: fmtUsd(totalInvested), sub: `${Object.keys(positions).length} positions`, color: "text-blue-500" },
          { label: "Total Instruments", value: displayed.length.toString(), sub: category === "all" ? "All categories" : getCategoryById(category)?.label, color: "text-violet-500" },
          { label: "Categories", value: "9", sub: "Investment types", color: "text-amber-500" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Category tabs */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <CategoryBar selected={category} onChange={setCategory} />
      </motion.div>

      {/* Category description */}
      {category !== "all" && (
        <motion.div
          key={category}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${getCategoryById(category)?.bg} rounded-xl px-4 py-2.5 flex items-center gap-2`}
        >
          {(() => {
            const cat = getCategoryById(category);
            const Icon = ICON_MAP[cat?.icon] ?? TrendingUp;
            return <Icon className={`w-4 h-4 ${cat?.text}`} />;
          })()}
          <p className="text-xs text-muted-foreground">{getCategoryById(category)?.description}</p>
        </motion.div>
      )}

      {/* Search + sort */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instruments..."
            className="w-full bg-secondary/50 border border-border rounded-xl py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/40 transition-colors text-foreground placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-2 px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{SORT_OPTIONS.find((o) => o.key === sort)?.label}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-2xl z-50 min-w-[140px] overflow-hidden">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setSort(opt.key); setShowSortMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    sort === opt.key ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Instrument list */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary/40 animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading instruments…</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Search className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No instruments found</p>
          {search && <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline">Clear search</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayed.map((inst) => (
            <InstrumentCard
              key={inst.id}
              instrument={inst}
              position={positions[inst.symbol]}
              onClick={() => setSelected(inst)}
            />
          ))}
        </div>
      )}

      {/* Instrument detail sheet */}
      <AnimatePresence>
        {selected && (
          <InstrumentSheet
            instrument={selected}
            position={selectedPosition}
            cashBalance={cashBalance}
            portfolioId={portfolioId}
            onClose={() => setSelected(null)}
            onSuccess={handleSuccess}
          />
        )}
      </AnimatePresence>

      {/* Disclaimer */}
      <p className="text-[11px] text-muted-foreground/60 text-center pb-4">
        Prices are indicative and may differ from live market rates. All investments carry risk.
        Past performance does not guarantee future results. BlockTrade does not provide investment advice.
      </p>
    </div>
  );
}
