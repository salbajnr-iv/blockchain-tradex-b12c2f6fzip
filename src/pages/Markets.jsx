import React, { useState, useMemo, useCallback } from "react";
import { useMarketCoins } from "@/hooks/useMarketCoins";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWatchlist, addToWatchlist, removeFromWatchlist } from "@/lib/api/watchlist";
import { TrendingUp, TrendingDown, Loader2, Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Star, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const SORT_OPTIONS = [
  { key: "rank", label: "#" },
  { key: "name", label: "Asset" },
  { key: "price", label: "Price" },
  { key: "change24h", label: "24h %" },
  { key: "change7d", label: "7d %" },
  { key: "volumeRaw", label: "Volume" },
  { key: "marketCapRaw", label: "Market Cap" },
];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "gainers", label: "Top Gainers" },
  { key: "losers", label: "Top Losers" },
  { key: "top10", label: "Top 10" },
];

function priceFmt(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function ChangeBadge({ value }) {
  if (value === undefined || value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-emerald-500" : "text-red-500"}`}>
      {up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  return direction === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
}

export default function Markets() {
  const { coins, isLoading, error, lastUpdated, refetch } = useMarketCoins();
  const { holdingsMap, portfolioId } = usePortfolio();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortKey, setSortKey] = useState("rank");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: watchlistSymbols = [] } = useQuery({
    queryKey: ["watchlist", portfolioId],
    queryFn: () => getWatchlist(portfolioId),
    enabled: !!portfolioId,
    initialData: [],
  });

  const watchlist = new Set(watchlistSymbols);

  const PER_PAGE = 25;

  const toggleWatch = useCallback(async (symbol, coinName, e) => {
    e.stopPropagation();
    if (!portfolioId) return;
    const isWatched = watchlistSymbols.includes(symbol);
    // Optimistic update
    queryClient.setQueryData(["watchlist", portfolioId], (prev = []) =>
      isWatched ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
    try {
      if (isWatched) {
        await removeFromWatchlist(portfolioId, symbol);
      } else {
        await addToWatchlist(portfolioId, symbol, coinName);
      }
    } catch {
      // Revert on failure
      queryClient.invalidateQueries({ queryKey: ["watchlist", portfolioId] });
    }
  }, [portfolioId, watchlistSymbols, queryClient]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "rank" || key === "name" ? "asc" : "desc"); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let list = [...coins];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    }
    if (filter === "gainers") list = [...list].sort((a, b) => b.change24h - a.change24h).slice(0, 20);
    else if (filter === "losers") list = [...list].sort((a, b) => a.change24h - b.change24h).slice(0, 20);
    else if (filter === "top10") list = list.filter((c) => c.rank <= 10);

    list.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string") va = va.toLowerCase(), vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [coins, search, filter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Live Markets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Top 100 cryptocurrencies by market cap · Powered by CoinGecko
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={refetch}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {!isLoading && coins.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Coins tracked", value: coins.length },
            { label: "Top gainer (24h)", value: `${coins.sort((a, b) => b.change24h - a.change24h)[0]?.symbol} +${coins.sort((a, b) => b.change24h - a.change24h)[0]?.change24h}%`, positive: true },
            { label: "Top loser (24h)", value: `${coins.sort((a, b) => a.change24h - b.change24h)[0]?.symbol} ${coins.sort((a, b) => a.change24h - b.change24h)[0]?.change24h}%`, negative: true },
            { label: "Gainers / Losers", value: `${coins.filter((c) => c.change24h >= 0).length} / ${coins.filter((c) => c.change24h < 0).length}` },
          ].map(({ label, value, positive, negative }) => (
            <div key={label} className="bg-card border border-border/50 rounded-xl px-4 py-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-sm font-bold ${positive ? "text-emerald-500" : negative ? "text-red-500" : "text-foreground"}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search coins by name or symbol..."
            className="w-full bg-card border border-border/50 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary/40 transition-colors text-foreground placeholder:text-muted-foreground"
          />
          {search && (
            <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded bg-secondary/60">✕</button>
          )}
        </div>
        <div className="flex gap-1.5 bg-card border border-border/50 rounded-xl p-1 shrink-0">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setFilter(key); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/50 rounded-xl overflow-hidden"
      >
        {error && (
          <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <span className="text-red-500">⚠</span> Failed to load market data: {error}.{" "}
            <button onClick={refetch} className="text-primary hover:underline">Retry</button>
          </div>
        )}

        {isLoading && !coins.length ? (
          <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm">Loading live market data...</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/20">
                    <th className="w-8 pl-4 py-3" />
                    {SORT_OPTIONS.map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className={`py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors hover:text-foreground ${key === "name" || key === "rank" ? "text-left" : "text-right"} ${sortKey === key ? "text-primary" : "text-muted-foreground"} ${key === "rank" ? "pl-3" : key === "name" ? "pl-2" : "px-4"}`}
                      >
                        <span className={`inline-flex items-center gap-1 ${key !== "name" && key !== "rank" ? "justify-end" : ""}`}>
                          {label}
                          <SortIcon active={sortKey === key} direction={sortDir} />
                        </span>
                      </th>
                    ))}
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3 hidden sm:table-cell">Holdings</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={SORT_OPTIONS.length + 2} className="text-center py-16 text-sm text-muted-foreground">
                        No coins found{search ? ` matching "${search}"` : ""}.
                      </td>
                    </tr>
                  ) : paginated.map((coin, i) => {
                    const holding = holdingsMap[coin.symbol];
                    const holdingValue = holding ? holding.amount * coin.price : 0;
                    const isWatched = watchlist.has(coin.symbol);

                    return (
                      <motion.tr
                        key={coin.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        onClick={() => navigate(`/trade?coin=${coin.symbol}`)}
                        className="border-b border-border/20 hover:bg-secondary/30 transition-colors cursor-pointer group"
                      >
                        {/* Watchlist star */}
                        <td className="pl-4 py-3 w-8">
                          <button
                            onClick={(e) => toggleWatch(coin.symbol, coin.name, e)}
                            className={`transition-colors ${isWatched ? "text-yellow-400" : "text-transparent group-hover:text-muted-foreground/40 hover:text-yellow-400"}`}
                          >
                            <Star className={`w-3.5 h-3.5 ${isWatched ? "fill-yellow-400" : ""}`} />
                          </button>
                        </td>

                        {/* Rank */}
                        <td className="pl-3 py-3 text-xs text-muted-foreground font-mono w-8">{coin.rank}</td>

                        {/* Asset */}
                        <td className="pl-2 pr-4 py-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={coin.image}
                              alt={coin.name}
                              className="w-8 h-8 rounded-full shrink-0"
                              onError={(e) => { e.target.style.display = "none"; }}
                            />
                            <div>
                              <p className="font-semibold text-sm text-foreground">{coin.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{coin.symbol}</p>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="text-right px-4 py-3">
                          <span className="font-semibold text-sm tabular-nums">{priceFmt(coin.price)}</span>
                        </td>

                        {/* 24h % */}
                        <td className="text-right px-4 py-3">
                          <ChangeBadge value={coin.change24h} />
                        </td>

                        {/* 7d % */}
                        <td className="text-right px-4 py-3 hidden sm:table-cell">
                          <ChangeBadge value={coin.change7d} />
                        </td>

                        {/* Volume */}
                        <td className="text-right px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                          ${coin.volume}
                        </td>

                        {/* Market Cap */}
                        <td className="text-right px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                          ${coin.marketCap}
                        </td>

                        {/* Holdings */}
                        <td className="text-right px-4 py-3 hidden sm:table-cell">
                          {holding && holdingValue > 0 ? (
                            <div>
                              <p className="text-sm font-semibold tabular-nums">${holdingValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                              <p className="text-xs text-muted-foreground">{holding.amount.toFixed(6)} {coin.symbol}</p>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/trade?coin=${coin.symbol}`); }}
                              className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Trade <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-border/30">
                <span className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} coins
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs bg-secondary/60 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = page <= 3 ? i + 1 : page + i - 2;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${p === page ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground"}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs bg-secondary/60 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
