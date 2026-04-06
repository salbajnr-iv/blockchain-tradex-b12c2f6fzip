import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, ArrowRight, ShieldCheck, Clock, Building2, Bitcoin, CreditCard, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const METHODS = [
  { icon: Building2, label: "Bank Transfer",  desc: "1–3 business days",   value: "bank_transfer" },
  { icon: Bitcoin,   label: "Crypto Wallet",  desc: "10–30 minutes",       value: "crypto_wallet" },
  { icon: CreditCard,label: "PayPal",         desc: "Instant – 24 hours",  value: "paypal" },
  { icon: Globe,     label: "Wire Transfer",  desc: "2–5 business days",   value: "wire_transfer" },
];

export default function WithdrawalSidebar({ open, onClose }) {
  const navigate = useNavigate();

  const handleProceed = (method) => {
    onClose();
    navigate(`/withdrawal${method ? `?method=${method}` : ""}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-border/50 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Withdraw Funds</h2>
                  <p className="text-xs text-muted-foreground">Choose a withdrawal method</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
              {/* KYC notice */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">KYC Verification Required</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your identity must be verified before you can withdraw funds. Complete your KYC in Settings if you haven't already.
                  </p>
                </div>
              </div>

              {/* Method cards */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Select a method to continue</p>
                <div className="space-y-2">
                  {METHODS.map(({ icon: Icon, label, desc, value }) => (
                    <button
                      key={value}
                      onClick={() => handleProceed(value)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/40 hover:bg-secondary/30 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                        <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{label}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="bg-secondary/30 border border-border/30 rounded-xl p-4 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground text-sm mb-2">Important Notes</p>
                <p>• A 2% processing fee applies to all withdrawals.</p>
                <p>• Withdrawal requests are reviewed by our team before processing.</p>
                <p>• Ensure your KYC is approved or your request will not be accepted.</p>
                <p>• Crypto transfers are irreversible — always double-check addresses.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border/50">
              <Button
                onClick={() => handleProceed("")}
                className="w-full bg-primary hover:bg-primary/90 font-semibold"
              >
                Open Full Withdrawal Form
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
