import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from '@/lib/toast';
import {
  TrendingUp, TrendingDown, Search, ChevronRight, X,
  ArrowUpRight, ArrowDownLeft, Loader2, CheckCircle2,
  BarChart3, Shield, Percent, Flame, Clock, Layers, Gem, Palette,
  Info, AlertCircle, Wallet, RefreshCw, Star, SlidersHorizontal,
  ChevronDown, Package, Building2, Briefcase, Sparkles,
  Globe, DollarSign, Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import {
  INVESTMENT_CATEGORIES,
  REGIONS,
  getCategoryById,
  getInstrumentById,
  getRegionById,
  getCategoryIcon,
} from "@/lib/investmentCatalog";
import {
  getInvestmentCatalog,
  getUserInvestmentTransactions,
  createInvestmentTransaction,
  deriveInvestmentPositions,
} from "@/lib/api/investments";
import {
  CURRENCIES,
  POPULAR_CURRENCIES,
  getCurrencyMeta,
  formatPrice,
  formatAmount,
  getStoredCurrency,
  setStoredCurrency,
  convertFromUSD,
} from "@/lib/exchangeRates";


// ─── Format helpers (USD-based, then optionally converted) ───────────────────
const fmtUsd = (n) => {
  if (n == null || isNaN(n)) return "$0.00";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1000) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
};

// ─── Currency Selector ───────────────────────────────────────────────────────
function CurrencySelector({ currency, onChange }) {
  const [open, setOpen] = useState(false);
  const meta = getCurrencyMeta(currency);
  const popular = CURRENCIES.filter((c) => POPULAR_CURRENCIES.includes(c.code));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-2 bg-secondary/50 border border-border rounded-xl text-sm font-semibold text-foreground hover:border-primary/40 transition-all"
      >
        <span className="text-base leading-none">{meta.flag}</span>
        <span className="text-xs">{currency}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-2 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden min-w-[200px]"
            >
              <div className="px-3 pt-3 pb-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Display Currency</p>
                <div className="grid grid-cols-2 gap-1">
                  {popular.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => { onChange(c.code); setOpen(false); }}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                        currency === c.code
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-secondary/60 text-foreground"
                      }`}
                    >
                      <span className="text-sm">{c.flag}</span>
                      <span>{c.code}</span>
                    </button>
                  ))}
                </div>
              </div>
              {currency !== "USD" && (
                <div className="px-3 pb-3">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5 mt-1">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">
                      Prices shown in {getCurrencyMeta(currency).name}. All transactions execute in USD.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Region filter bar ───────────────────────────────────────────────────────
function RegionBar({ selected, onChange }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {REGIONS.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
            selected === r.id
              ? "bg-foreground text-background border-foreground"
              : "bg-secondary/40 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
          }`}
        >
          <span className="text-xs">{r.flag}</span>
          <span>{r.label}</span>
        </button>
      ))}
    </div>
  );
}

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
        const Icon = getCategoryIcon(cat.icon);
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

// ─── Stock / ETF logo domain map (for Clearbit CDN) ─────────────────────────
const STOCK_LOGO_DOMAINS = {
  // US stocks
  AAPL:  "apple.com",    MSFT:  "microsoft.com",  TSLA:  "tesla.com",
  GOOGL: "google.com",   AMZN:  "amazon.com",     NVDA:  "nvidia.com",
  META:  "meta.com",     "BRK-B": "berkshirehathaway.com", NFLX: "netflix.com",
  JPM:   "jpmorganchase.com",
  // UK stocks
  HSBA: "hsbc.com",      SHEL: "shell.com",   BP:  "bp.com",
  AZN:  "astrazeneca.com", UL: "unilever.com",
  // European stocks
  ASML:  "asml.com",     SAP:   "sap.com",    LVMUY: "lvmh.com",
  SIEGY: "siemens.com",  NSRGY: "nestle.com", TTE:   "totalenergies.com",
  // Japanese stocks
  TM:   "toyota.com",    SONY:  "sony.com",   HMC:   "honda.com",
  SFTBY: "softbank.com",
  // Chinese / HK stocks
  BABA: "alibaba.com",   TCEHY: "tencent.com",  JD: "jd.com",
  PDD:  "pinduoduo.com",
  // Indian stocks
  INFY: "infosys.com",   HDB: "hdfcbank.com",   WIT: "wipro.com",
  // Canadian stocks
  SHOP: "shopify.com",   RY: "rbc.com",          BNS: "scotiabank.com",
  // Australian stocks
  BHP:  "bhp.com",       RIO: "riotinto.com",
  // Korean stocks
  SSNLF: "samsung.com",
  // Singapore stocks
  SE:    "sea.com",      DBSGY: "dbs.com",
  // Brazilian stocks
  VALE:  "vale.com",
};

