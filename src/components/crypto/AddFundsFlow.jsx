import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PlusCircle, CreditCard, Building2, Wallet2, ChevronLeft,
  CheckCircle2, Loader2, ShieldCheck, AlertCircle,
  UserCheck, Database, Server, RefreshCcw, CircleDollarSign, BadgeCheck, Lock,
  TrendingUp, Search, ArrowDownLeft, ArrowRight, Zap, Coins,
  ChevronDown, X as XIcon,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useLivePrices } from "@/hooks/useLivePrices";
import { createDepositRequest, processDeposit } from "@/lib/api/deposits";
import { executeTrade } from "@/lib/api/portfolio";
import AddPaymentMethodDialog from "./AddPaymentMethodDialog";
import { toast } from '@/lib/toast';
import { useQueryClient } from "@tanstack/react-query";

// ── Constants ──────────────────────────────────────────────────────────────────
const PRESETS = [100, 500, 1000, 5000, 10000];

const DEPOSIT_STEPS = [
  { icon: UserCheck,        label: "Verifying account identity",    delay: 0 },
  { icon: ShieldCheck,      label: "Running security check",        delay: 1000 },
  { icon: Database,         label: "Connecting to payment network", delay: 2200 },
  { icon: Server,           label: "Authorizing payment method",    delay: 3400 },
  { icon: RefreshCcw,       label: "Processing deposit",            delay: 4600 },
  { icon: CircleDollarSign, label: "Crediting your account",        delay: 5600 },
  { icon: BadgeCheck,       label: "Deposit completed",             delay: 6600 },
];

const BUY_STEPS = [
  { icon: UserCheck,        label: "Verifying account permissions",   delay: 0 },
  { icon: TrendingUp,       label: "Fetching live market price",      delay: 800 },
  { icon: CircleDollarSign, label: "Reserving funds from balance",    delay: 1700 },
  { icon: Zap,              label: "Executing market buy order",      delay: 2700 },
  { icon: BadgeCheck,       label: "Trade confirmed",                 delay: 3800 },
];

const TYPE_ICON = { card: CreditCard, bank_account: Building2, paypal: Wallet2 };
const BRAND_LABEL = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover" };

