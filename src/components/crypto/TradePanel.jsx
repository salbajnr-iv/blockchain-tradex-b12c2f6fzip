import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { ArrowUpDown, Loader2, Wallet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { executeTrade } from "@/lib/api/portfolio";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { toast } from "sonner";

export default function TradePanel({ cryptoList = [] }) {
  const [side, setSide] = useState("buy");
  const [amount, setAmount] = useState("");
  const [selectedCoin, setSelectedCoin] = useState("BTC");
  const [isPending, setIsPending] = useState(false);
  const { portfolioId, cashBalance, holdingsMap, refetch } = usePortfolio();
  const queryClient = useQueryClient();

  const coin = cryptoList.find((c) => c.symbol === selectedCoin);
  const total = amount && coin ? (parseFloat(amount) * coin.price).toFixed(2) : "0.00";
  const fee = (parseFloat(total) * 0.001 || 0).toFixed(2);
  const currentHolding = holdingsMap[selectedCoin]?.amount || 0;

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!portfolioId) {
      toast.error("Portfolio not loaded. Please wait.");
      return;
    }
    if (!coin) {
      toast.error("Selected coin not found");
      return;
    }
    setIsPending(true);
    try {
      await executeTrade(portfolioId, cashBalance, {
        symbol: selectedCoin,
        name: coin.name,
        type: side === "buy" ? "BUY" : "SELL",
        quantity: parseFloat(amount),
        unitPrice: coin.price,
      });

      await refetch();
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${amount} ${selectedCoin} successfully!`);
      setAmount("");
    } catch (err) {
      toast.error(err.message || "Trade failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-card rounded-xl border border-border/50 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Trade</h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wallet className="w-3.5 h-3.5" />
          <span className="font-medium text-foreground">
            ${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          cash
        </div>
      </div>

      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 mb-5">
        <button
          onClick={() => setSide("buy")}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
            side === "buy"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("sell")}
          className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
            side === "sell"
              ? "bg-destructive text-destructive-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sell
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Asset</label>
          <Select value={selectedCoin} onValueChange={setSelectedCoin}>
            <SelectTrigger className="bg-secondary/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cryptoList.map((c) => (
                <SelectItem key={c.symbol} value={c.symbol}>
                  <span className="flex items-center gap-2">
                    <span>{c.icon}</span>
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">({c.symbol})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {side === "sell" && currentHolding > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1 pl-1">
              Available: {currentHolding.toLocaleString(undefined, { maximumFractionDigits: 6 })} {selectedCoin}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Amount ({selectedCoin})</label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-secondary/50 border-border/50"
          />
        </div>

        <div className="flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Total (USDT)</label>
          <div className="bg-secondary/50 border border-border/50 rounded-lg px-3 py-2.5 text-sm font-semibold tabular-nums">
            ${parseFloat(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        {coin && (
          <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Live Price</span>
              <span className="font-medium tabular-nums">${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">24h Change</span>
              <span className={`font-medium ${coin.change24h >= 0 ? "text-primary" : "text-destructive"}`}>
                {coin.change24h >= 0 ? "+" : ""}{coin.change24h}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Fee (0.1%)</span>
              <span className="font-medium">${fee}</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleTrade}
          disabled={isPending || !amount || cryptoList.length === 0 || !portfolioId}
          className={`w-full font-semibold ${
            side === "buy"
              ? "bg-primary hover:bg-primary/90 text-primary-foreground"
              : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          }`}
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          {side === "buy" ? "Buy" : "Sell"} {selectedCoin}
        </Button>
      </div>
    </motion.div>
  );
}
