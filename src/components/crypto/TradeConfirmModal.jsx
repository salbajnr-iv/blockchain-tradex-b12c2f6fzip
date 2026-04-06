import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Clock, Zap } from "lucide-react";

const fmt = (n, d = 2) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function TradeConfirmModal({ open, onConfirm, onCancel, isLoading, data }) {
  if (!data) return null;

  const { side, orderType, symbol, name, quantity, price, fee, total, cashBalance } = data;
  const isBuy = side === "buy";
  const isLimit = orderType === "limit";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-sm bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden z-10"
          >
            {/* Header */}
            <div className={`px-5 pt-5 pb-4 border-b border-border/40 ${isBuy ? "bg-primary/5" : "bg-destructive/5"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isBuy ? "bg-primary/15" : "bg-destructive/15"}`}>
                    {isLimit
                      ? <Clock className={`w-4.5 h-4.5 ${isBuy ? "text-primary" : "text-destructive"}`} />
                      : <Zap className={`w-4.5 h-4.5 ${isBuy ? "text-primary" : "text-destructive"}`} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      Confirm {isLimit ? "Limit" : "Market"} {isBuy ? "Buy" : "Sell"}
                    </p>
                    <p className="text-xs text-muted-foreground">{name} · {symbol}/USDT</p>
                  </div>
                </div>
                <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Order details */}
            <div className="px-5 py-4 space-y-3">
              {isLimit && (
                <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                    This is a <strong>limit order</strong>. It will be queued and automatically executed when the market price {isBuy ? "falls to or below" : "rises to or above"} your target of <strong>${fmt(price)}</strong>.
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                {[
                  { label: "Order Type",    value: isLimit ? "Limit Order" : "Market Order" },
                  { label: "Action",        value: isBuy ? "Buy" : "Sell", color: isBuy ? "text-primary" : "text-destructive" },
                  { label: "Amount",        value: `${fmt(quantity, 6)} ${symbol}` },
                  { label: isLimit ? "Limit Price" : "Market Price", value: `$${fmt(price)}` },
                  { label: "Fee (0.1%)",    value: `$${fmt(fee)}` },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium ${color || "text-foreground"}`}>{value}</span>
                  </div>
                ))}

                <div className="border-t border-border/40 pt-2.5 flex justify-between text-sm">
                  <span className="font-semibold text-foreground">
                    {isBuy ? "Total Cost" : "You Receive"}
                  </span>
                  <span className="font-bold text-foreground tabular-nums">
                    ${fmt(isBuy ? total + fee : total - fee)}
                  </span>
                </div>

                {isBuy && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Balance after</span>
                    <span className={`font-medium tabular-nums ${cashBalance - total - fee < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      ${fmt(Math.max(0, cashBalance - total - fee))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 h-11 rounded-xl border border-border/60 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  isBuy
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                }`}
              >
                {isLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : null}
                {isLoading
                  ? "Processing…"
                  : isLimit
                  ? `Place ${isBuy ? "Buy" : "Sell"} Order`
                  : `Confirm ${isBuy ? "Buy" : "Sell"}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
