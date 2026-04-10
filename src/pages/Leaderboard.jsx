import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { generateMockUsers, getLeaderboardOverrides, applyOverrides } from "@/lib/api/leaderboard";
import { fmtUsd } from "@/lib/formatters";
import {
  Trophy, Medal, TrendingUp, BarChart3, Users, ChevronUp, ChevronDown,
  Crown, Star, Zap, Search, Filter,
} from "lucide-react";

const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };
const RING  = {
  1: "ring-2 ring-yellow-400/60 bg-gradient-to-br from-yellow-500/10 to-amber-500/5",
  2: "ring-2 ring-slate-300/60 bg-gradient-to-br from-slate-400/10 to-slate-500/5",
  3: "ring-2 ring-amber-600/60 bg-gradient-to-br from-amber-700/10 to-orange-600/5",
};
const RANK_COLOR = {
  1: "text-yellow-400 font-black",
  2: "text-slate-300 font-black",
  3: "text-amber-600 font-black",
};

const TABS = [
  { id: "all",  label: "All Time" },
  { id: "30d",  label: "30 Days" },
  { id: "7d",   label: "7 Days" },
];

// multipliers for time-period views (cosmetic only — scales mock data)
const TAB_FACTOR = { all: 1, "30d": 0.28, "7d": 0.07 };

