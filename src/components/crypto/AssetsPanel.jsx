import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpDown,
  ChevronUp, ChevronDown, PlusCircle, BarChart3,
} from "lucide-react";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useLivePrices } from "@/hooks/useLivePrices";

const COIN_COLORS = {
  BTC: "#F7931A", ETH: "#627EEA", SOL: "#9945FF", BNB: "#F3BA2F",
  XRP: "#00AAE4", ADA: "#0033AD", DOGE: "#C2A633", AVAX: "#E84142",
  USDT: "#26A17B", USDC: "#2775CA", MATIC: "#8247E5", DOT: "#E6007A",
  LINK: "#375BD2", UNI: "#FF007A", ATOM: "#2E3148", LTC: "#BFBBBB",
};

const CASH_COLOR = "#10B981";

function AllocationBar({ segments }) {
  return (
    <div className="flex w-full h-2 rounded-full overflow-hidden gap-0.5">
      {segments.map((seg, i) => (
        <div
          key={i}
          style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
          className="transition-all duration-500 rounded-sm"
          title={`${seg.label}: ${seg.pct.toFixed(1)}%`}
        />
      ))}
    </div>
  );
}

function DonutChart({ segments, total }) {
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = 45;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.pct / 100) * circumference;
    const gap = circumference - dash;
    const arc = { ...seg, dash, gap, offset };
    offset += dash + 1;
    return arc;
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-secondary/40" />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="round"
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[10px] text-muted-foreground">Total</p>
        <p className="text-sm font-bold text-foreground leading-tight">
          ${total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total.toFixed(0)}
        </p>
      </div>
    </div>
  );
}

const SORT_OPTIONS = ["value", "name", "change", "pnl", "alloc"];

