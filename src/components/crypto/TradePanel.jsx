import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { ArrowUpDown, Loader2, Wallet, PlusCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { executeTrade } from "@/lib/api/portfolio";
import { usePortfolio } from "@/contexts/PortfolioContext";
import DepositDialog from "@/components/crypto/DepositDialog";
import { toast } from "sonner";

export default function TradePanel({ cryptoList = [] }) {
  const [side, setSide] = useState("buy");
  const [amount, setAmount] = useState("");
  const [selectedCoin, setSelectedCoin] = useState("BTC");
  const [isPending, setIsPending] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const { portfolioId, cashBalance, holdingsMap, refetch } = usePortfolio();
  const queryClient = useQueryClient();

  const coin = cryptoList.find((c) => c.symbol === selectedCoin);
  const total = amount && coin ? (parseFloat(amount) * coin.price).toFixed(2) : "0.00";
  const fee = (parseFloat(total) * 0.001 || 0).toFixed(2);
  const currentHolding = holdingsMap[selectedCoin]?.amount || 0;
  const totalCost = parseFloat(total) + parseFloat(fee);
  const insufficientFunds = side === "buy" && parseFloat(amount) > 0 && coin && totalCost > cashBalance;
  const insufficientHoldings = side === "sell" && parseFloat(amount) > 0 && parseFloat(amount) > currentHolding;

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
      queryClient.invalidateQueries({ queryKey: ["trades", portfolioId] });
      toast.success(`${side === "buy" ? "Bought" : "Sold"} ${amount} ${selectedCoin} successfully!`);
      setAmount("");
    } catch (err) {
      toast.error(err.message || "Trade failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-xl border border-border/50 p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Trade</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="w-3.5 h-3.5" />
              <span className={`font-medium ${cashBalance === 0 ? "text-destructive" : "text-foreground"}`}>
                ${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span>cash</span>
            </div>
            <button
              onClick={() => setDepositOpen(true)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              title="Add funds"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </div>

        {cashBalance === 0 && side === "buy" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-4 bg-primary/5 border border-primary/20 rounded-lg p-3 text-center"
          >
            <p className="text-xs text-muted-foreground mb-2">
              Your balance is <span className="text-foreground font-semibold">$0</span>. Add funds to start trading.
            </p>
            <Button
              size="sm"
              onClick={() => setDepositOpen(true)}
              className="bg-primary hover:bg-primary/90 text-xs h-7 px-3"
            >
              <PlusCircle className="w-3 h-3 mr-1" />
              Fund Account
            </Button>
          </motion.div>
        )}

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
            {side === "sell" && (
              <p className={`text-[11px] mt-1 pl-1 ${currentHolding === 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {currentHolding === 0
                  ? `No ${selectedCoin} holdings to sell`
                  : `Available: ${currentHolding.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedCoin}`}
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
              className={`bg-secondary/50 border-border/50 ${
                (insufficientFunds || insufficientHoldings) ? "border-destructive/50" : ""
              }`}
            />
            {side === "sell" && currentHolding > 0 && (
              <button
                onClick={() => setAmount(currentHolding.toFixed(6))}
                className="text-[11px] text-primary hover:underline mt-1 pl-1"
              >
                Max: {currentHolding.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </button>
            )}
          </div>

          <div className="flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Total (USDT)</label>
            <div className={`border rounded-lg px-3 py-2.5 text-sm font-semibold tabular-nums ${
              insufficientFunds ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-secondary/50 border-border/50"
            }`}>
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
              {insufficientFunds && (
                <div className="pt-1 border-t border-border/30 flex justify-between text-xs">
                  <span className="text-destructive font-medium">Shortfall</span>
                  <span className="text-destructive font-semibold">
                    ${(totalCost - cashBalance).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {insufficientFunds && (
            <button
              onClick={() => setDepositOpen(true)}
              className="w-full text-xs text-center text-primary hover:underline"
            >
              Add ${(totalCost - cashBalance).toFixed(2)} more to complete this trade
            </button>
          )}

          <Button
            onClick={handleTrade}
            disabled={isPending || !amount || cryptoList.length === 0 || !portfolioId || insufficientFunds || insufficientHoldings}
            className={`w-full font-semibold ${
              side === "buy"
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            }`}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {insufficientFunds
              ? "Insufficient Funds"
              : insufficientHoldings
              ? "Insufficient Holdings"
              : `${side === "buy" ? "Buy" : "Sell"} ${selectedCoin}`}
          </Button>
        </div>
      </motion.div>

      <DepositDialog open={depositOpen} onClose={() => setDepositOpen(false)} />
    </>
  );
}
