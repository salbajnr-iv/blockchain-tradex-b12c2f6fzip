import React, { useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useLivePrices } from "@/hooks/useLivePrices";
import {
  getMasterWallets,
  getUserDeposits,
  submitCryptoDeposit,
  getUserCryptoBalances,
  getDepositProofUrl,
} from "@/lib/api/cryptoDeposits";
import { getBankDetails } from "@/lib/api/admin";
import { createTransaction } from "@/lib/api/transactions";
import { toast } from '@/lib/toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Copy, CheckCircle2, Clock, XCircle, RefreshCw,
  Upload, X, AlertCircle, FileImage, Info, Loader2, ExternalLink,
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Repeat2,
  ChevronRight, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Building2, CreditCard, Smartphone, Globe, Wallet,
} from "lucide-react";
import { CRYPTO_ASSETS, FIAT_CURRENCIES } from "./Assets";
import { useActionGuard } from "@/hooks/useActionGuard";
import { getUserWhitelist, normalizeAddress, getTodayWithdrawalUsd } from "@/lib/api/userPolicy";
import { checkDepositAmount, checkWithdrawalAmount } from "@/lib/kycTiers";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const STABLECOIN_PRICE = { USDT: 1.0, USDC: 1.0 };

const STATUS_CONFIG = {
  pending:      { label: "Pending",      color: "text-yellow-500",  bg: "bg-yellow-500/10 border-yellow-500/20",  icon: Clock },
  under_review: { label: "Under Review", color: "text-blue-500",    bg: "bg-blue-500/10 border-blue-500/20",      icon: RefreshCw },
  completed:    { label: "Completed",    color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20",icon: CheckCircle2 },
  rejected:     { label: "Rejected",     color: "text-destructive", bg: "bg-destructive/10 border-destructive/20",icon: XCircle },
};

function fmtUsd(v) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v ?? 0);
}

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="shrink-0 p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
    >
      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPOSIT FLOW — Crypto