// ── Shared sub-components ──────────────────────────────────────────────────────
function MethodLabel({ method }) {
  const Icon = TYPE_ICON[method.type] || CreditCard;
  if (method.type === "card") {
    return (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">{BRAND_LABEL[method.card_brand] || "Card"} ••••{method.card_last_four}</p>
          <p className="text-xs text-muted-foreground">{method.card_holder_name} · Exp {String(method.expiry_month).padStart(2, "0")}/{String(method.expiry_year).slice(-2)}</p>
        </div>
      </div>
    );
  }
  if (method.type === "bank_account") {
    return (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">{method.bank_name} ••••{method.account_last_four}</p>
          <p className="text-xs text-muted-foreground">{method.account_holder}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold">PayPal</p>
        <p className="text-xs text-muted-foreground">{method.paypal_email}</p>
      </div>
    </div>
  );
}

function ProcessingStep({ step, isVisible, isActive, isCompleted, isLast }) {
  if (!isVisible) return null;
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-center gap-3"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
        isLast && isCompleted ? "bg-primary/20" : isActive ? "bg-primary/10" : "bg-secondary/60"
      }`}>
        {isActive && !isCompleted ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : isCompleted ? (
          isLast ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Icon className="w-4 h-4 text-primary/70" />
        ) : (
          <Icon className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isLast && isCompleted ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
          {step.label}
        </p>
      </div>
      <div className="shrink-0">
        {isCompleted && !isActive && <CheckCircle2 className="w-4 h-4 text-primary/60" />}
        {isActive && !isCompleted && <span className="text-xs text-primary font-medium">Processing…</span>}
      </div>
    </motion.div>
  );
}

// ── Coin picker ────────────────────────────────────────────────────────────────
function CoinPicker({ cryptoList, value, onChange }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const ref               = useRef(null);

  const selected = cryptoList.find(c => c.symbol === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return cryptoList.slice(0, 30);
    const q = query.toUpperCase();
    return cryptoList.filter(c =>
      c.symbol.toUpperCase().includes(q) || c.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 20);
  }, [cryptoList, query]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-3 bg-secondary/50 border border-border/50 rounded-xl hover:border-primary/40 transition-colors"
      >
        {selected ? (
          <div className="flex items-center gap-2.5">
            <span className="text-xl leading-none">{selected.icon}</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{selected.symbol}</p>
              <p className="text-xs text-muted-foreground">{selected.name}</p>
            </div>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Select a coin…</span>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {selected && (
            <div className="text-right mr-1">
              <p className="text-xs font-semibold tabular-nums text-foreground">${selected.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              <p className={`text-[10px] font-medium ${selected.change24h >= 0 ? "text-primary" : "text-destructive"}`}>
                {selected.change24h >= 0 ? "+" : ""}{selected.change24h?.toFixed(2)}%
              </p>
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-card border border-border/60 rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-2 border-b border-border/40">
              <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  placeholder="Search coins…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
                />
                {query && (
                  <button onClick={() => setQuery("")}>
                    <XIcon className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.map(coin => (
                <button
                  key={coin.symbol}
                  type="button"
                  onClick={() => { onChange(coin.symbol); setOpen(false); setQuery(""); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/50 transition-colors text-left ${
                    coin.symbol === value ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg leading-none">{coin.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{coin.symbol}</p>
                      <p className="text-xs text-muted-foreground">{coin.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums text-foreground">${coin.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    <p className={`text-xs font-medium ${coin.change24h >= 0 ? "text-primary" : "text-destructive"}`}>
                      {coin.change24h >= 0 ? "+" : ""}{coin.change24h?.toFixed(2)}%
                    </p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">No coins found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Processing screen (shared by deposit + buy) ────────────────────────────────
function ProcessingScreen({ steps, processingSteps, processingDone, amountLabel }) {
  const totalSteps    = steps.length;
  const completedCount = processingDone ? totalSteps : processingSteps.length;
  const progressPct   = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="py-4 space-y-5">
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-5 text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
            <RefreshCcw className="w-7 h-7 text-primary" />
          </motion.div>
        </div>
        <p className="font-bold text-lg text-foreground">{amountLabel}</p>
        <p className="text-sm text-muted-foreground">Authorization in progress</p>
        <div className="w-full bg-secondary/60 rounded-full h-1.5 mt-2 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{progressPct}% complete</p>
      </div>

      <div className="space-y-3 px-1">
        {steps.map((s, i) => {
          const isVisible   = processingSteps.includes(i);
          const isNextVisible = processingSteps.includes(i + 1);
          const isActive    = isVisible && !isNextVisible && !processingDone;
          const isCompleted = isNextVisible || (processingDone && isVisible);
          const isLast      = i === steps.length - 1;
          return (
            <ProcessingStep
              key={i}
              step={s}
              isVisible={isVisible}
              isActive={isActive}
              isCompleted={isCompleted}
              isLast={isLast}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border/40 rounded-lg p-3 bg-secondary/20">
        <Lock className="w-3.5 h-3.5 text-primary/60 shrink-0" />
        <span>Do not close this window. Your transaction is being securely processed.</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AddFundsFlow({ open, onClose, paymentMethods = [], onMethodAdded, onSuccess }) {
  const { user }                           = useAuth();
  const { portfolioId, cashBalance, refetch } = usePortfolio();
  const { cryptoList }                     = useLivePrices();
  const queryClient                        = useQueryClient();

  // ── Shared state ────────────────────────────────────────────────────────────
  const [mode, setMode]                   = useState(null); // null | "deposit" | "buy"
  const [addMethodOpen, setAddMethodOpen] = useState(false);

  // ── Deposit state ────────────────────────────────────────────────────────────
  const [dStep, setDStep]                   = useState(1);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [dAmount, setDAmount]               = useState("");
  const [dProcessingSteps, setDProcessingSteps] = useState([]);
  const [dProcessingDone, setDProcessingDone]   = useState(false);
  const [refCode, setRefCode]               = useState("");
  const [dError, setDError]                 = useState("");

  // ── Buy state ────────────────────────────────────────────────────────────────
  const [bStep, setBStep]                     = useState(1);
  const [bCoin, setBCoin]                     = useState("BTC");
  const [bUsdAmount, setBUsdAmount]           = useState("");
  const [bProcessingSteps, setBProcessingSteps] = useState([]);
  const [bProcessingDone, setBProcessingDone]   = useState(false);
  const [bError, setBError]                   = useState("");
  const [bTrade, setBTrade]                   = useState(null); // filled on success

  // ── Computed buy values ──────────────────────────────────────────────────────
  const selectedCoin  = useMemo(() => cryptoList.find(c => c.symbol === bCoin), [cryptoList, bCoin]);
  const bUsd          = parseFloat(bUsdAmount) || 0;
  const bFee          = parseFloat((bUsd * 0.001).toFixed(4));
  const bTotal        = bUsd + bFee;
  const bQty          = selectedCoin && bUsd > 0 ? bUsd / selectedCoin.price : 0;
  const bInsufficient = bUsd > 0 && bTotal > cashBalance;
  const bValid        = bUsd >= 1 && !bInsufficient && !!selectedCoin;

  // ── Computed deposit values ──────────────────────────────────────────────────
  const dParsed  = parseFloat(dAmount);
  const dIsValid = !isNaN(dParsed) && dParsed >= 10;

  // ── Balance presets for buy ──────────────────────────────────────────────────
  const BUY_PRESETS = useMemo(() => {
    if (!cashBalance || cashBalance <= 0) return [];
    return [
      { label: "25%", value: (cashBalance * 0.25).toFixed(2) },
      { label: "50%", value: (cashBalance * 0.50).toFixed(2) },
      { label: "75%", value: (cashBalance * 0.75).toFixed(2) },
      { label: "Max", value: (cashBalance * 0.999).toFixed(2) },
    ];
  }, [cashBalance]);

  // ── Reset ────────────────────────────────────────────────────────────────────
  const reset = () => {
    setMode(null);
    setDStep(1); setSelectedMethod(null); setDAmount("");
    setDProcessingSteps([]); setDProcessingDone(false); setRefCode(""); setDError("");
    setBStep(1); setBCoin("BTC"); setBUsdAmount("");
    setBProcessingSteps([]); setBProcessingDone(false); setBError(""); setBTrade(null);
  };

  const handleClose = () => {
    const isProcessing = (mode === "deposit" && dStep === 4) || (mode === "buy" && bStep === 3);
    if (isProcessing) return;
    reset();
    onClose();
  };

  // ── Deposit logic ────────────────────────────────────────────────────────────
  const handleMethodAdded = (method) => {
    onMethodAdded?.(method);
    setSelectedMethod(method);
    setDStep(2);
  };

  const handleDepositProcess = async () => {
    setDStep(4);
    setDProcessingSteps([]);
    setDProcessingDone(false);
    setDError("");

    DEPOSIT_STEPS.forEach((s, i) => {
      setTimeout(() => setDProcessingSteps(prev => [...prev, i]), s.delay);
    });

    setTimeout(async () => {
      try {
        const req    = await createDepositRequest(portfolioId, user.id, {
          amount:          dParsed,
          paymentMethodId: selectedMethod?.id ?? null,
          notes:           `Deposit via ${selectedMethod?.label ?? "payment method"}`,
        });
        const result = await processDeposit(req.id);
        setRefCode(result.reference_code || req.reference_code);
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["deposit-requests", portfolioId] });
        queryClient.invalidateQueries({ queryKey: ["transactions-analytics", portfolioId] });
        setTimeout(() => {
          setDProcessingDone(true);
          setDStep(5);
          onSuccess?.();
        }, DEPOSIT_STEPS[DEPOSIT_STEPS.length - 1].delay + 600);
      } catch (err) {
        setDError(err.message || "Deposit failed");
        setDProcessingDone(true);
        setTimeout(() => setDStep(5), 800);
      }
    }, DEPOSIT_STEPS[3].delay + 200);
  };

  // ── Buy logic ────────────────────────────────────────────────────────────────
  const handleBuyProcess = async () => {
    setBStep(3);
    setBProcessingSteps([]);
    setBProcessingDone(false);
    setBError("");

    BUY_STEPS.forEach((s, i) => {
      setTimeout(() => setBProcessingSteps(prev => [...prev, i]), s.delay);
    });

    setTimeout(async () => {
      try {
        await executeTrade(portfolioId, cashBalance, {
          symbol:    bCoin,
          name:      selectedCoin?.name || bCoin,
          type:      "BUY",
          quantity:  parseFloat(bQty.toFixed(8)),
          unitPrice: selectedCoin?.price,
        });

        await refetch();
        queryClient.invalidateQueries({ queryKey: ["trades", portfolioId] });
        queryClient.invalidateQueries({ queryKey: ["transactions-analytics", portfolioId] });

        setBTrade({
          symbol:   bCoin,
          name:     selectedCoin?.name,
          qty:      bQty,
          price:    selectedCoin?.price,
          usd:      bUsd,
          fee:      bFee,
        });

        setTimeout(() => {
          setBProcessingDone(true);
          setBStep(4);
          onSuccess?.();
        }, BUY_STEPS[BUY_STEPS.length - 1].delay + 600);
      } catch (err) {
        setBError(err.message || "Trade failed");
        setBProcessingDone(true);
        setTimeout(() => setBStep(4), 800);
      }
    }, BUY_STEPS[2].delay + 200);
  };

  // ── Dialog title ─────────────────────────────────────────────────────────────
  const dialogTitle = (() => {
    if (!mode)                          return "Add Funds";
    if (mode === "deposit") {
      if (dStep <= 3)                   return "Deposit Funds";
      if (dStep === 4)                  return "Authorizing Deposit";
      return "Transaction Complete";
    }
    if (mode === "buy") {
      if (bStep <= 2)                   return "Buy Crypto";
      if (bStep === 3)                  return "Executing Trade";
      return "Trade Complete";
    }
  })();

  const showBack = (() => {
    if (!mode)                           return false;
    if (mode === "deposit" && dStep >= 1 && dStep <= 3) return true;
    if (mode === "buy"     && bStep >= 1 && bStep <= 2) return true;
    return false;
  })();

  const handleBack = () => {
    if (mode === "deposit") {
      if (dStep === 1) { setMode(null); }
      else             { setDStep(s => s - 1); }
    }
    if (mode === "buy") {
      if (bStep === 1) { setMode(null); }
      else             { setBStep(s => s - 1); }
    }
  };

  const depositStepCount = dStep <= 3 ? dStep : null;
  const buyStepCount     = bStep <= 2 ? bStep : null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="border-border/50 bg-card max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {showBack && (
                <button onClick={handleBack} className="mr-1 text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {!mode && <PlusCircle className="w-5 h-5 text-primary" />}
              {mode === "deposit" && <ArrowDownLeft className="w-5 h-5 text-primary" />}
              {mode === "buy"     && <Coins className="w-5 h-5 text-primary" />}
              {dialogTitle}
            </DialogTitle>
          </DialogHeader>

          {/* Progress bar */}
          {mode === "deposit" && depositStepCount && (
            <div className="flex gap-1 mb-1">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= dStep ? "bg-primary" : "bg-secondary/50"}`} />
              ))}
            </div>
          )}
          {mode === "buy" && buyStepCount && (
            <div className="flex gap-1 mb-1">
              {[1, 2].map(s => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= bStep ? "bg-primary" : "bg-secondary/50"}`} />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">

            {/* ── Mode selector ───────────────────────────────────────────────── */}
            {!mode && (
              <motion.div key="mode" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3 py-2">
                <p className="text-xs text-muted-foreground">Choose what you'd like to do.</p>

                <button
                  onClick={() => setMode("deposit")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <ArrowDownLeft className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Add Cash to Account</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Deposit via card, bank transfer, or PayPal</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/60 shrink-0 transition-colors" />
                </button>

                <button
                  onClick={() => setMode("buy")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Coins className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Buy Crypto</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Spend your cash balance · <span className="text-foreground font-medium">${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} available</span>
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/60 shrink-0 transition-colors" />
                </button>

                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Secured by 256-bit encryption. Your data is safe.</span>
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                DEPOSIT FLOW
            ══════════════════════════════════════════════════════════════════════ */}

            {/* Deposit Step 1: Select payment method */}
            {mode === "deposit" && dStep === 1 && (
              <motion.div key="d1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3 py-2">
                <p className="text-xs text-muted-foreground">Choose the payment method to fund your account.</p>

                {paymentMethods.length === 0 && (
                  <div className="text-center py-6 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mx-auto">
                      <CreditCard className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No payment methods saved yet.</p>
                  </div>
                )}

                {paymentMethods.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedMethod(m); setDStep(2); }}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                      selectedMethod?.id === m.id ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <MethodLabel method={m} />
                    {m.is_default && (
                      <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full ml-2 shrink-0">Default</span>
                    )}
                  </button>
                ))}

                <Button
                  variant="outline"
                  onClick={() => setAddMethodOpen(true)}
                  className="w-full border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add New Payment Method
                </Button>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Secured by 256-bit encryption. Your data is safe.</span>
                </div>
              </motion.div>
            )}

            {/* Deposit Step 2: Amount */}
            {mode === "deposit" && dStep === 2 && (
              <motion.div key="d2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-2">
                {selectedMethod && (
                  <div className="bg-secondary/30 rounded-xl p-3 border border-border/50">
                    <MethodLabel method={selectedMethod} />
                  </div>
                )}
                <div className="bg-secondary/30 rounded-xl p-3 border border-border/50 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Current Balance</span>
                  <span className="font-bold text-foreground">${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-2">Quick amounts</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {PRESETS.map(p => (
                      <button
                        key={p}
                        onClick={() => setDAmount(String(p))}
                        className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          dAmount === String(p)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                      >
                        ${p >= 1000 ? `${p / 1000}k` : p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Custom Amount (USD)</label>
                  <Input
                    type="number"
                    value={dAmount}
                    onChange={e => setDAmount(e.target.value)}
                    placeholder="Minimum $10.00"
                    min="10"
                    step="0.01"
                    className="bg-secondary/50 border-border/50"
                  />
                  {dAmount && !isNaN(dParsed) && dParsed < 10 && (
                    <p className="text-xs text-destructive mt-1">Minimum deposit is $10.00</p>
                  )}
                </div>
                {dIsValid && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between text-sm"
                  >
                    <span className="text-muted-foreground">Balance after deposit</span>
                    <span className="font-bold text-primary">${(cashBalance + dParsed).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </motion.div>
                )}
                <div className="flex gap-3 pt-1">
                  <Button variant="outline" onClick={() => setDStep(1)} className="flex-1">Back</Button>
                  <Button onClick={() => setDStep(3)} disabled={!dIsValid} className="flex-1 bg-primary hover:bg-primary/90">Review</Button>
                </div>
              </motion.div>
            )}

            {/* Deposit Step 3: Review */}
            {mode === "deposit" && dStep === 3 && (
              <motion.div key="d3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-2">
                <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deposit Summary</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">${dParsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fee</span>
                      <span className="font-semibold text-primary">Free</span>
                    </div>
                    <div className="border-t border-border/50 pt-2 flex justify-between">
                      <span className="font-semibold">You receive</span>
                      <span className="font-bold text-primary text-base">${dParsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
                {selectedMethod && (
                  <div className="bg-secondary/30 rounded-xl p-3 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">Payment method</p>
                    <MethodLabel method={selectedMethod} />
                  </div>
                )}
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>Funds typically appear in your trading account within seconds. Secured by bank-level encryption.</span>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setDStep(2)} className="flex-1">Back</Button>
                  <Button onClick={handleDepositProcess} className="flex-1 bg-primary hover:bg-primary/90 font-semibold">
                    Confirm Deposit
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Deposit Step 4: Processing */}
            {mode === "deposit" && dStep === 4 && (
              <motion.div key="d4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ProcessingScreen
                  steps={DEPOSIT_STEPS}
                  processingSteps={dProcessingSteps}
                  processingDone={dProcessingDone}
                  amountLabel={`$${dParsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                />
              </motion.div>
            )}

            {/* Deposit Step 5: Result */}
            {mode === "deposit" && dStep === 5 && (
              <motion.div key="d5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center space-y-4">
                {dError ? (
                  <>
                    <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                      <AlertCircle className="w-7 h-7 text-destructive" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Deposit Failed</p>
                      <p className="text-sm text-muted-foreground mt-1">{dError}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ scale: 0.6 }} animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto"
                    >
                      <CheckCircle2 className="w-8 h-8 text-primary" />
                    </motion.div>
                    <div>
                      <p className="font-bold text-xl text-foreground">${dParsed.toLocaleString(undefined, { minimumFractionDigits: 2 })} Added</p>
                      <p className="text-sm text-muted-foreground mt-1">Funds are now available in your trading account.</p>
                    </div>
                    {refCode && (
                      <div className="bg-secondary/30 border border-border/50 rounded-xl px-5 py-3 inline-block mx-auto">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Transaction Reference</p>
                        <p className="font-mono text-sm font-bold text-foreground mt-0.5">{refCode}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary/60" />
                      <span>Transaction verified and recorded securely</span>
                    </div>
                  </>
                )}
                <Button onClick={() => { reset(); onClose(); }} className="w-full bg-primary hover:bg-primary/90 mt-2">
                  {dError ? "Close" : "Done"}
                </Button>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                BUY FLOW
            ══════════════════════════════════════════════════════════════════════ */}

            {/* Buy Step 1: Select coin + amount */}
            {mode === "buy" && bStep === 1 && (
              <motion.div key="b1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-2">

                {/* Available balance */}
                <div className="flex items-center justify-between bg-secondary/30 border border-border/50 rounded-xl p-3">
                  <span className="text-xs text-muted-foreground">Available cash</span>
                  <span className="font-bold text-foreground">${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>

                {/* Coin picker */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Select Asset</label>
                  <CoinPicker cryptoList={cryptoList} value={bCoin} onChange={setBCoin} />
                </div>

                {/* USD amount */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">$</span>
                    <Input
                      type="number"
                      value={bUsdAmount}
                      onChange={e => setBUsdAmount(e.target.value)}
                      placeholder="0.00"
                      min="1"
                      step="0.01"
                      className={`bg-secondary/50 border-border/50 pl-7 ${bInsufficient ? "border-destructive/60" : ""}`}
                    />
                  </div>
                  {bInsufficient && (
                    <p className="text-xs text-destructive mt-1">Insufficient funds — need ${(bTotal - cashBalance).toFixed(2)} more</p>
                  )}
                </div>

                {/* Balance quick-select presets */}
                {BUY_PRESETS.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1.5">Quick amounts</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {BUY_PRESETS.map(({ label, value }) => (
                        <button
                          key={label}
                          onClick={() => setBUsdAmount(value)}
                          className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            bUsdAmount === value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live preview */}
                {bUsd > 0 && selectedCoin && !bInsufficient && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1.5"
                  >
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">You receive</span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {bQty.toLocaleString(undefined, { maximumFractionDigits: 8 })} {bCoin}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Price per {bCoin}</span>
                      <span className="font-medium tabular-nums text-foreground">${selectedCoin.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Fee (0.1%)</span>
                      <span className="font-medium tabular-nums text-foreground">${bFee.toFixed(4)}</span>
                    </div>
                    <div className="border-t border-primary/10 pt-1.5 flex justify-between text-xs">
                      <span className="text-muted-foreground">Balance after</span>
                      <span className="font-bold text-primary">${(cashBalance - bTotal).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  </motion.div>
                )}

                <Button
                  onClick={() => setBStep(2)}
                  disabled={!bValid}
                  className="w-full bg-primary hover:bg-primary/90 font-semibold"
                >
                  Review Order
                </Button>
              </motion.div>
            )}

            {/* Buy Step 2: Review */}
            {mode === "buy" && bStep === 2 && (
              <motion.div key="b2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-2">

                {/* Coin header */}
                {selectedCoin && (
                  <div className="flex items-center gap-3 bg-secondary/30 rounded-xl p-3 border border-border/50">
                    <span className="text-2xl">{selectedCoin.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-foreground">{selectedCoin.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedCoin.symbol} · ${selectedCoin.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${selectedCoin.change24h >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                      {selectedCoin.change24h >= 0 ? "+" : ""}{selectedCoin.change24h?.toFixed(2)}%
                    </div>
                  </div>
                )}

                {/* Order summary */}
                <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order Summary</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Spend</span>
                      <span className="font-semibold">${bUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fee (0.1%)</span>
                      <span className="font-semibold">${bFee.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total charged</span>
                      <span className="font-semibold">${bTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="border-t border-border/50 pt-2 flex justify-between">
                      <span className="font-semibold">You receive</span>
                      <span className="font-bold text-primary">
                        {bQty.toLocaleString(undefined, { maximumFractionDigits: 8 })} {bCoin}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Balance after</span>
                      <span className="font-medium text-foreground">${(cashBalance - bTotal).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                  <TrendingUp className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span>Market orders execute at the current live price which may vary slightly at the time of execution.</span>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setBStep(1)} className="flex-1">Back</Button>
                  <Button onClick={handleBuyProcess} className="flex-1 bg-primary hover:bg-primary/90 font-semibold">
                    Confirm Buy
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Buy Step 3: Processing */}
            {mode === "buy" && bStep === 3 && (
              <motion.div key="b3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ProcessingScreen
                  steps={BUY_STEPS}
                  processingSteps={bProcessingSteps}
                  processingDone={bProcessingDone}
                  amountLabel={`Buying ${bQty.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${bCoin}`}
                />
              </motion.div>
            )}

            {/* Buy Step 4: Result */}
            {mode === "buy" && bStep === 4 && (
              <motion.div key="b4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center space-y-4">
                {bError ? (
                  <>
                    <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                      <AlertCircle className="w-7 h-7 text-destructive" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Trade Failed</p>
                      <p className="text-sm text-muted-foreground mt-1">{bError}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ scale: 0.6 }} animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto"
                    >
                      <CheckCircle2 className="w-8 h-8 text-primary" />
                    </motion.div>

                    {bTrade && (
                      <>
                        <div>
                          <p className="font-bold text-xl text-foreground">
                            {bTrade.qty.toLocaleString(undefined, { maximumFractionDigits: 8 })} {bTrade.symbol}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5">purchased successfully</p>
                        </div>

                        <div className="bg-secondary/30 border border-border/50 rounded-xl px-5 py-3 text-left space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Spent</span>
                            <span className="font-medium tabular-nums">${bTrade.usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Price per {bTrade.symbol}</span>
                            <span className="font-medium tabular-nums">${bTrade.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Fee</span>
                            <span className="font-medium tabular-nums">${bTrade.fee.toFixed(4)}</span>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary/60" />
                      <span>Trade recorded and portfolio updated</span>
                    </div>
                  </>
                )}
                <Button onClick={() => { reset(); onClose(); }} className="w-full bg-primary hover:bg-primary/90 mt-2">
                  {bError ? "Close" : "Done"}
                </Button>
              </motion.div>
            )}

          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <AddPaymentMethodDialog
        open={addMethodOpen}
        onClose={() => setAddMethodOpen(false)}
        onAdded={handleMethodAdded}
      />
    </>
  );
}
