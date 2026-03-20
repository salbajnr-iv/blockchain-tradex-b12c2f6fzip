import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTransactions, createTransaction, updateTransaction } from "@/lib/api/transactions";
import {
  ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle,
  Loader2, Send, Wallet, ShieldCheck, Server, Database,
  RefreshCcw, UserCheck, CircleDollarSign, BadgeCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const BROKER_STEPS = [
  { icon: UserCheck,        label: "Verifying account identity...",          delay: 0 },
  { icon: ShieldCheck,      label: "Running 2FA security check...",          delay: 1400 },
  { icon: Database,         label: "Fetching wallet balance...",             delay: 2600 },
  { icon: Server,           label: "Connecting to payment gateway...",       delay: 3800 },
  { icon: RefreshCcw,       label: "Processing withdrawal request...",       delay: 5000 },
  { icon: CircleDollarSign, label: "Confirming fund allocation...",          delay: 6400 },
  { icon: BadgeCheck,       label: "Withdrawal submitted successfully!",     delay: 7600 },
];

const METHOD_LABELS = {
  bank_transfer: "Bank Transfer",
  crypto_wallet: "Crypto Wallet",
  paypal: "PayPal",
  wire_transfer: "Wire Transfer",
};

export default function Transactions() {
  const [withdrawalDialog, setWithdrawalDialog] = useState(false);
  const [withdrawalMethod, setWithdrawalMethod] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [processingSteps, setProcessingSteps] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingDone, setProcessingDone] = useState(false);

  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => listTransactions(50),
    initialData: [],
  });

  const withdrawalMutation = useMutation({
    mutationFn: async (data) => {
      await createTransaction({
        type: "withdrawal",
        amount: parseFloat(data.amount),
        total_value: parseFloat(data.amount),
        status: "pending",
        transaction_date: new Date().toISOString(),
        notes: `Withdrawal via ${METHOD_LABELS[data.method] || data.method}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const runBrokerSequence = () => {
    if (!withdrawalMethod || !withdrawalAmount) {
      toast.error("Please select a method and enter an amount");
      return;
    }
    setIsProcessing(true);
    setProcessingDone(false);
    setProcessingSteps([]);

    BROKER_STEPS.forEach((step, i) => {
      setTimeout(() => {
        setProcessingSteps((prev) => [...prev, i]);
        if (i === BROKER_STEPS.length - 1) {
          withdrawalMutation.mutate({ method: withdrawalMethod, amount: withdrawalAmount });
          setIsProcessing(false);
          setProcessingDone(true);
        }
      }, step.delay);
    });
  };

  const handleClose = () => {
    if (isProcessing) return;
    setWithdrawalDialog(false);
    setWithdrawalMethod("");
    setWithdrawalAmount("");
    setProcessingSteps([]);
    setProcessingDone(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-primary" />;
      case "pending":   return <Clock className="w-5 h-5 text-yellow-400" />;
      case "failed":    return <XCircle className="w-5 h-5 text-destructive" />;
      default:          return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed": return "bg-primary/10 text-primary";
      case "pending":   return "bg-yellow-400/10 text-yellow-400";
      case "failed":    return "bg-destructive/10 text-destructive";
      default:          return "bg-muted text-muted-foreground";
    }
  };

  const getTypeIcon = (type, side) => {
    if (type === "withdrawal") return <ArrowUpRight className="w-5 h-5 text-primary" />;
    return side === "buy"
      ? <ArrowDownLeft className="w-5 h-5 text-yellow-400" />
      : <ArrowUpRight className="w-5 h-5 text-primary" />;
  };

  const showForm = processingSteps.length === 0 && !isProcessing && !processingDone;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Transactions</h1>
            <p className="text-muted-foreground">Recent trading activity and withdrawal requests</p>
          </div>
          <Button onClick={() => setWithdrawalDialog(true)} className="bg-primary hover:bg-primary/90">
            <Send className="w-4 h-4 mr-2" />
            Withdraw Funds
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx, index) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-card rounded-lg border border-border/50 p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-secondary/50">
                      {getTypeIcon(tx.type, tx.side)}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground capitalize">
                        {tx.type === "withdrawal" ? "Withdrawal" : `${tx.side} ${tx.crypto_symbol}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tx.transaction_date), "MMM d, yyyy • h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {tx.side === "sell" || tx.type === "withdrawal" ? "-" : "+"}
                        {tx.amount} {tx.crypto_symbol || "USD"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${(tx.total_value ?? tx.amount * tx.price)?.toLocaleString()}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${getStatusColor(tx.status)}`}>
                      {getStatusIcon(tx.status)}
                      <span className="text-xs font-medium capitalize">{tx.status}</span>
                    </div>
                  </div>
                </div>
                {tx.notes && (
                  <div className="mt-3 pl-14 text-xs text-muted-foreground italic">{tx.notes}</div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <Dialog open={withdrawalDialog} onOpenChange={handleClose}>
          <DialogContent className="border-border/50 bg-card max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Withdraw Funds
              </DialogTitle>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {showForm && (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Withdrawal Method</label>
                    <Select value={withdrawalMethod} onValueChange={setWithdrawalMethod}>
                      <SelectTrigger className="bg-secondary/50 border-border">
                        <SelectValue placeholder="Select withdrawal method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="crypto_wallet">Crypto Wallet</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Amount (USD)</label>
                    <Input type="number" placeholder="Enter amount" value={withdrawalAmount} onChange={(e) => setWithdrawalAmount(e.target.value)} className="bg-secondary/50 border-border" min="0" step="0.01" />
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Processing Fee</p>
                    <p className="text-sm font-semibold text-foreground">
                      ${withdrawalAmount ? (parseFloat(withdrawalAmount) * 0.02).toFixed(2) : "0.00"} (2%)
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
                    <Button onClick={runBrokerSequence} className="flex-1 bg-primary hover:bg-primary/90">
                      <Send className="w-4 h-4 mr-2" />Submit Request
                    </Button>
                  </div>
                </motion.div>
              )}

              {(isProcessing || processingDone) && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 space-y-3">
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
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                      <Button onClick={handleClose} className="w-full bg-primary hover:bg-primary/90">
                        <CheckCircle2 className="w-4 h-4 mr-2" />Done
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
