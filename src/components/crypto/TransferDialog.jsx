import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  X, ArrowRight, ArrowLeft, Search, CheckCircle2, AlertCircle,
  Loader2, Copy, Users, Wallet, Send, RefreshCw, ChevronRight,
  ShieldCheck, UserCheck,
} from "lucide-react";
import { getMyTransferUid, lookupUserForTransfer, executeTransfer } from "@/lib/api/transfer";

const STEPS = ["recipient", "amount", "confirm", "success"];

function MyTransferIdCard({ onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-transfer-uid"],
    queryFn: getMyTransferUid,
    staleTime: Infinity,
  });

  const handleCopy = () => {
    if (!data?.transfer_uid) return;
    navigator.clipboard.writeText(String(data.transfer_uid)).then(() => {
      toast.success("Transfer ID copied!");
    });
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <UserCheck className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Your Transfer ID</p>
          {isLoading ? (
            <div className="h-5 w-24 bg-secondary/80 rounded animate-pulse mt-0.5" />
          ) : (
            <p className="font-mono font-bold text-foreground text-base tracking-wider">
              {data?.transfer_uid ?? "—"}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={handleCopy}
        disabled={isLoading || !data?.transfer_uid}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg border border-primary/20 hover:bg-primary/5"
      >
        <Copy className="w-3 h-3" />
        Copy
      </button>
    </div>
  );
}

export default function TransferDialog({ open, onClose }) {
  const { user } = useAuth();
  const { cashBalance, portfolioId, refetch: refetchPortfolio } = usePortfolio();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [recipientUid, setRecipientUid] = useState("");
  const [recipient, setRecipient] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const parsedAmount = parseFloat(amount) || 0;
  const hasSufficient = parsedAmount > 0 && parsedAmount <= cashBalance;

  const reset = useCallback(() => {
    setStep(0);
    setRecipientUid("");
    setRecipient(null);
    setLookingUp(false);
    setLookupError("");
    setAmount("");
    setNote("");
    setSubmitting(false);
    setResult(null);
  }, []);

  const handleClose = () => {
    onClose();
    setTimeout(reset, 300);
  };

  const handleLookup = async () => {
    if (!recipientUid.trim()) return;
    setLookingUp(true);
    setLookupError("");
    setRecipient(null);
    try {
      const res = await lookupUserForTransfer(recipientUid.trim());
      if (!res?.found) {
        setLookupError("No active user found with that Transfer ID. Double-check the number and try again.");
      } else {
        setRecipient(res);
      }
    } catch (err) {
      setLookupError(err.message || "Lookup failed. Please try again.");
    } finally {
      setLookingUp(false);
    }
  };

  const handleSubmitTransfer = async () => {
    setSubmitting(true);
    try {
      const res = await executeTransfer(portfolioId, recipient.transfer_uid, parsedAmount, note.trim() || null);
      setResult(res);
      setStep(3);
      queryClient.invalidateQueries({ queryKey: ["transactions", portfolioId] });
      refetchPortfolio();
    } catch (err) {
      toast.error(err.message || "Transfer failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canProceedToAmount = !!recipient;
  const canConfirm = parsedAmount > 0 && hasSufficient;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="bg-card border-border max-w-md p-0 overflow-hidden gap-0">

        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step > 0 && step < 3 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {step === 3 ? "Transfer Complete" : "Send Funds"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step === 0 && "Find recipient by Transfer ID"}
                  {step === 1 && "Enter the amount to send"}
                  {step === 2 && "Review and confirm"}
                  {step === 3 && "Funds sent successfully"}
                </p>
              </div>
            </div>
          </div>

          {step < 3 && (
            <div className="flex gap-1.5 mt-4">
              {["Recipient", "Amount", "Confirm"].map((label, i) => (
                <div key={label} className="flex-1 flex flex-col gap-1">
                  <div className={`h-1 rounded-full transition-all ${i <= step ? "bg-primary" : "bg-secondary"}`} />
                  <p className={`text-[10px] ${i === step ? "text-primary font-semibold" : "text-muted-foreground"}`}>{label}</p>
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60vh]">
          <AnimatePresence mode="wait">

            {step === 0 && (
              <motion.div key="step-0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <MyTransferIdCard />

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Recipient's Transfer ID</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. 10000042"
                      value={recipientUid}
                      onChange={(e) => {
                        setRecipientUid(e.target.value.replace(/\D/g, ""));
                        setRecipient(null);
                        setLookupError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                      className="bg-secondary/40 border-border font-mono"
                      maxLength={12}
                    />
                    <Button
                      onClick={handleLookup}
                      disabled={!recipientUid.trim() || lookingUp}
                      variant="outline"
                      className="shrink-0 px-4 border-primary/30 text-primary hover:bg-primary/5"
                    >
                      {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Enter the 8-digit Transfer ID of the person you want to send funds to.</p>
                </div>

                <AnimatePresence>
                  {lookupError && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-sm text-destructive">{lookupError}</p>
                    </motion.div>
                  )}

                  {recipient && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                          <span className="text-lg font-bold text-primary">
                            {(recipient.display_name || recipient.username)?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-foreground">{recipient.display_name || recipient.username}</p>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          </div>
                          <p className="text-xs text-muted-foreground">@{recipient.username}</p>
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">ID: {recipient.transfer_uid}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-secondary/30 border border-border rounded-xl p-3 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Internal transfers are instant, free, and irreversible. Always verify the recipient's Transfer ID before sending.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="bg-secondary/40 rounded-xl border border-border p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <span className="font-bold text-primary">
                      {(recipient?.display_name || recipient?.username)?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{recipient?.display_name || recipient?.username}</p>
                    <p className="text-xs text-muted-foreground">ID: {recipient?.transfer_uid}</p>
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" />
                    Balance: <span className="font-semibold text-foreground ml-1">${cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Amount (USD) <span className="text-destructive">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">$</span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-secondary/40 border-border pl-7 text-lg font-semibold"
                      min="0.01"
                      step="0.01"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setAmount((cashBalance * pct / 100).toFixed(2))}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 text-muted-foreground hover:text-foreground border border-border transition-colors"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  {parsedAmount > cashBalance && parsedAmount > 0 && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Exceeds available balance
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Note <span className="text-muted-foreground text-xs">(optional)</span></label>
                  <Input
                    placeholder="e.g. Payment for services, Splitting bill..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-secondary/40 border-border"
                    maxLength={120}
                  />
                </div>

                {parsedAmount > 0 && hasSufficient && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-secondary/30 rounded-xl border border-border p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Transfer Amount</span>
                      <span className="font-semibold text-foreground">${parsedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fee</span>
                      <span className="text-green-500 font-semibold">Free</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="text-sm font-semibold">Recipient Gets</span>
                      <span className="font-bold text-lg text-primary">${parsedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <p className="text-sm text-muted-foreground">Please review all details carefully. Transfers are instant and cannot be reversed.</p>

                <div className="bg-secondary/30 rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-secondary/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transfer Details</p>
                  </div>
                  <div className="divide-y divide-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">To</span>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{recipient?.display_name || recipient?.username}</p>
                        <p className="text-xs text-muted-foreground">ID: {recipient?.transfer_uid}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Amount</span>
                      <span className="text-sm font-bold text-primary">${parsedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Fee</span>
                      <span className="text-sm font-semibold text-green-500">Free</span>
                    </div>
                    {note && (
                      <div className="flex items-start justify-between px-4 py-3 gap-4">
                        <span className="text-sm text-muted-foreground shrink-0">Note</span>
                        <span className="text-sm text-foreground text-right">{note}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-muted-foreground">Balance After</span>
                      <span className="text-sm font-semibold text-foreground">
                        ${(cashBalance - parsedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Once confirmed, this transfer is <strong>instant and irreversible</strong>. Make sure the Transfer ID and amount are correct before proceeding.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step-3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 py-2">
                <div className="text-center space-y-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.1, stiffness: 200 }}
                    className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto"
                  >
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </motion.div>
                  <div>
                    <p className="text-xl font-bold text-foreground">Transfer Successful!</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      <span className="font-semibold text-primary">${parsedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> sent to <span className="font-semibold">{result?.recipient_username}</span>
                    </p>
                  </div>
                </div>

                <div className="bg-secondary/30 rounded-xl border border-border p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Recipient</span>
                    <span className="text-foreground font-semibold">{result?.recipient_username}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount Sent</span>
                    <span className="text-foreground font-semibold">${parseFloat(result?.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Transaction ID</span>
                    <span className="font-mono text-xs text-foreground">{result?.out_transaction_id?.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Status</span>
                    <span className="text-green-500 font-semibold">Completed</span>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <div className="px-6 py-4 border-t border-border bg-card">
          {step === 0 && (
            <Button
              className="w-full"
              onClick={() => setStep(1)}
              disabled={!canProceedToAmount}
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === 1 && (
            <Button
              className="w-full"
              onClick={() => setStep(2)}
              disabled={!canConfirm}
            >
              Review Transfer <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === 2 && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1" disabled={submitting}>
                Edit
              </Button>
              <Button onClick={handleSubmitTransfer} disabled={submitting} className="flex-1 bg-primary hover:bg-primary/90">
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />Confirm Transfer</>
                )}
              </Button>
            </div>
          )}
          {step === 3 && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { reset(); }} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" /> New Transfer
              </Button>
              <Button onClick={handleClose} className="flex-1">
                Done
              </Button>
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
