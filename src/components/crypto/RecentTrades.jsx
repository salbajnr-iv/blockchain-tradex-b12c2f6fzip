import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";

export default function RecentTrades() {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => base44.entities.Transaction.filter({ type: "trade" }, "-transaction_date", 10),
    initialData: [],
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-card rounded-xl border border-border/50 p-5"
    >
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Recent Trades</h3>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No trades yet. Execute a trade to see it here.</p>
      ) : (
        <div className="space-y-3">
          {transactions.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between py-2 border-b border-border/20 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  trade.side === "buy" ? "bg-primary/10" : "bg-destructive/10"
                }`}>
                  {trade.side === "buy" ? (
                    <ArrowDownLeft className="w-4 h-4 text-primary" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">{trade.crypto_symbol}/USDT</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(trade.transaction_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${trade.side === "buy" ? "text-primary" : "text-destructive"}`}>
                  {trade.side === "buy" ? "+" : "-"}{trade.amount} {trade.crypto_symbol}
                </p>
                <p className="text-xs text-muted-foreground">
                  @${trade.price?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}