// Steps: 1=show address  2=upload proof
// ─────────────────────────────────────────────────────────────────────────────
function CryptoDepositFlow({ asset, wallet, userId, onClose, onSuccess }) {
  const guard = useActionGuard();
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("File must be under 10 MB"); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowed.includes(f.type)) { toast.error("Only images or PDF allowed"); return; }
    setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!guard.allow('deposit')) return;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; }
    if (!file && !txHash.trim()) { toast.error("Provide a transaction hash or upload a proof screenshot"); return; }
    // Approximate USD value for tier check (use 1:1 for stable, otherwise skip if unknown)
    const usdEst = STABLECOIN_PRICE[asset.symbol] ? parsed * STABLECOIN_PRICE[asset.symbol] : null;
    if (usdEst != null) {
      const tierCheck = checkDepositAmount(guard.policy?.kyc_tier ?? 0, usdEst);
      if (!tierCheck.ok) { toast.error(tierCheck.reason); return; }
    } else if ((guard.policy?.kyc_tier ?? 0) === 0) {
      toast.error('Please complete KYC verification before making deposits.'); return;
    }
    setSubmitting(true);
    try {
      await submitCryptoDeposit({ userId, asset: asset.symbol, network: wallet.network, amount: parsed, txHash: txHash || null, proofFile: file || null });
      toast.success("Deposit submitted! Our team will review it shortly.");
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit deposit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2].map((s) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
              step === s ? "bg-primary text-primary-foreground" : step > s ? "bg-emerald-500/20 text-emerald-500" : "bg-secondary/50 text-muted-foreground"
            }`}>
              {step > s ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{s}</span>}
              {s === 1 ? "Send Funds" : "Confirm Deposit"}
            </div>
            {s < 2 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            {wallet ? (
              <>
                <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {asset.symbol} Deposit Address · {wallet.network}
                  </p>
                  <div className="flex items-center gap-2 bg-background rounded-xl border border-border px-3 py-3">
                    <p className="flex-1 font-mono text-xs text-foreground break-all">{wallet.address}</p>
                    <CopyBtn value={wallet.address} />
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      Only send <strong>{asset.symbol}</strong> on the <strong>{wallet.network}</strong> network. Sending other assets will result in permanent loss.
                    </p>
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground">How to deposit:</p>
                  {[
                    "Copy the deposit address above",
                    `Send ${asset.symbol} from your external wallet or exchange`,
                    "Wait for network confirmations (usually 5–30 minutes)",
                    "Click \"I've Sent the Funds\" to submit your proof",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <p className="text-sm text-muted-foreground">{step}</p>
                    </div>
                  ))}
                </div>
                <Button onClick={() => setStep(2)} className="w-full rounded-xl">
                  I've Sent the Funds →
                </Button>
              </>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-center space-y-2">
                <Wallet className="w-10 h-10 text-amber-500/50 mx-auto" />
                <p className="text-sm font-semibold text-foreground">{asset.symbol} deposit address not configured</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The admin has not yet set up a {asset.symbol} deposit wallet. Please contact support and they will provide you with a deposit address directly.
                </p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Amount sent <span className="text-destructive">*</span></label>
                <div className="relative">
                  <Input type="number" step="any" min="0" placeholder="e.g. 0.005" value={amount}
                    onChange={(e) => setAmount(e.target.value)} className="bg-secondary/40 border-border pr-16" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">{asset.symbol}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Transaction Hash <span className="text-muted-foreground text-xs font-normal ml-1">(optional)</span>
                </label>
                <Input placeholder="0xabc123... or txid..." value={txHash}
                  onChange={(e) => setTxHash(e.target.value)} className="bg-secondary/40 border-border font-mono text-xs" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Proof of Payment <span className="text-muted-foreground text-xs font-normal ml-1">(screenshot or PDF)</span>
                </label>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={handleFile} className="hidden" />
                {file ? (
                  <div className="flex items-center gap-3 bg-secondary/40 rounded-xl border border-border px-3 py-2.5">
                    <FileImage className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                      <X className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 border-2 border-dashed border-border hover:border-primary/40 rounded-xl py-6 transition-colors text-muted-foreground hover:text-foreground bg-secondary/20"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-sm">Click to upload proof</span>
                    <span className="text-xs">JPG, PNG, PDF · Max 10 MB</span>
                  </button>
                )}
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-2">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                  Your deposit will be reviewed and credited within 1–24 hours after confirmation.
                </p>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 rounded-xl" disabled={submitting}>← Back</Button>
                <Button type="submit" className="flex-1 rounded-xl" disabled={submitting}>
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</> : "Submit Deposit"}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPOSIT FLOW — Fiat
// Steps: 1=enter amount  2=bank details  3=upload proof
// ─────────────────────────────────────────────────────────────────────────────
function FiatDepositFlow({ currency, userId, portfolioId, onClose, onSuccess }) {
  const guard = useActionGuard();
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [file, setFile] = useState(null);
  const [reference] = useState(`BT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const { data: allBankDetails } = useQuery({
    queryKey: ["bank_details"],
    queryFn: getBankDetails,
    staleTime: 5 * 60_000,
  });

  const bankInfo = (allBankDetails ?? {})[currency.symbol] ?? {};

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("File must be under 10 MB"); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowed.includes(f.type)) { toast.error("Only images or PDF allowed"); return; }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!guard.allow('deposit')) return;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; }
    const tierCheck = checkDepositAmount(guard.policy?.kyc_tier ?? 0, parsed);
    if (!tierCheck.ok) { toast.error(tierCheck.reason); return; }
    setSubmitting(true);
    try {
      await createTransaction(portfolioId, {
        type: "DEPOSIT",
        symbol: currency.symbol,
        total_amount: parsed,
        status: "pending",
        notes: `Fiat deposit — ${currency.symbol} via ${method} — Ref: ${reference}`,
      });
      toast.success("Deposit request submitted! We'll credit your account once confirmed.");
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit deposit");
    } finally {
      setSubmitting(false);
    }
  };

  const steps = ["Amount", "Bank Details", "Confirm"];

  return (
    <div className="space-y-5">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
              step === i + 1 ? "bg-primary text-primary-foreground" : step > i + 1 ? "bg-emerald-500/20 text-emerald-500" : "bg-secondary/50 text-muted-foreground"
            }`}>
              {step > i + 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
              {label}
            </div>
            {i < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Deposit Amount</label>
              <div className="relative">
                <Input type="number" step="any" min="0" placeholder="0.00" value={amount}
                  onChange={(e) => setAmount(e.target.value)} className="bg-secondary/40 border-border pr-16 text-lg font-semibold" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">{currency.symbol}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Deposit Method</label>
              {[
                { id: "bank",  label: "Bank Transfer",  desc: "1–3 business days",   icon: Building2 },
                { id: "wire",  label: "Wire Transfer",  desc: "Same-day processing",  icon: Globe },
                { id: "card",  label: "Debit Card",     desc: "Instant (fees apply)", icon: CreditCard },
              ].map(({ id, label, desc, icon: Icon }) => (
                <button key={id} onClick={() => setMethod(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                    method === id ? "border-primary/50 bg-primary/5 text-foreground" : "border-border hover:border-primary/30 text-muted-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${method === id ? "border-primary bg-primary" : "border-border"}`} />
                </button>
              ))}
            </div>

            <Button onClick={() => { if (!amount || parseFloat(amount) <= 0) { toast.error("Enter a valid amount"); return; } setStep(2); }}
              className="w-full rounded-xl">
              Continue →
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground">You are sending</p>
              <p className="text-2xl font-bold text-foreground">{parseFloat(amount).toLocaleString()} {currency.symbol}</p>
            </div>

            <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bank Transfer Details</p>
              {Object.keys(bankInfo).length === 0 ? (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Bank details for {currency.symbol} have not been configured yet. Please contact support for wire transfer instructions.
                  </p>
                </div>
              ) : (
                Object.entries(bankInfo).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-foreground">{v}</span>
                      <CopyBtn value={String(v)} />
                    </div>
                  </div>
                ))
              )}
              <div className="border-t border-border/40 pt-3 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-foreground">Reference <span className="text-destructive">*</span></span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-primary">{reference}</span>
                  <CopyBtn value={reference} />
                </div>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                Always include your reference code <strong>{reference}</strong> in the payment description. Without it, we may not be able to match your deposit.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 rounded-xl">← Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1 rounded-xl">I've Sent the Payment →</Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Payment Proof <span className="text-muted-foreground text-xs font-normal">(optional but recommended)</span></label>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFile} className="hidden" />
              {file ? (
                <div className="flex items-center gap-3 bg-secondary/40 rounded-xl border border-border px-3 py-2.5">
                  <FileImage className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 border-2 border-dashed border-border hover:border-primary/40 rounded-xl py-5 transition-colors text-muted-foreground hover:text-foreground bg-secondary/20"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm">Upload bank receipt</span>
                  <span className="text-xs">JPG, PNG, PDF</span>
                </button>
              )}
            </div>

            <div className="bg-secondary/40 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{parseFloat(amount).toLocaleString()} {currency.symbol}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-semibold capitalize">{method} Transfer</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono font-bold text-primary">{reference}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Processing</span><span className="font-semibold">1–3 business days</span></div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1 rounded-xl" disabled={submitting}>← Back</Button>
              <Button onClick={handleSubmit} className="flex-1 rounded-xl" disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</> : "Confirm Deposit"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WITHDRAW FLOW — steps: 1=amount+method  2=destination details  3=review
