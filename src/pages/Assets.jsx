import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useLivePrices } from "@/hooks/useLivePrices";
import { getUserCryptoBalances } from "@/lib/api/cryptoDeposits";
import { useTheme } from "@/contexts/ThemeContext";
import { fmtUsd, fmtPrice } from "@/lib/formatters";
import {
  Wallet, Search, ChevronRight, TrendingUp, TrendingDown,
  DollarSign, Bitcoin, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";

// ── All supported crypto assets ───────────────────────────────────────────────
export const CRYPTO_ASSETS = [
  { symbol: "BTC",  name: "Bitcoin",         icon: "₿",  color: "#F7931A", bg: "bg-orange-500/10",   text: "text-orange-500",   coinId: "bitcoin" },
  { symbol: "ETH",  name: "Ethereum",        icon: "Ξ",  color: "#627EEA", bg: "bg-blue-500/10",     text: "text-blue-500",     coinId: "ethereum" },
  { symbol: "SOL",  name: "Solana",          icon: "◎",  color: "#9945FF", bg: "bg-purple-500/10",   text: "text-purple-500",   coinId: "solana" },
  { symbol: "BNB",  name: "BNB",             icon: "B",  color: "#F3BA2F", bg: "bg-yellow-500/10",   text: "text-yellow-500",   coinId: "binancecoin" },
  { symbol: "XRP",  name: "XRP",             icon: "✕",  color: "#00AAE4", bg: "bg-sky-500/10",      text: "text-sky-500",      coinId: "ripple" },
  { symbol: "ADA",  name: "Cardano",         icon: "₳",  color: "#0033AD", bg: "bg-blue-600/10",     text: "text-blue-600",     coinId: "cardano" },
  { symbol: "AVAX", name: "Avalanche",       icon: "A",  color: "#E84142", bg: "bg-red-500/10",      text: "text-red-500",      coinId: "avalanche-2" },
  { symbol: "DOGE", name: "Dogecoin",        icon: "Ð",  color: "#C2A633", bg: "bg-yellow-600/10",   text: "text-yellow-600",   coinId: "dogecoin" },
  { symbol: "DOT",  name: "Polkadot",        icon: "●",  color: "#E6007A", bg: "bg-pink-500/10",     text: "text-pink-500",     coinId: "polkadot" },
  { symbol: "MATIC",name: "Polygon",         icon: "M",  color: "#8247E5", bg: "bg-violet-500/10",   text: "text-violet-500",   coinId: "matic-network" },
  { symbol: "LINK", name: "Chainlink",       icon: "⬡",  color: "#375BD2", bg: "bg-indigo-500/10",   text: "text-indigo-500",   coinId: "chainlink" },
  { symbol: "LTC",  name: "Litecoin",        icon: "Ł",  color: "#BFBBBB", bg: "bg-slate-500/10",    text: "text-slate-400",    coinId: "litecoin" },
  { symbol: "ATOM", name: "Cosmos",          icon: "⚛",  color: "#2E3148", bg: "bg-gray-600/10",     text: "text-gray-400",     coinId: "cosmos" },
  { symbol: "UNI",  name: "Uniswap",         icon: "🦄", color: "#FF007A", bg: "bg-pink-600/10",     text: "text-pink-400",     coinId: "uniswap" },
  { symbol: "USDT", name: "Tether",          icon: "₮",  color: "#26A17B", bg: "bg-emerald-500/10",  text: "text-emerald-500",  coinId: "tether" },
  { symbol: "USDC", name: "USD Coin",        icon: "$",  color: "#2775CA", bg: "bg-sky-600/10",      text: "text-sky-500",      coinId: "usd-coin" },
  { symbol: "TRX",  name: "TRON",            icon: "T",  color: "#FF0013", bg: "bg-red-600/10",      text: "text-red-400",      coinId: "tron" },
  { symbol: "TON",  name: "Toncoin",         icon: "💎", color: "#0098EA", bg: "bg-blue-400/10",     text: "text-blue-400",     coinId: "the-open-network" },
  { symbol: "NEAR", name: "NEAR Protocol",   icon: "N",  color: "#00C08B", bg: "bg-emerald-600/10",  text: "text-emerald-400",  coinId: "near" },
  { symbol: "BCH",  name: "Bitcoin Cash",    icon: "Ƀ",  color: "#8DC351", bg: "bg-lime-500/10",     text: "text-lime-500",     coinId: "bitcoin-cash" },
  { symbol: "SHIB", name: "Shiba Inu",       icon: "🐕", color: "#FFA409", bg: "bg-amber-500/10",    text: "text-amber-500",    coinId: "shiba-inu" },
  { symbol: "APT",  name: "Aptos",           icon: "A",  color: "#22D3EE", bg: "bg-cyan-500/10",     text: "text-cyan-500",     coinId: "aptos" },
  { symbol: "ARB",  name: "Arbitrum",        icon: "◈",  color: "#12AAFF", bg: "bg-blue-400/10",     text: "text-blue-300",     coinId: "arbitrum" },
  { symbol: "OP",   name: "Optimism",        icon: "O",  color: "#FF0420", bg: "bg-red-500/10",      text: "text-red-400",      coinId: "optimism" },
];

// ── All supported fiat currencies ─────────────────────────────────────────────
export const FIAT_CURRENCIES = [
  { symbol: "USD", name: "US Dollar",          flag: "🇺🇸", color: "#10B981", bg: "bg-emerald-500/10", text: "text-emerald-500" },
  { symbol: "EUR", name: "Euro",               flag: "🇪🇺", color: "#3B82F6", bg: "bg-blue-500/10",    text: "text-blue-500" },
  { symbol: "GBP", name: "British Pound",      flag: "🇬🇧", color: "#8B5CF6", bg: "bg-violet-500/10",  text: "text-violet-500" },
  { symbol: "AUD", name: "Australian Dollar",  flag: "🇦🇺", color: "#F59E0B", bg: "bg-amber-500/10",   text: "text-amber-500" },
  { symbol: "CAD", name: "Canadian Dollar",    flag: "🇨🇦", color: "#EF4444", bg: "bg-red-500/10",     text: "text-red-500" },
  { symbol: "CHF", name: "Swiss Franc",        flag: "🇨🇭", color: "#F43F5E", bg: "bg-rose-500/10",    text: "text-rose-500" },
  { symbol: "JPY", name: "Japanese Yen",       flag: "🇯🇵", color: "#EC4899", bg: "bg-pink-500/10",    text: "text-pink-500" },
  { symbol: "SGD", name: "Singapore Dollar",   flag: "🇸🇬", color: "#14B8A6", bg: "bg-teal-500/10",    text: "text-teal-500" },
  { symbol: "AED", name: "UAE Dirham",         flag: "🇦🇪", color: "#22C55E", bg: "bg-green-500/10",   text: "text-green-500" },
  { symbol: "INR", name: "Indian Rupee",       flag: "🇮🇳", color: "#F97316", bg: "bg-orange-500/10",  text: "text-orange-500" },
  { symbol: "BRL", name: "Brazilian Real",     flag: "🇧🇷", color: "#84CC16", bg: "bg-lime-500/10",    text: "text-lime-500" },
  { symbol: "MXN", name: "Mexican Peso",       flag: "🇲🇽", color: "#06B6D4", bg: "bg-cyan-500/10",    text: "text-cyan-500" },
  { symbol: "KRW", name: "South Korean Won",   flag: "🇰🇷", color: "#A855F7", bg: "bg-purple-500/10",  text: "text-purple-500" },
  { symbol: "HKD", name: "Hong Kong Dollar",   flag: "🇭🇰", color: "#EF4444", bg: "bg-red-500/10",     text: "text-red-400" },
  { symbol: "NOK", name: "Norwegian Krone",    flag: "🇳🇴", color: "#EF4444", bg: "bg-red-600/10",     text: "text-red-500" },
  { symbol: "SEK", name: "Swedish Krona",      flag: "🇸🇪", color: "#3B82F6", bg: "bg-blue-600/10",    text: "text-blue-400" },
  { symbol: "DKK", name: "Danish Krone",       flag: "🇩🇰", color: "#EF4444", bg: "bg-red-500/10",     text: "text-red-400" },
  { symbol: "NZD", name: "New Zealand Dollar", flag: "🇳🇿", color: "#1D4ED8", bg: "bg-blue-700/10",    text: "text-blue-400" },
  { symbol: "ZAR", name: "South African Rand", flag: "🇿🇦", color: "#22C55E", bg: "bg-green-600/10",   text: "text-green-400" },
  { symbol: "NGN", name: "Nigerian Naira",     flag: "🇳🇬", color: "#22C55E", bg: "bg-green-500/10",   text: "text-green-500" },
  { symbol: "TRY", name: "Turkish Lira",       flag: "🇹🇷", color: "#EF4444", bg: "bg-red-500/10",     text: "text-red-400" },
  { symbol: "CNY", name: "Chinese Yuan",       flag: "🇨🇳", color: "#EF4444", bg: "bg-red-600/10",     text: "text-red-500" },
  { symbol: "THB", name: "Thai Baht",          flag: "🇹🇭", color: "#3B82F6", bg: "bg-blue-500/10",    text: "text-blue-400" },
  { symbol: "MYR", name: "Malaysian Ringgit",  flag: "🇲🇾", color: "#F59E0B", bg: "bg-amber-500/10",   text: "text-amber-400" },
];

const STABLECOIN_PRICE = { USDT: 1.0, USDC: 1.0 };

const SORT_OPTIONS = [
  { key: "default", label: "Default" },
  { key: "name",    label: "Name" },
  { key: "value",   label: "Value" },
  { key: "change",  label: "24h %" },
  { key: "price",   label: "Price" },
];

export default function AssetsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cashBalance } = usePortfolio();
  const { cryptoList } = useLivePrices();
  const { displayPrefs } = useTheme();
  const compact = displayPrefs?.compactNumbers ?? true;
  const showBadges = displayPrefs?.percentageBadges ?? true;
  const animated = displayPrefs?.animatedCharts ?? true;

  const [tab, setTab] = useState("crypto");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("default");
  const [sortDir, setSortDir] = useState("desc");

  const { data: cryptoBalances = [] } = useQuery({
    queryKey: ["user_crypto_balances", user?.id],
    queryFn: () => getUserCryptoBalances(user?.id),
    enabled: !!user?.id,
  });

  const balanceMap = useMemo(
    () => Object.fromEntries(cryptoBalances.map((b) => [b.asset, parseFloat(b.balance)])),
    [cryptoBalances]
  );

  const getPriceData = (symbol) =>
    STABLECOIN_PRICE[symbol] != null
      ? { price: STABLECOIN_PRICE[symbol], change24h: 0 }
      : cryptoList.find((c) => c.symbol === symbol) || null;

  const totalCryptoUsd = useMemo(() => {
    return cryptoBalances.reduce((sum, b) => {
      const price = getPriceData(b.asset)?.price ?? 0;
      return sum + parseFloat(b.balance) * price;
    }, 0);
  }, [cryptoBalances, cryptoList]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  };

  const filteredAndSorted = useMemo(() => {
    let list = CRYPTO_ASSETS.filter(
      (a) =>
        a.symbol.toLowerCase().includes(search.toLowerCase()) ||
        a.name.toLowerCase().includes(search.toLowerCase())
    );

    if (sortKey !== "default") {
      list = [...list].sort((a, b) => {
        const priceA = getPriceData(a.symbol);
        const priceB = getPriceData(b.symbol);
        const balA = balanceMap[a.symbol] ?? 0;
        const balB = balanceMap[b.symbol] ?? 0;

        let va, vb;
        switch (sortKey) {
          case "name":   va = a.name; vb = b.name; break;
          case "value":  va = balA * (priceA?.price ?? 0); vb = balB * (priceB?.price ?? 0); break;
          case "change": va = priceA?.change24h ?? 0; vb = priceB?.change24h ?? 0; break;
          case "price":  va = priceA?.price ?? 0; vb = priceB?.price ?? 0; break;
          default:       va = 0; vb = 0;
        }

        if (typeof va === "string") {
          return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return sortDir === "asc" ? va - vb : vb - va;
      });
    } else {
      // Default: assets with a balance come first
      list = [...list].sort((a, b) => {
        const balA = balanceMap[a.symbol] ?? 0;
        const balB = balanceMap[b.symbol] ?? 0;
        const priceA = getPriceData(a.symbol);
        const priceB = getPriceData(b.symbol);
        const valA = balA * (priceA?.price ?? 0);
        const valB = balB * (priceB?.price ?? 0);
        if (valA !== valB) return valB - valA;
        return 0;
      });
    }

    return list;
  }, [search, sortKey, sortDir, balanceMap, cryptoList]);

  const filteredFiat = useMemo(
    () =>
      FIAT_CURRENCIES.filter(
        (f) =>
          f.symbol.toLowerCase().includes(search.toLowerCase()) ||
          f.name.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Assets</h1>
          <p className="text-sm text-muted-foreground">Manage your crypto and fiat balances</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Fiat Balance</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{fmtUsd(cashBalance, compact)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Available USD</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Crypto Balance</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{fmtUsd(totalCryptoUsd, compact)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{cryptoBalances.length} asset{cryptoBalances.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets or currencies..."
          className="w-full pl-10 pr-4 py-2.5 bg-secondary/40 border border-border rounded-xl text-sm focus:outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/40 rounded-xl p-1">
        {[
          { id: "crypto", label: "Crypto Assets", icon: Bitcoin },
          { id: "fiat",   label: "Fiat Currencies", icon: DollarSign },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Crypto list */}
      {tab === "crypto" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {filteredAndSorted.length} Cryptocurrencies
            </p>
            {/* Sort controls */}
            <div className="flex items-center gap-1 flex-wrap">
              {SORT_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleSort(key)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                    sortKey === key
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  {label}
                  <SortIcon k={key} />
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {filteredAndSorted.map((asset, idx) => {
              const priceData = getPriceData(asset.symbol);
              const balance = balanceMap[asset.symbol] ?? 0;
              const usdValue = balance * (priceData?.price ?? 0);
              const change = priceData?.change24h ?? 0;
              const isPos = change >= 0;

              return (
                <motion.button
                  key={asset.symbol}
                  initial={animated ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: animated ? idx * 0.02 : 0 }}
                  onClick={() => navigate(`/assets/crypto/${asset.symbol}`)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/20 transition-colors text-left"
                >
                  <div className={`w-10 h-10 rounded-xl ${asset.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-base font-bold ${asset.text}`}>{asset.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.symbol}</p>
                    {balance > 0 && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset.symbol}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {priceData ? (
                      <>
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          {fmtPrice(priceData.price, compact)}
                        </p>
                        {showBadges ? (
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${
                            isPos ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                          }`}>
                            {isPos ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                            {isPos ? "+" : ""}{change.toFixed(2)}%
                          </span>
                        ) : (
                          <p className={`text-xs font-medium flex items-center justify-end gap-0.5 mt-0.5 ${isPos ? "text-emerald-500" : "text-red-500"}`}>
                            {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isPos ? "+" : ""}{change.toFixed(2)}%
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                    {balance > 0 && (
                      <p className="text-xs text-primary font-medium mt-0.5">{fmtUsd(usdValue, compact)}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Fiat list */}
      {tab === "fiat" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {filteredFiat.length} Fiat Currencies
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {filteredFiat.map((currency, idx) => {
              const isUsd = currency.symbol === "USD";
              return (
                <motion.button
                  key={currency.symbol}
                  initial={animated ? { opacity: 0, y: 8 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: animated ? idx * 0.02 : 0 }}
                  onClick={() => navigate(`/assets/fiat/${currency.symbol}`)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/20 transition-colors text-left"
                >
                  <div className={`w-10 h-10 rounded-xl ${currency.bg} flex items-center justify-center shrink-0 text-xl`}>
                    {currency.flag}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{currency.name}</p>
                    <p className="text-xs text-muted-foreground">{currency.symbol}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {isUsd && cashBalance > 0 ? (
                      <p className="text-sm font-semibold text-primary tabular-nums">{fmtUsd(cashBalance, compact)}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