export default function Leaderboard() {
  const { user } = useAuth();
  const [tab, setTab]         = useState("all");
  const [search, setSearch]   = useState("");
  const [sortKey, setSortKey] = useState("rank");
  const [sortDir, setSortDir] = useState("asc");

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["leaderboard_overrides"],
    queryFn: getLeaderboardOverrides,
    staleTime: 30_000,
  });

  const board = useMemo(() => {
    if (!overrides) return [];
    const mock = generateMockUsers();
    const entries = applyOverrides(mock, overrides);
    const f = TAB_FACTOR[tab];
    return entries.map(e => ({
      ...e,
      totalProfit: Math.round(e.totalProfit * f),
      profitPct:   Math.round(e.profitPct * f * 10) / 10,
    }));
  }, [overrides, tab]);

  const filtered = useMemo(() => {
    let list = search.trim()
      ? board.filter(e =>
          e.name?.toLowerCase().includes(search.toLowerCase()) ||
          e.displayName?.toLowerCase().includes(search.toLowerCase())
        )
      : board;

    if (sortKey !== "rank") {
      list = [...list].sort((a, b) => {
        const va = a[sortKey] ?? 0;
        const vb = b[sortKey] ?? 0;
        return sortDir === "asc" ? va - vb : vb - va;
      });
    }
    return list;
  }, [board, search, sortKey, sortDir]);

  const top3  = board.slice(0, 3);
  const rest  = filtered.filter(e => e.rank > 3);
  const total = board.length;

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "rank" ? "asc" : "desc"); }
  };

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <span className="opacity-20">↕</span>;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-7 h-7 text-yellow-400" />
          <h1 className="text-3xl font-black text-foreground tracking-tight">Leaderboard</h1>
          <Trophy className="w-7 h-7 text-yellow-400" />
        </div>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Compete with {total} traders worldwide. Track the top earners and climb the ranks.
        </p>
        <div className="flex items-center justify-center gap-6 pt-2">
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{total.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Active Traders</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{fmtUsd(board.reduce((s, e) => s + e.portfolio, 0), true)}</p>
            <p className="text-[11px] text-muted-foreground">Total Volume</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{fmtUsd(board.reduce((s, e) => s + e.totalProfit, 0), true)}</p>
            <p className="text-[11px] text-muted-foreground">Total Profits</p>
          </div>
        </div>
      </motion.div>

      {/* ── Time tabs ── */}
      <div className="flex gap-1 bg-secondary/40 rounded-xl p-1 w-fit mx-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Podium top 3 ── */}
      <div className="grid grid-cols-3 gap-4 items-end">
        {/* 2nd place */}
        {top3[1] && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`rounded-2xl p-5 border border-border/50 ${RING[2]} text-center`}
          >
            <div className="text-3xl mb-2">{top3[1].avatar}</div>
            <div className="text-2xl mb-1">🥈</div>
            <p className="font-bold text-sm text-foreground truncate">{top3[1].displayName}</p>
            <p className="text-xs text-muted-foreground">{top3[1].name}</p>
            {top3[1].badge && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full mt-1 inline-block">{top3[1].badge}</span>}
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-lg font-black text-foreground">{fmtUsd(top3[1].portfolio * TAB_FACTOR[tab], true)}</p>
              <p className="text-xs text-emerald-500 font-semibold">+{fmtUsd(top3[1].totalProfit, true)}</p>
            </div>
          </motion.div>
        )}

        {/* 1st place — tallest */}
        {top3[0] && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`rounded-2xl p-6 border border-border/50 ${RING[1]} text-center relative`}
          >
            <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 text-yellow-400 drop-shadow" />
            <div className="text-4xl mb-2">{top3[0].avatar}</div>
            <div className="text-3xl mb-1">🥇</div>
            <p className="font-bold text-base text-foreground truncate">{top3[0].displayName}</p>
            <p className="text-xs text-muted-foreground">{top3[0].name}</p>
            {top3[0].badge && <span className="text-[10px] bg-yellow-400/10 text-yellow-500 px-2 py-0.5 rounded-full mt-1 inline-block font-semibold">{top3[0].badge}</span>}
            <div className="mt-4 pt-4 border-t border-yellow-400/20">
              <p className="text-2xl font-black text-foreground">{fmtUsd(top3[0].portfolio * TAB_FACTOR[tab], true)}</p>
              <p className="text-sm text-emerald-500 font-bold">+{fmtUsd(top3[0].totalProfit, true)}</p>
              <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-muted-foreground">
                <span>{top3[0].winRate}% win</span>
                <span>·</span>
                <span>{top3[0].trades.toLocaleString()} trades</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* 3rd place */}
        {top3[2] && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className={`rounded-2xl p-5 border border-border/50 ${RING[3]} text-center`}
          >
            <div className="text-3xl mb-2">{top3[2].avatar}</div>
            <div className="text-2xl mb-1">🥉</div>
            <p className="font-bold text-sm text-foreground truncate">{top3[2].displayName}</p>
            <p className="text-xs text-muted-foreground">{top3[2].name}</p>
            {top3[2].badge && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full mt-1 inline-block">{top3[2].badge}</span>}
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-lg font-black text-foreground">{fmtUsd(top3[2].portfolio * TAB_FACTOR[tab], true)}</p>
              <p className="text-xs text-emerald-500 font-semibold">+{fmtUsd(top3[2].totalProfit, true)}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Search + Table ── */}
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
        {/* toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/30 flex-wrap">
          <div className="flex items-center gap-2 bg-secondary/40 rounded-xl px-3 py-2 flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search traders…"
              className="bg-transparent text-sm outline-none flex-1 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{filtered.length} traders</span>
          </div>
        </div>

        {/* table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider w-14">
                  <button onClick={() => handleSort("rank")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    # <SortIcon k="rank" />
                  </button>
                </th>
                <th className="text-left px-3 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Trader</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden sm:table-cell">
                  <button onClick={() => handleSort("portfolio")} className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors">
                    Portfolio <SortIcon k="portfolio" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <button onClick={() => handleSort("totalProfit")} className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors">
                    Profit <SortIcon k="totalProfit" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden md:table-cell">
                  <button onClick={() => handleSort("winRate")} className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors">
                    Win % <SortIcon k="winRate" />
                  </button>
                </th>
                <th className="text-right px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider hidden lg:table-cell">
                  <button onClick={() => handleSort("trades")} className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors">
                    Trades <SortIcon k="trades" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {rest.map((entry, idx) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(idx * 0.008, 0.4) }}
                  className="hover:bg-secondary/20 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <span className={`tabular-nums text-sm ${RANK_COLOR[entry.rank] || "text-muted-foreground"}`}>
                      {MEDAL[entry.rank] || `#${entry.rank}`}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-lg shrink-0">
                        {entry.avatar}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm text-foreground truncate">{entry.displayName}</p>
                          {entry.badge && (
                            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold hidden sm:inline-flex shrink-0">
                              {entry.badge}
                            </span>
                          )}
                          {entry.isInjected && (
                            <span className="text-[9px] bg-yellow-400/10 text-yellow-500 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                              ★ Featured
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{entry.country} {entry.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                    <span className="font-semibold text-sm tabular-nums">{fmtUsd(entry.portfolio * TAB_FACTOR[tab], true)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="font-semibold text-sm text-emerald-500 tabular-nums">
                      +{fmtUsd(entry.totalProfit, true)}
                    </span>
                    <p className="text-[10px] text-emerald-500/70">+{entry.profitPct}%</p>
                  </td>
                  <td className="px-4 py-3.5 text-right hidden md:table-cell">
                    <span className={`text-sm font-semibold tabular-nums ${
                      entry.winRate >= 60 ? "text-emerald-500" : entry.winRate >= 50 ? "text-foreground" : "text-orange-400"
                    }`}>
                      {entry.winRate}%
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {entry.trades.toLocaleString()}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No traders match your search</p>
          </div>
        )}
      </div>
    </div>
  );
}