function InstrumentLogo({ instrument }) {
  const [imgError, setImgError] = useState(false);
  const cat = getCategoryById(instrument.category);
  const domain = STOCK_LOGO_DOMAINS[instrument.symbol];

  if (domain && !imgError) {
    return (
      <div className={`w-11 h-11 rounded-xl ${cat?.bg || "bg-secondary/40"} flex items-center justify-center shrink-0 overflow-hidden p-1.5`}>
        <img
          src={`https://logo.clearbit.com/${domain}`}
          alt={instrument.name}
          className="w-full h-full object-contain rounded-md"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`w-11 h-11 rounded-xl ${cat?.bg || "bg-secondary/40"} flex items-center justify-center shrink-0 text-base font-bold`}>
      {instrument.icon}
    </div>
  );
}

function InstrumentCard({ instrument, position, currency, onClick }) {
  const cat = getCategoryById(instrument.category);
  const region = getRegionById(instrument.region ?? "US");
  const up = instrument.changePct24h >= 0;
  const hasPosition = position && position.units > 0;
  const isFractional = instrument.minInvestment <= 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      className="bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/30 hover:shadow-lg transition-all group"
    >
      <div className="flex items-start gap-3">
        <InstrumentLogo instrument={instrument} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate leading-tight">{instrument.name}</p>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                <span className="text-[10px] font-bold text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">{instrument.symbol}</span>
                {cat && <span className={`text-[10px] font-semibold ${cat.text}`}>{cat.label}</span>}
                {instrument.region && instrument.region !== "US" && (
                  <span className="text-[10px]">{region.flag}</span>
                )}
                {isFractional && (
                  <span className="text-[10px] font-semibold text-violet-500 bg-violet-500/10 px-1 py-0.5 rounded">Fractional</span>
                )}
                {hasPosition && <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Held</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-foreground tabular-nums">{formatPrice(instrument.price, currency)}</p>
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
                  ≈ {formatAmount(position.units * instrument.price, currency)}
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
function BuyFlow({ instrument, cashBalance, portfolioId, currency, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [amountStr, setAmountStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cat = getCategoryById(instrument.category);
  const amount = parseFloat(amountStr) || 0;
  const fee = amount * 0.005;
  const totalCost = amount + fee;
  const units = instrument.price > 0 ? amount / instrument.price : 0;
  const currMeta = getCurrencyMeta(currency);
  const showConversion = currency !== "USD";

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
                <p className="text-sm font-bold text-foreground">{formatPrice(instrument.price, currency)}</p>
                {showConversion && (
                  <p className="text-[10px] text-muted-foreground">${instrument.price.toFixed(2)} USD</p>
                )}
                <p className={`text-xs font-semibold ${instrument.changePct24h >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {instrument.changePct24h >= 0 ? "+" : ""}{instrument.changePct24h?.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Fractional investing note */}
            {instrument.minInvestment <= 10 && (
              <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-2.5 flex items-center gap-2">
                <Scissors className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <p className="text-[11px] text-violet-700 dark:text-violet-400 font-medium">
                  Fractional investing — start with as little as {fmtUsd(instrument.minInvestment)} and own a fraction of this asset.
                </p>
              </div>
            )}

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
              {showConversion && amount > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  ≈ {formatAmount(amount, currency)} {currency}
                </p>
              )}
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
                {units < 1 && (
                  <div className="flex items-center gap-1 text-violet-500">
                    <Scissors className="w-3 h-3" />
                    <span className="text-[10px]">You're buying a fractional share — {(units * 100).toFixed(4)}% of one unit</span>
                  </div>
                )}
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
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Price per unit</span><span className="font-mono">{formatPrice(instrument.price, currency)}</span></div>
                {showConversion && (
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Total in {currency}</span><span>{formatAmount(totalCost, currency)}</span></div>
                )}
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
function SellFlow({ instrument, position, portfolioId, currency, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [unitsStr, setUnitsStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cat = getCategoryById(instrument.category);
  const held = position?.units ?? 0;
  const units = parseFloat(unitsStr) || 0;
  const proceeds = units * instrument.price;
  const fee = proceeds * 0.005;
  const netProceeds = proceeds - fee;
  const showConversion = currency !== "USD";

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
                {held < 1 && <p className="text-[10px] text-violet-500 mt-0.5">Fractional holding</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Current value</p>
                <p className="text-sm font-bold text-foreground">{formatAmount(held * instrument.price, currency)}</p>
                {showConversion && <p className="text-[10px] text-muted-foreground">{fmtUsd(held * instrument.price)}</p>}
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
                {showConversion && (
                  <div className="flex justify-between text-muted-foreground"><span>≈ in {currency}</span><span>{formatAmount(netProceeds, currency)}</span></div>
                )}
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
                <div className="flex justify-between"><span className="text-muted-foreground">Price per unit</span><span className="font-mono">{formatPrice(instrument.price, currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gross proceeds</span><span className="font-semibold">{fmtUsd(proceeds)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (0.5%)</span><span className="font-semibold text-destructive">-{fmtUsd(fee)}</span></div>
                <div className="flex justify-between border-t border-border/40 pt-2 font-bold text-emerald-500"><span>Net proceeds</span><span>{fmtUsd(netProceeds)}</span></div>
                {showConversion && <div className="flex justify-between text-xs text-muted-foreground"><span>≈ in {currency}</span><span>{formatAmount(netProceeds, currency)}</span></div>}
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
function InstrumentSheet({ instrument, position, cashBalance, portfolioId, currency, onClose, onSuccess }) {
  const [tab, setTab] = useState("buy");
  const cat = getCategoryById(instrument.category);
  const region = getRegionById(instrument.region ?? "US");
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
              <div className="flex items-center gap-1.5">
                <p className={`text-xs font-semibold ${cat?.text || "text-muted-foreground"}`}>{instrument.symbol} · {cat?.label}</p>
                {instrument.region && instrument.region !== "US" && (
                  <span className="text-sm">{region.flag}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">{formatPrice(instrument.price, currency)}</p>
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
                <p className="text-muted-foreground mb-0.5">Yield / Income</p>
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
            {instrument.region && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Region</p>
                <p className="font-bold text-foreground flex items-center gap-1">
                  <span>{region.flag}</span> {region.label}
                </p>
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
            {instrument.unit && (
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-muted-foreground mb-0.5">Unit</p>
                <p className="font-bold text-foreground">{instrument.unit}</p>
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

          {/* Fractional investing highlight */}
          {instrument.minInvestment <= 10 && (
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-violet-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">Fractional Investing Available</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Start with as little as {fmtUsd(instrument.minInvestment)}. You don't need to buy a whole unit — own exactly as much as you want.</p>
              </div>
            </div>
          )}

          {/* Position card */}
          {position && position.units > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Your position</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{position.units < 1 ? position.units.toFixed(6) : position.units.toFixed(4)} {instrument.symbol}</p>
                {position.units < 1 && <p className="text-[10px] text-violet-500">Fractional holding</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Current value</p>
                <p className="text-sm font-bold text-foreground">{formatAmount(position.units * instrument.price, currency)}</p>
                {currency !== "USD" && <p className="text-[10px] text-muted-foreground">{fmtUsd(position.units * instrument.price)}</p>}
              </div>
            </div>
          )}

          {/* Buy / Sell tabs */}
          <div className="flex border border-border rounded-xl overflow-hidden">
            <button onClick={() => setTab("buy")} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === "buy" ? "bg-emerald-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>Buy</button>
            <button onClick={() => setTab("sell")} className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === "sell" ? "bg-red-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>Sell</button>
          </div>

          {tab === "buy" ? (
            <BuyFlow instrument={instrument} cashBalance={cashBalance} portfolioId={portfolioId} currency={currency} onClose={onClose} onSuccess={onSuccess} />
          ) : (
            <SellFlow instrument={instrument} position={position} portfolioId={portfolioId} currency={currency} onClose={onClose} onSuccess={onSuccess} />
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
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selected, setSelected] = useState(null);
  const [displayCurrency, setDisplayCurrency] = useState(() => getStoredCurrency());

  // Persist currency preference
  const handleCurrencyChange = useCallback((code) => {
    setDisplayCurrency(code);
    setStoredCurrency(code);
  }, []);

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
    if (region !== "all")   list = list.filter((i) => i.region === region);

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
  }, [catalog, category, region, search, sort, positions]);

  const handleSuccess = useCallback(() => {
    setSelected(null);
    queryClient.invalidateQueries(["investment_transactions", portfolioId]);
  }, [portfolioId, queryClient]);

  const selectedPosition = selected ? positions[selected.symbol] : null;

  const currMeta = getCurrencyMeta(displayCurrency);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Investments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Diversify globally across stocks, ETFs, bonds, REITs, alternatives and more.
          </p>
        </div>
        <CurrencySelector currency={displayCurrency} onChange={handleCurrencyChange} />
      </motion.div>

      {/* Global Expansion Banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="bg-gradient-to-r from-blue-500/10 via-violet-500/10 to-emerald-500/10 border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3"
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-xl shrink-0">🌍</div>
          <div>
            <p className="text-sm font-bold text-foreground">Global Investment Platform</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Access {catalog.filter(i => i.enabled !== false).length}+ instruments across {INVESTMENT_CATEGORIES.length} asset classes and {REGIONS.length - 1} global markets — with prices in {currMeta.name}.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["🇺🇸", "🇬🇧", "🇪🇺", "🇯🇵", "🇨🇳", "🇮🇳", "🇨🇦", "🇦🇺"].map((f, i) => (
            <span key={i} className="text-xl">{f}</span>
          ))}
        </div>
      </motion.div>

      {/* Fractional Investing Banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        {[
          { icon: <Scissors className="w-4 h-4 text-violet-500" />, title: "Fractional Shares", desc: "Start with as little as $1. Own a fraction of any high-value asset.", bg: "bg-violet-500/10 border-violet-500/20" },
          { icon: <Globe className="w-4 h-4 text-blue-500" />,      title: "Multi-Currency",   desc: `View prices in ${currMeta.name} (${currMeta.symbol}). Transactions execute in USD.`, bg: "bg-blue-500/10 border-blue-500/20" },
          { icon: <Sparkles className="w-4 h-4 text-rose-500" />,   title: "Alt Assets",       desc: "Invest in art, farmland, collectibles, and startup equity — previously inaccessible.", bg: "bg-rose-500/10 border-rose-500/20" },
        ].map(({ icon, title, desc, bg }) => (
          <div key={title} className={`border rounded-2xl p-3.5 ${bg} flex items-start gap-3`}>
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div>
              <p className="text-xs font-bold text-foreground">{title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Summary bar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Cash Available", value: fmtUsd(cashBalance), sub: "Ready to invest", color: "text-emerald-500" },
          { label: "Invested Value",  value: formatAmount(totalInvested, displayCurrency), sub: `${Object.keys(positions).length} positions`, color: "text-blue-500" },
          { label: "Instruments",     value: displayed.length.toString(), sub: category === "all" ? "Across all categories" : getCategoryById(category)?.label, color: "text-violet-500" },
          { label: "Asset Classes",   value: INVESTMENT_CATEGORIES.length.toString(), sub: "12 investment types", color: "text-amber-500" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Category tabs */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
        <CategoryBar selected={category} onChange={(c) => { setCategory(c); }} />
      </motion.div>

      {/* Region filter */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}>
        <RegionBar selected={region} onChange={setRegion} />
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
            const Icon = getCategoryIcon(cat?.icon);
            return <Icon className={`w-4 h-4 ${cat?.text}`} />;
          })()}
          <p className="text-xs text-muted-foreground">{getCategoryById(category)?.description}</p>
        </motion.div>
      )}

      {/* Search + sort */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instruments, symbols..."
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

      {/* Currency note when non-USD */}
      {displayCurrency !== "USD" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2"
        >
          <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Prices displayed in <strong>{getCurrencyMeta(displayCurrency).name} ({displayCurrency})</strong>. Transactions are executed in USD at the current exchange rate.
          </p>
          <button onClick={() => handleCurrencyChange("USD")} className="ml-auto text-xs text-blue-500 hover:underline shrink-0">Switch to USD</button>
        </motion.div>
      )}

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
          {(search || region !== "all") && (
            <div className="flex gap-2 justify-center">
              {search && <button onClick={() => setSearch("")} className="text-xs text-primary hover:underline">Clear search</button>}
              {region !== "all" && <button onClick={() => setRegion("all")} className="text-xs text-primary hover:underline">Show all regions</button>}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayed.map((inst) => (
            <InstrumentCard
              key={inst.id}
              instrument={inst}
              position={positions[inst.symbol]}
              currency={displayCurrency}
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
            currency={displayCurrency}
            onClose={() => setSelected(null)}
            onSuccess={handleSuccess}
          />
        )}
      </AnimatePresence>

      {/* Disclaimer */}
      <p className="text-[11px] text-muted-foreground/60 text-center pb-4">
        Prices are indicative and may differ from live market rates. Currency conversions use static rates and are for display purposes only.
        All investments carry risk. Past performance does not guarantee future results. BlockTrade does not provide investment advice.
      </p>
    </div>
  );
}
