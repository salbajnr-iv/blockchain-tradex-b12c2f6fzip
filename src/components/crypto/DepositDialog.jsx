import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { PlusCircle, CheckCircle2, Loader2, Wallet } from "lucide-react";
import { depositFunds } from "@/lib/api/portfolio";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const PRESETS = [100, 500, 1000, 5000, 10000];

export default function DepositDialog({ open, onClose }) {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { portfolioId, cashBalance, refetch } = usePortfolio();
  const queryClient = useQueryClient();

  const parsedAmount = parseFloat(amount);
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  const handleDeposit = async () => {
    if (!isValid || !portfolioId) return;
    setIsLoading(true);
    try {
      await depositFunds(portfolioId, parsedAmount, cashBalance);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["transactions", portfolioId] });
      setDone(true);
    } catch (err) {
      toast.error(err.message || "Deposit failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setAmount("");
    setDone(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-border/50 bg-card max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-primary" />
            Add Funds
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6 space-y-3"
          >
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <p className="font-semibold text-lg">
              ${parsedAmount.toLocaleString()} deposited!
            </p>
            <p className="text-sm text-muted-foreground">
              New balance: ${(cashBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <Button onClick={handleClose} className="w-full bg-primary hover:bg-primary/90 mt-2">
              Done
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="bg-secondary/30 rounded-xl p-4 flex items-center gap-3 border border-border/40">
              <Wallet className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Current Balance</p>
                <p className="font-bold text-lg">${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Quick amounts</p>
              <div className="grid grid-cols-5 gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(String(preset))}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      amount === String(preset)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  >
                    ${preset >= 1000 ? `${preset / 1000}k` : preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Custom Amount (USD)</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-secondary/50 border-border/50"
                min="1"
                step="0.01"
              />
            </div>

            {isValid && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between text-sm"
              >
                <span className="text-muted-foreground">New balance after deposit</span>
                <span className="font-bold text-primary">
                  ${(cashBalance + parsedAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </motion.div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
              <Button
                onClick={handleDeposit}
                disabled={!isValid || isLoading}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Deposit Funds
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
