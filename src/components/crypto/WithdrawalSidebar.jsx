import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Wallet, CheckCircle2, Loader2, ShieldCheck, Server, Database, RefreshCcw, UserCheck, CircleDollarSign, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTransaction } from "@/lib/api/transactions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const BROKER_STEPS = [
  { icon: UserCheck,        label: "Verifying account identity...",      delay: 0 },
  { icon: ShieldCheck,      label: "Running 2FA security check...",      delay: 1400 },
  { icon: Database,         label: "Fetching wallet balance...",         delay: 2600 },
  { icon: Server,           label: "Connecting to payment gateway...",   delay: 3800 },
  { icon: RefreshCcw,       label: "Processing withdrawal request...",   delay: 5000 },
  { icon: CircleDollarSign, label: "Confirming fund allocation...",      delay: 6400 },
  { icon: BadgeCheck,       label: "Withdrawal submitted successfully!", delay: 7600 },
];

const METHOD_LABELS = {
  bank_transfer: "Bank Transfer",
  crypto_wallet: "Crypto Wallet",
  paypal: "PayPal",
  wire_transfer: "Wire Transfer",
};

export default function WithdrawalSidebar({ open, onClose }) {
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [processingSteps, setProcessingSteps] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingDone, setProcessingDone] = useState(false);
  const queryClient = useQueryClient();

  const fee = amount ? (parseFloat(amount) * 0.02).toFixed(2) : "0.00";
  const netAmount = amount ? (parseFloat(amount) - parseFloat(fee)).toFixed(2) : "0.00";

  const handleSubmit = () => {
    if (!method || !amount || parseFloat(amount) <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsProcessing(true);
    setProcessingDone(false);
    setProcessingSteps([]);

    BROKER_STEPS.forEach((step, i) => {
      setTimeout(() => {
        setProcessingSteps((prev) => [...prev, i]);
        if (i === BROKER_STEPS.length - 1) {
          createTransaction({
            type: "withdrawal",
            amount: parseFloat(amount),
            total_value: parseFloat(amount),
            status: "pending",
            transaction_date: new Date().toISOString(),
            notes: `Withdrawal via ${METHOD_LABELS[method] || method}${walletAddress ? ` — ${walletAddress}` : ""}`,
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            queryClient.invalidateQueries({ queryKey: ["transactions-stats"] });
          }).catch(console.error);
          setIsProcessing(false);
          setProcessingDone(true);
        }
      }, step.delay);
    });
  };

  const handleClose = () => {
    if (isProcessing) return;
    onClose();
    setTimeout(() => {
      setMethod("");
      setAmount("");
      setWalletAddress("");
      setProcessingSteps([]);
      setProcessingDone(false);
    }, 300);
  };

  const showForm = processingSteps.length === 0 && !isProcessing && !processingDone;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-border/50 z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Withdraw Funds</h2>
                  <p className="text-xs text-muted-foreground">Submit a withdrawal request</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose} disabled={isProcessing}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <AnimatePresence mode="wait">
                {showForm && (
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Withdrawal Method <span className="text-destructive">*</span></label>
                      <Select value={method} onValueChange={setMethod}>
                        <SelectTrigger className="bg-secondary/50 border-border">
                          <SelectValue placeholder="Select method..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                          <SelectItem value="crypto_wallet">🔐 Crypto Wallet</SelectItem>
                          <SelectItem value="paypal">💳 PayPal</SelectItem>
                          <SelectItem value="wire_transfer">🌐 Wire Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Amount (USD) <span className="text-destructive">*</span></label>
                      <Input type="number" placeholder="Enter amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-secondary/50 border-border" min="0" step="0.01" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        {method === "crypto_wallet" ? "Wallet Address" : "Account / Reference"}
                        <span className="text-muted-foreground text-xs ml-1">(optional)</span>
                      </label>
                      <Input type="text" placeholder={method === "crypto_wallet" ? "0x..." : "Account number or reference"} value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} className="bg-secondary/50 border-border" />
                    </div>

                    {amount && parseFloat(amount) > 0 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-secondary/30 rounded-xl p-4 border border-border/50 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Withdrawal Amount</span>
                            <span className="font-semibold">${parseFloat(amount).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Processing Fee (2%)</span>
                            <span className="font-semibold text-destructive">-${fee}</span>
                          </div>
                          <div className="border-t border-border/50 pt-2 flex justify-between text-sm">
                            <span className="font-semibold">You Receive</span>
                            <span className="font-bold text-primary">${parseFloat(netAmount).toLocaleString()}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
                      <p className="font-semibold text-foreground text-sm mb-2">ℹ️ Processing Times</p>
                      <p>• Bank Transfer: 1–3 business days</p>
                      <p>• Crypto Wallet: 10–30 minutes</p>
                      <p>• PayPal: Instant – 24 hours</p>
                      <p>• Wire Transfer: 2–5 business days</p>
                    </div>
                  </motion.div>
                )}

                {(isProcessing || processingDone) && (
                  <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <div className="bg-secondary/40 rounded-t-lg px-4 py-2 flex items-center gap-2 border border-border/50 border-b-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-primary/70" />
                      <span className="ml-2 text-xs text-muted-foreground font-mono">broker-terminal — withdrawal</span>
                    </div>
                    <div className="bg-background/60 border border-border/50 border-t-0 rounded-b-lg px-4 py-4 min-h-[220px] font-mono space-y-2">
                      <AnimatePresence>
                        {BROKER_STEPS.map((step, i) => {
                          const Icon = step.icon;
                          const visible = processingSteps.includes(i);
                          const isLast = i === BROKER_STEPS.length - 1;
                          const isActive = visible && !processingSteps.includes(i + 1) && !processingDone;
                          if (!visible) return null;
                          return (
                            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
                              className={`flex items-center gap-3 text-xs ${isLast && processingDone ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                              {isActive ? <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                                : isLast && processingDone ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                                : <Icon className="w-4 h-4 shrink-0 text-primary/60" />}
                              <span className="text-[11px]">&gt; {step.label}</span>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      {isProcessing && (
                        <motion.span className="inline-block w-2 h-3.5 bg-primary ml-1" animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} />
                      )}
                    </div>
                    {processingDone && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center">
                        <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2" />
                        <p className="font-semibold text-foreground">Withdrawal Submitted!</p>
                        <p className="text-xs text-muted-foreground mt-1">Your request is being processed.</p>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {showForm && (
              <div className="px-6 py-4 border-t border-border/50">
                <Button onClick={handleSubmit} className="w-full bg-primary hover:bg-primary/90 font-semibold">
                  <Send className="w-4 h-4 mr-2" />
                  Submit Withdrawal Request
                </Button>
              </div>
            )}

            {processingDone && (
              <div className="px-6 py-4 border-t border-border/50">
                <Button onClick={handleClose} className="w-full bg-primary hover:bg-primary/90">
                  <CheckCircle2 className="w-4 h-4 mr-2" />Done
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
