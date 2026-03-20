import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, X } from "lucide-react";

export default function ActivityNotifications() {
  const [notifications, setNotifications] = useState([]);
  const seenIds = useRef(new Set());

  useEffect(() => {
    const unsubscribe = base44.entities.Transaction.subscribe((event) => {
      if (event.type === "create" && !seenIds.current.has(event.id)) {
        seenIds.current.add(event.id);
        const tx = event.data;
        const notif = {
          id: event.id,
          label: tx.type === "withdrawal"
            ? `Withdrawal of $${tx.amount?.toLocaleString()} submitted`
            : `${tx.side === "buy" ? "Bought" : "Sold"} ${tx.amount} ${tx.crypto_symbol}`,
          isBuy: tx.side === "buy",
          isWithdrawal: tx.type === "withdrawal",
        };
        setNotifications((prev) => [notif, ...prev].slice(0, 5));
        // Auto-dismiss after 6 seconds
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== event.id));
        }, 6000);
      }
    });
    return () => unsubscribe();
  }, []);

  const dismiss = (id) => setNotifications((prev) => prev.filter((n) => n.id !== id));

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            className="flex items-center gap-3 bg-card border border-border/60 shadow-xl rounded-xl px-4 py-3 pointer-events-auto min-w-[280px]"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              n.isWithdrawal ? "bg-primary/10" : n.isBuy ? "bg-primary/10" : "bg-destructive/10"
            }`}>
              {n.isWithdrawal || n.isBuy
                ? <ArrowDownLeft className="w-4 h-4 text-primary" />
                : <ArrowUpRight className="w-4 h-4 text-destructive" />}
            </div>
            <p className="text-sm font-medium flex-1">{n.label}</p>
            <button
              onClick={() => dismiss(n.id)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}