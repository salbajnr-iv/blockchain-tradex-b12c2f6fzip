import React from "react";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function MarketTable({ cryptoList, isLoading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-card rounded-xl border border-border/50 overflow-hidden"
    >
      <div className="p-5 border-b border-border/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Live Markets</h3>
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/30">
              <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 uppercase tracking-wider">Asset</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3 uppercase tracking-wider">Price</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3 uppercase tracking-wider hidden sm:table-cell">24h Change</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3 uppercase tracking-wider hidden md:table-cell">Volume</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3 uppercase tracking-wider hidden lg:table-cell">Market Cap</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3 uppercase tracking-wider">Holdings</th>
            </tr>
          </thead>
          <tbody>
            {cryptoList.map((coin) => {
              const holdingsValue = coin.holdings * coin.price;
              return (
                <tr
                  key={coin.symbol}
                  className="border-b border-border/20 hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-lg">
                        {coin.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{coin.name}</p>
                        <p className="text-xs text-muted-foreground">{coin.symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-5 py-4">
                    <span className="font-semibold text-sm tabular-nums">
                      ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="text-right px-5 py-4 hidden sm:table-cell">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                      coin.change24h >= 0
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    }`}>
                      {coin.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {coin.change24h >= 0 ? "+" : ""}{coin.change24h}%
                    </div>
                  </td>
                  <td className="text-right px-5 py-4 text-sm text-muted-foreground hidden md:table-cell">${coin.volume}</td>
                  <td className="text-right px-5 py-4 text-sm text-muted-foreground hidden lg:table-cell">${coin.marketCap}</td>
                  <td className="text-right px-5 py-4">
                    <p className="font-semibold text-sm tabular-nums">${holdingsValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">{coin.holdings} {coin.symbol}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}