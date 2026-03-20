import React, { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { usePriceChart } from "@/hooks/usePriceChart";

const timeframes = ["1H", "4H", "1D", "1W", "1M"];
const SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX"];

export default function PriceChart() {
  const [activeTimeframe, setActiveTimeframe] = useState("1D");
  const [selectedSymbol, setSelectedSymbol] = useState("BTC");
  const { chartData, currentPrice, priceChange, isLoading } = usePriceChart(selectedSymbol, activeTimeframe);

  const isPositive = (priceChange || 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-xl border border-border/50 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex gap-1">
              {SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  onClick={() => setSelectedSymbol(sym)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                    selectedSymbol === sym
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : (
              <>
                <span className="text-3xl font-bold tabular-nums">
                  ${currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—"}
                </span>
                <span className={`text-sm font-medium ${isPositive ? "text-primary" : "text-destructive"}`}>
                  {isPositive ? "+" : ""}{priceChange}%
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{selectedSymbol} / USDT • Live</p>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTimeframe === tf
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? "hsl(142, 71%, 45%)" : "hsl(0, 72%, 51%)"} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={isPositive ? "hsl(142, 71%, 45%)" : "hsl(0, 72%, 51%)"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["dataMin - 0.5%", "dataMax + 0.5%"]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 10 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
                }
                width={65}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 7%)",
                  border: "1px solid hsl(220, 16%, 14%)",
                  borderRadius: "12px",
                  color: "hsl(210, 20%, 95%)",
                  fontSize: 13,
                }}
                formatter={(value) => [`$${value?.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, "Price"]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isPositive ? "hsl(142, 71%, 45%)" : "hsl(0, 72%, 51%)"}
                strokeWidth={2}
                fill="url(#priceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}