export default function AssetsPanel() {
  const { holdings, cashBalance, isLoading: portfolioLoading } = usePortfolio();
  const { cryptoList, isLoading: pricesLoading, portfolioTotal } = useLivePrices();
  const [sort, setSort] = useState("value");
  const [sortDir, setSortDir] = useState("desc");
  const [tab, setTab] = useState("table");

  const isLoading = portfolioLoading || pricesLoading;

  const priceMap = useMemo(() => {
    const map = {};
    cryptoList.forEach((c) => { map[c.symbol] = c; });
    return map;
  }, [cryptoList]);

  const assets = useMemo(() => {
    const holdingAssets = holdings.map((h) => {
      const live = priceMap[h.symbol];
      const currentPrice = live?.price ?? h.current_price ?? 0;
      const currentValue = currentPrice * h.amount;
      const costBasis = h.average_cost * h.amount;
      const pnl = currentValue - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      const change24h = live?.change24h ?? 0;
      return {
        symbol: h.symbol,
        name: h.name || h.symbol,
        amount: h.amount,
        avgCost: h.average_cost,
        currentPrice,
        currentValue,
        pnl,
        pnlPct,
        change24h,
        color: COIN_COLORS[h.symbol] || "#6366F1",
        isCash: false,
      };
    });
    return holdingAssets.filter((a) => a.currentValue > 0.001);
  }, [holdings, priceMap]);

  const cashAsset = useMemo(() => ({
    symbol: "USD",
    name: "US Dollar",
    amount: cashBalance,
    avgCost: 1,
    currentPrice: 1,
    currentValue: cashBalance,
    pnl: 0,
    pnlPct: 0,
    change24h: 0,
    color: CASH_COLOR,
    isCash: true,
  }), [cashBalance]);

  const allAssets = useMemo(() => {
    const list = cashBalance > 0.001 ? [...assets, cashAsset] : [...assets];
    const totalVal = list.reduce((s, a) => s + a.currentValue, 0);
    return list.map((a) => ({ ...a, allocPct: totalVal > 0 ? (a.currentValue / totalVal) * 100 : 0 }));
  }, [assets, cashAsset, cashBalance]);

  const totalValue = useMemo(() => allAssets.reduce((s, a) => s + a.currentValue, 0), [allAssets]);

  const segments = useMemo(() => allAssets
    .filter((a) => a.allocPct >= 0.5)
    .sort((a, b) => b.allocPct - a.allocPct)
    .map((a) => ({ label: a.symbol, pct: a.allocPct, color: a.color })),
    [allAssets]);

  const sorted = useMemo(() => {
    return [...allAssets].sort((a, b) => {
      let cmp = 0;
      if (sort === "value") cmp = a.currentValue - b.currentValue;
      else if (sort === "name") cmp = a.symbol.localeCompare(b.symbol);
      else if (sort === "change") cmp = a.change24h - b.change24h;
      else if (sort === "pnl") cmp = a.pnl - b.pnl;
      else if (sort === "alloc") cmp = a.allocPct - b.allocPct;
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [allAssets, sort, sortDir]);

  const handleSort = (col) => {
    if (sort === col) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSort(col); setSortDir("desc"); }
  };

  const SortIcon = ({ col }) => {
    if (sort !== col) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />;
    return sortDir === "desc" ? <ChevronDown className="w-3 h-3 text-primary" /> : <ChevronUp className="w-3 h-3 text-primary" />;
  };

  const totalPnl = assets.reduce((s, a) => s + a.pnl, 0);
  const totalCostBasis = assets.reduce((s, a) => s + a.avgCost * a.amount, 0);
  const totalPnlPct = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;

  if (isLoading) {
    return (
      <div className="bg-card border border-border/50 rounded-xl">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/30">
          <Wallet className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Assets</span>
        </div>
        <div className="p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-secondary/40 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (allAssets.length === 0) {
    return (
      <div className="bg-card border border-border/50 rounded-xl">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/30">
          <Wallet className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Assets</span>
        </div>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet className="w-7 h-7 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No assets yet</p>
          <p className="text-xs text-muted-foreground/70">Deposit funds or make your first trade to get started</p>
          <Link to="/trade" className="mt-1 inline-flex items-center gap-1.5 text-xs text-primary border border-primary/30 hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors font-medium">
            <PlusCircle className="w-3.5 h-3.5" /> Start Trading
          </Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card border border-border/50 rounded-xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">My Assets</span>
          <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
            {allAssets.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTab("table")}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${tab === "table" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            List
          </button>
          <button
            onClick={() => setTab("chart")}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${tab === "chart" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Allocation
          </button>
          <Link to="/analytics" className="text-xs text-primary hover:text-primary/80 font-medium ml-1">Analytics</Link>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 divide-x divide-border/30 border-b border-border/30">
        <div className="px-5 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Total Value</p>
          <p className="text-base font-bold text-foreground">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="px-5 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Total P&L</p>
          <p className={`text-base font-bold ${totalPnl >= 0 ? "text-primary" : "text-destructive"}`}>
            {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="px-5 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Return</p>
          <div className={`flex items-center gap-1 ${totalPnl >= 0 ? "text-primary" : "text-destructive"}`}>
            {totalPnl >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <p className="text-base font-bold">
              {totalPnl >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Allocation bar */}
      {segments.length > 0 && (
        <div className="px-5 pt-3 pb-2">
          <AllocationBar segments={segments} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {segments.slice(0, 6).map((seg) => (
              <div key={seg.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-[10px] text-muted-foreground">{seg.label} {seg.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "chart" ? (
        <div className="p-5">
          <div className="flex items-center gap-6 flex-wrap">
            <DonutChart segments={segments} total={totalValue} />
            <div className="flex-1 space-y-2.5 min-w-0">
              {allAssets.sort((a, b) => b.allocPct - a.allocPct).map((asset) => (
                <div key={asset.symbol} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: asset.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="text-xs font-semibold text-foreground">{asset.symbol}</span>
                      <span className="text-xs text-muted-foreground">{asset.allocPct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary/40 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${asset.allocPct}%`, backgroundColor: asset.color }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-foreground shrink-0 w-20 text-right">
                    ${asset.currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-2 border-b border-border/20 bg-secondary/10">
            <button onClick={() => handleSort("name")} className="col-span-3 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
              Asset <SortIcon col="name" />
            </button>
            <div className="col-span-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Holdings</div>
            <button onClick={() => handleSort("change")} className="col-span-2 flex items-center justify-end gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
              24h <SortIcon col="change" />
            </button>
            <button onClick={() => handleSort("value")} className="col-span-2 flex items-center justify-end gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
              Value <SortIcon col="value" />
            </button>
            <button onClick={() => handleSort("pnl")} className="col-span-2 flex items-center justify-end gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
              P&L <SortIcon col="pnl" />
            </button>
            <button onClick={() => handleSort("alloc")} className="col-span-1 flex items-center justify-end gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
              % <SortIcon col="alloc" />
            </button>
          </div>

          <div className="divide-y divide-border/20">
            {sorted.map((asset, idx) => {
              const isPos24h = asset.change24h >= 0;
              const isPnlPos = asset.pnl >= 0;
              const rowContent = (
                <div className="flex sm:grid sm:grid-cols-12 sm:gap-2 items-center px-5 py-3.5 hover:bg-secondary/20 transition-colors group">
                  <div className="sm:col-span-3 flex items-center gap-3 flex-1 sm:flex-none min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
                      style={{ backgroundColor: asset.color }}
                    >
                      {asset.isCash ? "$" : asset.symbol.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight">{asset.symbol}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{asset.name}</p>
                    </div>
                  </div>

                  <div className="sm:col-span-2 text-right hidden sm:block">
                    <p className="text-sm text-foreground font-medium tabular-nums">
                      {asset.isCash
                        ? `$${asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : Number(asset.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </p>
                    {!asset.isCash && (
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        @${asset.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: asset.avgCost > 100 ? 2 : 4 })}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2 text-right hidden sm:block">
                    {asset.isCash ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${isPos24h ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                        {isPos24h ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                        {Math.abs(asset.change24h).toFixed(2)}%
                      </span>
                    )}
                  </div>

                  <div className="sm:col-span-2 text-right ml-auto sm:ml-0">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      ${asset.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground tabular-nums hidden sm:block">
                      {asset.isCash ? "Cash" : `$${asset.currentPrice.toLocaleString(undefined, { maximumFractionDigits: asset.currentPrice > 100 ? 2 : 4 })}`}
                    </p>
                  </div>

                  <div className="sm:col-span-2 text-right hidden sm:block">
                    {asset.isCash ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <>
                        <p className={`text-sm font-semibold tabular-nums ${isPnlPos ? "text-primary" : "text-destructive"}`}>
                          {isPnlPos ? "+" : ""}{asset.pnlPct.toFixed(2)}%
                        </p>
                        <p className={`text-[10px] tabular-nums ${isPnlPos ? "text-primary/70" : "text-destructive/70"}`}>
                          {isPnlPos ? "+" : ""}${asset.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="sm:col-span-1 text-right hidden sm:block">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">{asset.allocPct.toFixed(1)}%</span>
                      <div className="w-12 h-1 bg-secondary/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${asset.allocPct}%`, backgroundColor: asset.color }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );

              return (
                <motion.div
                  key={asset.symbol}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  {asset.isCash ? rowContent : (
                    <Link to={`/trade?coin=${asset.symbol}`}>{rowContent}</Link>
                  )}
                </motion.div>
              );
            })}
          </div>

          <div className="px-5 py-3 border-t border-border/20 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{assets.length} crypto asset{assets.length !== 1 ? "s" : ""} + cash balance</span>
            <Link to="/trade" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
              <BarChart3 className="w-3 h-3" /> Trade
            </Link>
          </div>
        </>
      )}
    </motion.div>
  );
}