// ─────────────────────────────────────────────────────────────────────────────
function WithdrawFlow({ asset, isFiat, balance, portfolioId, onClose, onSuccess }) {
  const guard = useActionGuard();
  const { user } = useAuth();
  const [whitelist, setWhitelist] = React.useState([]);
  React.useEffect(() => {
    if (!user?.id || isFiat || !guard.policy?.withdrawal_whitelist_only) { setWhitelist([]); return; }
    let active = true;
    getUserWhitelist(user.id).then((d) => { if (active) setWhitelist(d || []); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id, isFiat, guard.policy?.withdrawal_whitelist_only]);
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(isFiat ? "bank" : "crypto");
  const [destination, setDestination] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const methods = isFiat
    ? [
        { id: "bank",   label: "Bank Transfer",  icon: Building2, fields: [{ k: "accountName", label: "Account Holder Name" }, { k: "accountNumber", label: "Account Number" }, { k: "routingNumber", label: "Routing / Sort Code" }, { k: "bankName", label: "Bank Name" }] },
        { id: "wire",   label: "Wire Transfer",  icon: Globe,     fields: [{ k: "iban", label: "IBAN" }, { k: "swift", label: "SWIFT / BIC" }, { k: "accountName", label: "Beneficiary Name" }] },
        { id: "paypal", label: "PayPal",         icon: Smartphone,fields: [{ k: "email", label: "PayPal Email" }, { k: "name", label: "Full Name" }] },
      ]
    : [
        { id: "crypto", label: "Crypto Wallet", icon: Wallet, fields: [{ k: "address", label: `${asset.symbol} Wallet Address` }, { k: "network", label: "Network" }] },
      ];

  const selectedMethod = methods.find((m) => m.id === method) || methods[0];
  const parsed = parseFloat(amount) || 0;
  const fee = isFiat ? parsed * 0.02 : 0;
  const youReceive = parsed - fee;

  const handleSubmit = async () => {
    if (!guard.allow('withdraw')) return;
    if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; }
    if (parsed > balance) { toast.error("Insufficient balance"); return; }
    const missingField = selectedMethod.fields.find((f) => !destination[f.k]?.trim());
    if (missingField) { toast.error(`Please enter ${missingField.label}`); return; }

    // For crypto, parsed is in coin units; treat fiat withdrawals as USD-equivalent for tier/limit checks.
    if (isFiat) {
      const tierCheck = checkWithdrawalAmount(guard.policy?.kyc_tier ?? 0, parsed);
      if (!tierCheck.ok) { toast.error(tierCheck.reason); return; }
      const userDailyLimit = Number(guard.policy?.daily_withdrawal_limit || 0);
      if (userDailyLimit > 0) {
        const usedToday = await getTodayWithdrawalUsd(portfolioId);
        if (usedToday + parsed > userDailyLimit) {
          toast.error(`Daily withdrawal limit of $${userDailyLimit.toLocaleString()} would be exceeded.`);
          return;
        }
      }
    } else if (guard.policy?.withdrawal_whitelist_only) {
      const target = normalizeAddress(asset.symbol, destination.address);
      const allowed = whitelist
        .filter((w) => String(w.asset).toUpperCase() === String(asset.symbol).toUpperCase())
        .map((w) => normalizeAddress(w.asset, w.address));
      if (!target || !allowed.includes(target)) {
        toast.error('This destination address is not in your withdrawal whitelist. Add it in Settings → Security to proceed.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await createTransaction(portfolioId, {
        type: "WITHDRAWAL",
        symbol: asset.symbol,
        total_amount: parsed,
        status: "pending",
        notes: `Withdrawal — ${asset.symbol} via ${selectedMethod.label}`,
        withdrawal_details: {
          method: selectedMethod.label,
          destination,
          fee,
          currency: asset.symbol,
        },
      });
      toast.success("Withdrawal request submitted! Processing within 1–3 business days.");
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || "Failed to submit withdrawal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {["Amount", "Destination", "Confirm"].map((label, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
              step === i + 1 ? "bg-primary text-primary-foreground" : step > i + 1 ? "bg-emerald-500/20 text-emerald-500" : "bg-secondary/50 text-muted-foreground"
            }`}>
              {step > i + 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
              {label}
            </div>
            {i < 2 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Amount</label>
                <span className="text-xs text-muted-foreground">Balance: <button className="text-primary font-semibold" onClick={() => setAmount(balance.toString())}>{isFiat ? fmtUsd(balance) : `${balance} ${asset.symbol}`}</button></span>
              </div>
              <div className="relative">
                <Input type="number" step="any" min="0" placeholder="0.00" value={amount}
                  onChange={(e) => setAmount(e.target.value)} className="bg-secondary/40 border-border pr-16 text-lg font-semibold" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">{asset.symbol}</span>
              </div>
              {parsed > balance && <p className="text-xs text-destructive flex items-center gap-1"><Info className="w-3.5 h-3.5" />Exceeds your balance</p>}
            </div>

            {isFiat && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Withdrawal Method</label>
                {methods.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setMethod(id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      method === id ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-semibold flex-1 text-left">{label}</span>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${method === id ? "border-primary bg-primary" : "border-border"}`} />
                  </button>
                ))}
              </div>
            )}

            {parsed > 0 && (
              <div className="bg-secondary/40 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">You withdraw</span><span className="font-semibold">{parsed.toLocaleString()} {asset.symbol}</span></div>
                {fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Fee (2%)</span><span className="font-semibold text-destructive">-{fee.toFixed(2)} {asset.symbol}</span></div>}
                <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold"><span>You receive</span><span className="text-emerald-500">{youReceive.toFixed(isFiat ? 2 : 6)} {asset.symbol}</span></div>
              </div>
            )}

            <Button onClick={() => { if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; } if (parsed > balance) { toast.error("Insufficient balance"); return; } setStep(2); }}
              className="w-full rounded-xl">Continue →</Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <p className="text-sm font-semibold text-foreground">{selectedMethod.label} Details</p>
            {selectedMethod.fields.map(({ k, label }) => (
              <div key={k} className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{label} <span className="text-destructive">*</span></label>
                <Input placeholder={label} value={destination[k] || ""} onChange={(e) => setDestination((d) => ({ ...d, [k]: e.target.value }))}
                  className="bg-secondary/40 border-border" />
              </div>
            ))}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 rounded-xl">← Back</Button>
              <Button onClick={() => {
                const missingField = selectedMethod.fields.find((f) => !destination[f.k]?.trim());
                if (missingField) { toast.error(`Please enter ${missingField.label}`); return; }
                setStep(3);
              }} className="flex-1 rounded-xl">Review →</Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Withdrawal Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-semibold">{selectedMethod.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{parsed.toLocaleString()} {asset.symbol}</span></div>
                {fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-semibold text-destructive">-{fee.toFixed(2)} {asset.symbol}</span></div>}
                <div className="flex justify-between border-t border-border/40 pt-2 font-bold"><span>You receive</span><span className="text-emerald-500">{youReceive.toFixed(isFiat ? 2 : 6)} {asset.symbol}</span></div>
                {selectedMethod.fields.map(({ k, label }) => (
                  <div key={k} className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-mono">{destination[k]}</span></div>
                ))}
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">Withdrawals are reviewed within 1–3 business days. You will receive an email confirmation.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1 rounded-xl" disabled={submitting}>← Back</Button>
              <Button onClick={handleSubmit} className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white" disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</> : "Confirm Withdrawal"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFER FLOW — steps: 1=amount+recipient  2=confirm
// ─────────────────────────────────────────────────────────────────────────────
function TransferFlow({ asset, isFiat, balance, portfolioId, allCryptoAssets, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parsed = parseFloat(amount) || 0;

  const handleSubmit = async () => {
    if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; }
    if (parsed > balance) { toast.error("Insufficient balance"); return; }
    if (!recipient.trim()) { toast.error("Enter a recipient email or ID"); return; }
    setSubmitting(true);
    try {
      await createTransaction(portfolioId, {
        type: "WITHDRAWAL",
        symbol: asset.symbol,
        total_amount: parsed,
        status: "pending",
        notes: `Internal transfer to: ${recipient}${note ? ` — ${note}` : ""}`,
      });
      toast.success("Transfer submitted successfully!");
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {["Details", "Confirm"].map((label, i) => (
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Amount</label>
                <span className="text-xs text-muted-foreground">Balance: <button className="text-primary font-semibold" onClick={() => setAmount(balance.toString())}>{isFiat ? fmtUsd(balance) : `${balance} ${asset.symbol}`}</button></span>
              </div>
              <div className="relative">
                <Input type="number" step="any" min="0" placeholder="0.00" value={amount}
                  onChange={(e) => setAmount(e.target.value)} className="bg-secondary/40 border-border pr-16 text-lg font-semibold" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">{asset.symbol}</span>
              </div>
              {parsed > balance && <p className="text-xs text-destructive flex items-center gap-1"><Info className="w-3.5 h-3.5" />Exceeds your balance</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Recipient <span className="text-destructive">*</span></label>
              <Input placeholder="Email or BlockTrade user ID" value={recipient} onChange={(e) => setRecipient(e.target.value)} className="bg-secondary/40 border-border" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Note <span className="text-muted-foreground text-xs">(optional)</span></label>
              <Input placeholder="What's this transfer for?" value={note} onChange={(e) => setNote(e.target.value)} className="bg-secondary/40 border-border" />
            </div>
            <Button onClick={() => {
              if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; }
              if (parsed > balance) { toast.error("Insufficient balance"); return; }
              if (!recipient.trim()) { toast.error("Enter a recipient"); return; }
              setStep(2);
            }} className="w-full rounded-xl">Review Transfer →</Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transfer Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold">{parsed} {asset.symbol}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Recipient</span><span className="font-semibold">{recipient}</span></div>
                {note && <div className="flex justify-between"><span className="text-muted-foreground">Note</span><span className="italic text-muted-foreground">{note}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="text-emerald-500 font-semibold">Free</span></div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 rounded-xl" disabled={submitting}>← Back</Button>
              <Button onClick={handleSubmit} className="flex-1 rounded-xl" disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</> : "Confirm Transfer"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERT FLOW — steps: 1=select pair + amount  2=review
// ─────────────────────────────────────────────────────────────────────────────
function ConvertFlow({ asset, isFiat, balance, portfolioId, cryptoList, onClose, onSuccess }) {
  const allTargets = isFiat
    ? CRYPTO_ASSETS.slice(0, 8)
    : [{ symbol: "USD", name: "US Dollar", icon: "$", bg: "bg-emerald-500/10", text: "text-emerald-500" }, ...CRYPTO_ASSETS.filter((c) => c.symbol !== asset.symbol).slice(0, 7)];

  const [toAsset, setToAsset] = useState(allTargets[0]);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const STABLECOIN_PRICE = { USDT: 1.0, USDC: 1.0 };
  const fromPrice = isFiat ? 1 : (STABLECOIN_PRICE[asset.symbol] ?? cryptoList.find((c) => c.symbol === asset.symbol)?.price ?? 0);
  const toPrice = toAsset.symbol === "USD" ? 1 : (STABLECOIN_PRICE[toAsset.symbol] ?? cryptoList.find((c) => c.symbol === toAsset.symbol)?.price ?? 0);

  const parsed = parseFloat(amount) || 0;
  const usdValue = parsed * fromPrice;
  const toAmount = toPrice > 0 ? usdValue / toPrice : 0;
  const fee = usdValue * 0.005;

  const handleSubmit = async () => {
    if (!parsed || parsed <= 0) { toast.error("Enter a valid amount"); return; }
    if (parsed > balance) { toast.error("Insufficient balance"); return; }
    setSubmitting(true);
    try {
      await createTransaction(portfolioId, {
        type: "WITHDRAWAL",
        symbol: asset.symbol,
        total_amount: usdValue,
        status: "pending",
        notes: `Convert ${parsed} ${asset.symbol} → ${toAmount.toFixed(6)} ${toAsset.symbol}`,
      });
      toast.success(`Conversion submitted! You'll receive ${toAmount.toFixed(6)} ${toAsset.symbol} shortly.`);
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || "Conversion failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {["Select Pair", "Review"].map((label, i) => (
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
            {/* From */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">From</label>
                <span className="text-xs text-muted-foreground">Balance: <button className="text-primary font-semibold" onClick={() => setAmount(balance.toString())}>{isFiat ? fmtUsd(balance) : `${balance} ${asset.symbol}`}</button></span>
              </div>
              <div className="flex items-center gap-2 bg-secondary/40 rounded-xl border border-border p-3">
                <div className={`w-8 h-8 rounded-lg ${asset.bg || "bg-secondary/40"} flex items-center justify-center`}>
                  <span className={`font-bold text-sm ${asset.text || "text-foreground"}`}>{asset.icon || asset.flag}</span>
                </div>
                <span className="font-semibold text-sm">{asset.symbol}</span>
                <input type="number" step="any" min="0" placeholder="0.00" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-transparent text-right text-lg font-bold focus:outline-none text-foreground"
                />
              </div>
              {parsed > balance && <p className="text-xs text-destructive flex items-center gap-1"><Info className="w-3.5 h-3.5" />Exceeds your balance</p>}
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-8 h-8 rounded-full bg-secondary/60 border border-border flex items-center justify-center">
                <Repeat2 className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* To */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">To</label>
              <div className="grid grid-cols-4 gap-2">
                {allTargets.map((t) => (
                  <button key={t.symbol} onClick={() => setToAsset(t)}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all ${
                      toAsset.symbol === t.symbol ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg ${t.bg || "bg-secondary/40"} flex items-center justify-center`}>
                      <span className={`font-bold text-xs ${t.text || "text-foreground"}`}>{t.icon || t.flag}</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground">{t.symbol}</span>
                  </button>
                ))}
              </div>
              {parsed > 0 && toAmount > 0 && (
                <div className="flex items-center gap-2 bg-secondary/40 rounded-xl border border-border p-3 mt-2">
                  <div className={`w-8 h-8 rounded-lg ${toAsset.bg || "bg-secondary/40"} flex items-center justify-center`}>
                    <span className={`font-bold text-sm ${toAsset.text || "text-foreground"}`}>{toAsset.icon || toAsset.flag}</span>
                  </div>
                  <span className="font-semibold text-sm">{toAsset.symbol}</span>
                  <span className="flex-1 text-right text-lg font-bold text-foreground">{toAmount.toFixed(6)}</span>
                </div>
              )}
            </div>

            {parsed > 0 && (
              <div className="bg-secondary/40 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span className="font-mono">1 {asset.symbol} = {toPrice > 0 ? (fromPrice / toPrice).toFixed(6) : "—"} {toAsset.symbol}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fee (0.5%)</span><span className="font-semibold">{fmtUsd(fee)}</span></div>
                <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold"><span>You receive ≈</span><span className="text-emerald-500">{toAmount.toFixed(6)} {toAsset.symbol}</span></div>
              </div>
            )}

            <Button onClick={() => {
              if (!parsed || parsed <= 0) { toast.error("Enter an amount"); return; }
              if (parsed > balance) { toast.error("Insufficient balance"); return; }
              setStep(2);
            }} className="w-full rounded-xl">Review Conversion →</Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversion Summary</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-background rounded-xl p-3 text-center border border-border">
                  <p className="text-xs text-muted-foreground mb-1">You send</p>
                  <p className="text-lg font-bold text-foreground">{parsed} {asset.symbol}</p>
                </div>
                <Repeat2 className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 bg-background rounded-xl p-3 text-center border border-border">
                  <p className="text-xs text-muted-foreground mb-1">You receive ≈</p>
                  <p className="text-lg font-bold text-emerald-500">{toAmount.toFixed(6)} {toAsset.symbol}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Exchange Rate</span><span className="font-mono">1 {asset.symbol} = {(fromPrice / toPrice).toFixed(6)} {toAsset.symbol}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fee (0.5%)</span><span>{fmtUsd(fee)}</span></div>
              </div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-2">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-400">Final rate may vary slightly. Conversion is processed within minutes.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 rounded-xl" disabled={submitting}>← Back</Button>
              <Button onClick={handleSubmit} className="flex-1 rounded-xl" disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Converting…</> : "Confirm Conversion"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION SHEET (slide-up modal)
// ─────────────────────────────────────────────────────────────────────────────
function ActionSheet({ title, onClose, children }) {
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
        className="bg-card border border-border w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AssetDetail Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AssetDetail() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cashBalance, portfolioId } = usePortfolio();
  const { cryptoList } = useLivePrices();
  const queryClient = useQueryClient();

  const isFiat = type === "fiat";
  const asset = isFiat
    ? FIAT_CURRENCIES.find((f) => f.symbol === id)
    : CRYPTO_ASSETS.find((c) => c.symbol === id);

  const [activeFlow, setActiveFlow] = useState(null); // "deposit" | "withdraw" | "transfer" | "convert"
  const [depositsTab, setDepositsTab] = useState("deposit"); // "deposit" | "history"

  const { data: wallets = [] } = useQuery({
    queryKey: ["master_wallets"],
    queryFn: getMasterWallets,
    staleTime: 5 * 60 * 1000,
    enabled: !isFiat,
  });

  const { data: cryptoBalances = [] } = useQuery({
    queryKey: ["user_crypto_balances", user?.id],
    queryFn: () => getUserCryptoBalances(user?.id),
    enabled: !!user?.id && !isFiat,
  });

  const { data: deposits = [] } = useQuery({
    queryKey: ["user_deposits", user?.id],
    queryFn: () => getUserDeposits(user?.id),
    enabled: !!user?.id && !isFiat,
  });

  const wallet = wallets.find((w) => w.asset === id);
  const cryptoBalance = parseFloat(cryptoBalances.find((b) => b.asset === id)?.balance ?? 0);
  const balance = isFiat ? (id === "USD" ? cashBalance : 0) : cryptoBalance;

  const liveData = useMemo(() => {
    if (isFiat) return null;
    if (id === "USDT" || id === "USDC") return { price: 1, change24h: 0 };
    return cryptoList.find((c) => c.symbol === id) || null;
  }, [cryptoList, id, isFiat]);

  const usdValue = isFiat
    ? (id === "USD" ? balance : 0)
    : balance * (liveData?.price ?? 0);

  const handleFlowSuccess = () => {
    setActiveFlow(null);
    queryClient.invalidateQueries(["user_deposits", user?.id]);
    queryClient.invalidateQueries(["user_crypto_balances", user?.id]);
    if (!isFiat) setDepositsTab("history");
  };

  if (!asset) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Asset not found.</p>
        <button onClick={() => navigate("/assets")} className="mt-4 text-primary hover:underline text-sm">← Back to Assets</button>
      </div>
    );
  }

  const assetDeposits = deposits.filter((d) => d.asset === id);

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <button onClick={() => navigate("/assets")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Assets
      </button>

      {/* Asset header card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className={`w-14 h-14 rounded-2xl ${asset.bg || "bg-secondary/40"} flex items-center justify-center text-2xl`}>
            {isFiat ? asset.flag : <span className={`font-bold ${asset.text}`}>{asset.icon}</span>}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{asset.name}</h1>
            <p className="text-sm text-muted-foreground">{asset.symbol} {isFiat ? "· Fiat Currency" : "· Cryptocurrency"}</p>
          </div>
          {!isFiat && liveData && (
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">
                {liveData.price >= 1000
                  ? `$${liveData.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : liveData.price >= 1 ? `$${liveData.price.toFixed(4)}`
                  : `$${liveData.price.toFixed(6)}`}
              </p>
              <p className={`text-xs font-medium flex items-center justify-end gap-0.5 ${liveData.change24h >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {liveData.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {liveData.change24h >= 0 ? "+" : ""}{liveData.change24h.toFixed(2)}%
              </p>
            </div>
          )}
        </div>

        {/* Balance */}
        <div className="bg-secondary/30 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Your {asset.symbol} Balance</p>
          {isFiat ? (
            <p className="text-2xl font-bold text-foreground tabular-nums">{fmtUsd(balance)}</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {balance > 0 ? balance.toFixed(8).replace(/\.?0+$/, "") : "0"} <span className="text-base font-normal text-muted-foreground">{asset.symbol}</span>
              </p>
              {usdValue > 0 && <p className="text-sm text-muted-foreground mt-0.5">{fmtUsd(usdValue)}</p>}
            </>
          )}
        </div>
      </motion.div>

      {/* 4 Action Buttons */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-4 gap-3">
        {[
          { id: "deposit",  label: "Deposit",  icon: ArrowDownToLine, color: "text-emerald-500", bg: "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20" },
          { id: "withdraw", label: "Withdraw", icon: ArrowUpFromLine,  color: "text-red-500",     bg: "bg-red-500/10 hover:bg-red-500/20 border-red-500/20" },
          { id: "transfer", label: "Transfer", icon: ArrowLeftRight,   color: "text-blue-500",    bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20" },
          { id: "convert",  label: "Convert",  icon: Repeat2,          color: "text-purple-500",  bg: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20" },
        ].map(({ id: actionId, label, icon: Icon, color, bg }) => (
          <button
            key={actionId}
            onClick={() => setActiveFlow(actionId)}
            className={`flex flex-col items-center gap-2 py-4 rounded-2xl border transition-all ${bg}`}
          >
            <div className={`w-9 h-9 rounded-xl ${bg.split(" ")[0]} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <span className={`text-xs font-semibold ${color}`}>{label}</span>
          </button>
        ))}
      </motion.div>

      {/* Deposit history (crypto only) */}
      {!isFiat && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex border-b border-border">
            {[{ id: "deposit", label: "Deposit" }, { id: "history", label: `History${assetDeposits.length > 0 ? ` (${assetDeposits.length})` : ""}` }].map(({ id: tabId, label }) => (
              <button key={tabId} onClick={() => setDepositsTab(tabId)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
                  depositsTab === tabId ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {label}
              </button>
            ))}
          </div>

          {depositsTab === "deposit" && (
            <div className="p-5">
              <CryptoDepositFlow
                asset={asset}
                wallet={wallet}
                userId={user?.id}
                onClose={() => {}}
                onSuccess={handleFlowSuccess}
              />
            </div>
          )}

          {depositsTab === "history" && (
            <div>
              {assetDeposits.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <Clock className="w-8 h-8 text-muted-foreground/25 mx-auto" />
                  <p className="text-sm text-muted-foreground">No deposit history yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {assetDeposits.map((deposit) => {
                    const cfg = STATUS_CONFIG[deposit.status] || STATUS_CONFIG.pending;
                    const StatusIcon = cfg.icon;
                    return (
                      <div key={deposit.id} className="flex items-start gap-3 p-4 hover:bg-secondary/20 transition-colors">
                        <div className={`w-9 h-9 rounded-xl ${asset.bg || "bg-secondary/40"} flex items-center justify-center shrink-0`}>
                          <span className={`font-bold text-sm ${asset.text || "text-foreground"}`}>{asset.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {parseFloat(deposit.amount).toFixed(8).replace(/\.?0+$/, "")} {deposit.asset}
                            </p>
                            <span className="text-xs text-muted-foreground">{deposit.network}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                              <StatusIcon className="w-3 h-3" />{cfg.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(deposit.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          {deposit.admin_note && (
                            <p className="text-xs text-muted-foreground mt-1.5 italic">"{deposit.admin_note}"</p>
                          )}
                        </div>
                        {deposit.proof_url && (
                          <DepositProofButton deposit={deposit} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Action Sheets */}
      <AnimatePresence>
        {activeFlow === "deposit" && (
          <ActionSheet title={`Deposit ${asset.symbol}`} onClose={() => setActiveFlow(null)}>
            {isFiat ? (
              <FiatDepositFlow currency={asset} userId={user?.id} portfolioId={portfolioId} onClose={() => setActiveFlow(null)} onSuccess={handleFlowSuccess} />
            ) : (
              <CryptoDepositFlow asset={asset} wallet={wallet} userId={user?.id} onClose={() => setActiveFlow(null)} onSuccess={handleFlowSuccess} />
            )}
          </ActionSheet>
        )}

        {activeFlow === "withdraw" && (
          <ActionSheet title={`Withdraw ${asset.symbol}`} onClose={() => setActiveFlow(null)}>
            <WithdrawFlow asset={asset} isFiat={isFiat} balance={balance} portfolioId={portfolioId} onClose={() => setActiveFlow(null)} onSuccess={handleFlowSuccess} />
          </ActionSheet>
        )}

        {activeFlow === "transfer" && (
          <ActionSheet title={`Transfer ${asset.symbol}`} onClose={() => setActiveFlow(null)}>
            <TransferFlow asset={asset} isFiat={isFiat} balance={balance} portfolioId={portfolioId} onClose={() => setActiveFlow(null)} onSuccess={handleFlowSuccess} />
          </ActionSheet>
        )}

        {activeFlow === "convert" && (
          <ActionSheet title={`Convert ${asset.symbol}`} onClose={() => setActiveFlow(null)}>
            <ConvertFlow asset={asset} isFiat={isFiat} balance={balance} portfolioId={portfolioId} cryptoList={cryptoList} onClose={() => setActiveFlow(null)} onSuccess={handleFlowSuccess} />
          </ActionSheet>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Proof viewer button (small helper)
// ─────────────────────────────────────────────────────────────────────────────
function DepositProofButton({ deposit }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  return (
    <button onClick={async () => {
      if (url) { window.open(url, "_blank"); return; }
      setLoading(true);
      try { const u = await getDepositProofUrl(deposit.proof_url); setUrl(u); window.open(u, "_blank"); }
      catch { toast.error("Could not load proof"); }
      finally { setLoading(false); }
    }} className="shrink-0 p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
    </button>
  );
}
