import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTrades } from "@/lib/api/portfolio";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { supabase } from "@/lib/supabaseClient";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Loader2, Zap } from "lucide-react";

export default function RecentTrades() {
  const { portfolioId } = usePortfolio();
  const queryClient = useQueryClient();

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ["trades", portfolioId],
    queryFn: () => listTrades(portfolioId, 10),
    enabled: !!portfolioId,
    initialData: [],
  });

  // Supabase Realtime — auto-refresh when a new trade is inserted
  useEffect(() => {
    if (!portfolioId) return;

    const channel = supabase
      .channel(`realtime:trades:${portfolioId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trades",
          filter: `portfolio_id=eq.${portfolioId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["trades", portfolioId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [portfolioId, queryClient]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-card rounded-xl border border-border/50 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Trades</h3>
        <div className="flex items-center gap-1 text-[10px] text-primary/70 font-medium">
          <Zap className="w-3 h-3" />
          Live
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : trades.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No trades yet. Execute a trade to see it here.</p>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => {
            const isBuy = trade.type === "BUY";
            return (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between py-2 border-b border-border/20 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isBuy ? "bg-primary/10" : "bg-destructive/10"
                  }`}>
                    {isBuy ? (
                      <ArrowDownLeft className="w-4 h-4 text-primary" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{trade.symbol}/USDT</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(trade.trade_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${isBuy ? "text-primary" : "text-destructive"}`}>
                    {isBuy ? "+" : "-"}{Number(trade.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })} {trade.symbol}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @${Number(trade.unit_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
