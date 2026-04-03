import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PlusCircle, CreditCard, Building2, Wallet2, ChevronLeft,
  CheckCircle2, Loader2, ShieldCheck, AlertCircle,
  UserCheck, Database, Server, RefreshCcw, CircleDollarSign, BadgeCheck, Lock,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { createDepositRequest, processDeposit } from "@/lib/api/deposits";
import AddPaymentMethodDialog from "./AddPaymentMethodDialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const PRESETS = [100, 500, 1000, 5000, 10000];

const PROCESSING_STEPS = [
  { icon: UserCheck,        label: "Verifying account identity",     delay: 0 },
  { icon: ShieldCheck,      label: "Running security check",         delay: 1000 },
  { icon: Database,         label: "Connecting to payment network",  delay: 2200 },
  { icon: Server,           label: "Authorizing payment method",     delay: 3400 },
  { icon: RefreshCcw,       label: "Processing deposit",             delay: 4600 },
  { icon: CircleDollarSign, label: "Crediting your account",         delay: 5600 },
  { icon: BadgeCheck,       label: "Deposit completed",              delay: 6600 },
];

const TYPE_ICON = { card: CreditCard, bank_account: Building2, paypal: Wallet2 };
const BRAND_LABEL = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover" };

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
          <p className="text-xs text-muted-foreground">{method.card_holder_name} · Exp {String(method.expiry_month).padStart(2,"0")}/{String(method.expiry_year).slice(-2)}</p>
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

function ProcessingStep({ step, index, isVisible, isActive, isCompleted, isLast }) {
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
        isLast && isCompleted
          ? "bg-primary/20"
          : isActive
          ? "bg-primary/10"
          : "bg-secondary/60"
      }`}>
        {isActive && !isCompleted ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : isCompleted || !isActive ? (
          isLast && isCompleted
            ? <CheckCircle2 className="w-4 h-4 text-primary" />
            : <Icon className={`w-4 h-4 ${isCompleted ? "text-primary/70" : "text-muted-foreground"}`} />
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
        {isCompleted && !isActive && (
          <CheckCircle2 className="w-4 h-4 text-primary/60" />
        )}
        {isActive && !isCompleted && (
          <span className="text-xs text-primary font-medium">Processing…</span>
        )}
      </div>
    </motion.div>
  );
}

export default function AddFundsFlow({ open, onClose, paymentMethods = [], onMethodAdded, onSuccess }) {
  const { user } = useAuth();
  const { portfolioId, cashBalance, refetch } = usePortfolio();
  const queryClient = useQueryClient();

  const [step, setStep]                   = useState(1);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [amount, setAmount]               = useState("");
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [processingSteps, setProcessingSteps] = useState([]);
  const [processingDone, setProcessingDone]   = useState(false);
  const [refCode, setRefCode]             = useState("");
  const [error, setError]                 = useState("");

  const parsed = parseFloat(amount);
  const isValid = !isNaN(parsed) && parsed >= 10;

  const reset = () => {
    setStep(1); setSelectedMethod(null); setAmount("");
    setProcessingSteps([]); setProcessingDone(false); setRefCode(""); setError("");
  };

  const handleClose = () => { if (step === 4) return; reset(); onClose(); };

  const handleMethodAdded = (method) => {
    onMethodAdded?.(method);
    setSelectedMethod(method);
    setStep(2);
  };

  const handleProcess = async () => {
    setStep(4);
    setProcessingSteps([]);
    setProcessingDone(false);
    setError("");

    PROCESSING_STEPS.forEach((s, i) => {
      setTimeout(() => {
        setProcessingSteps(prev => [...prev, i]);
      }, s.delay);
    });

    setTimeout(async () => {
      try {
        const req = await createDepositRequest(portfolioId, user.id, {
          amount:          parsed,
          paymentMethodId: selectedMethod?.id ?? null,
          notes:           `Deposit via ${selectedMethod?.label ?? "payment method"}`,
        });
        const result = await processDeposit(req.id);
        setRefCode(result.reference_code || req.reference_code);
        await refetch();
        queryClient.invalidateQueries({ queryKey: ["deposit-requests", portfolioId] });
        queryClient.invalidateQueries({ queryKey: ["transactions-analytics", portfolioId] });
        setTimeout(() => {
          setProcessingDone(true);
          setStep(5);
          onSuccess?.();
        }, PROCESSING_STEPS[PROCESSING_STEPS.length - 1].delay + 600);
      } catch (err) {
        setError(err.message || "Deposit failed");
        setProcessingDone(true);
        setTimeout(() => setStep(5), 800);
      }
    }, PROCESSING_STEPS[3].delay + 200);
  };

  const totalSteps = PROCESSING_STEPS.length;
  const completedCount = processingDone ? totalSteps : processingSteps.length;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="border-border/50 bg-card max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step > 1 && step < 4 && (
                <button onClick={() => setStep(s => s - 1)} className="mr-1 text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <PlusCircle className="w-5 h-5 text-primary" />
              {step <= 3 ? "Add Funds" : step === 4 ? "Authorizing Deposit" : "Transaction Complete"}
            </DialogTitle>
          </DialogHeader>

          {step <= 3 && (
            <div className="flex gap-1 mb-1">
              {[1,2,3].map(s => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? "bg-primary" : "bg-secondary/50"}`} />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 1: Select payment method */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3 py-2">
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
                    onClick={() => { setSelectedMethod(m); setStep(2); }}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                      selectedMethod?.id === m.id
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-primary/40 hover:bg-primary/5"
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

            {/* Step 2: Amount */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-2">
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
                        onClick={() => setAmount(String(p))}
                        className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          amount === String(p)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                      >
                        ${p >= 1000 ? `${p/1000}k` : p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Custom Amount (USD)</label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Minimum $10.00"
                    min="10"
                    step="0.01"
                    className="bg-secondary/50 border-border/50"
                  />
                  {amount && !isNaN(parsed) && parsed < 10 && (
                    <p className="text-xs text-destructive mt-1">Minimum deposit is $10.00</p>
                  )}
                </div>

                {isValid && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between text-sm"
                  >
                    <span className="text-muted-foreground">Balance after deposit</span>
                    <span className="font-bold text-primary">${(cashBalance + parsed).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </motion.div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                  <Button onClick={() => setStep(3)} disabled={!isValid} className="flex-1 bg-primary hover:bg-primary/90">
                    Review
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 py-2">
                <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deposit Summary</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">${parsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fee</span>
                      <span className="font-semibold text-primary">Free</span>
                    </div>
                    <div className="border-t border-border/50 pt-2 flex justify-between">
                      <span className="font-semibold">You receive</span>
                      <span className="font-bold text-primary text-base">${parsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                  <Button onClick={handleProcess} className="flex-1 bg-primary hover:bg-primary/90 font-semibold">
                    Confirm Deposit
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Processing — professional loader */}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4 space-y-5">
                {/* Header card */}
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-5 text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCcw className="w-7 h-7 text-primary" />
                    </motion.div>
                  </div>
                  <p className="font-bold text-lg text-foreground">
                    ${parsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-muted-foreground">Authorization in progress</p>

                  {/* Progress bar */}
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

                {/* Steps list */}
                <div className="space-y-3 px-1">
                  {PROCESSING_STEPS.map((s, i) => {
                    const isVisible = processingSteps.includes(i);
                    const isNextVisible = processingSteps.includes(i + 1);
                    const isActive = isVisible && !isNextVisible && !processingDone;
                    const isCompleted = isNextVisible || (processingDone && isVisible);
                    const isLast = i === PROCESSING_STEPS.length - 1;
                    return (
                      <ProcessingStep
                        key={i}
                        step={s}
                        index={i}
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
              </motion.div>
            )}

            {/* Step 5: Result */}
            {step === 5 && (
              <motion.div key="s5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center space-y-4">
                {error ? (
                  <>
                    <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                      <AlertCircle className="w-7 h-7 text-destructive" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Deposit Failed</p>
                      <p className="text-sm text-muted-foreground mt-1">{error}</p>
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
                      <p className="font-bold text-xl text-foreground">${parsed.toLocaleString(undefined, { minimumFractionDigits: 2 })} Added</p>
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
                  {error ? "Close" : "Done"}
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
