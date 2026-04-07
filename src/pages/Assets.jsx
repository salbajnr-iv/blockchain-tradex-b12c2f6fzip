import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { usePortfolio } from "@/contexts/PortfolioContext";
import { useLivePrices } from "@/hooks/useLivePrices";
import { getUserCryptoBalances } from "@/lib/api/cryptoDeposits";
import {
  Wallet, Search, ChevronRight, TrendingUp, TrendingDown,
  DollarSign, Bitcoin,
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

export default function AssetsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cashBalance } = usePortfolio();
  const { cryptoList } = useLivePrices();
  const [tab, setTab] = useState("crypto");
  const [search, setSearch] = useState("");

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

  const filteredCrypto = useMemo(
    () =>
      CRYPTO_ASSETS.filter(
        (a) =>
          a.symbol.toLowerCase().includes(search.toLowerCase()) ||
          a.name.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  const filteredFiat = useMemo(
    () =>
      FIAT_CURRENCIES.filter(
        (f) =>
          f.symbol.toLowerCase().includes(search.toLowerCase()) ||
          f.name.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );

  const totalCryptoUsd = useMemo(() => {
    return cryptoBalances.reduce((sum, b) => {
      const price = getPriceData(b.asset)?.price ?? 0;
      return sum + parseFloat(b.balance) * price;
    }, 0);
  }, [cryptoBalances, cryptoList]);

  const fmtUsd = (v) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v ?? 0);

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
          <p className="text-xl font-bold text-foreground tabular-nums">{fmtUsd(cashBalance)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Available USD</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Crypto Balance</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{fmtUsd(totalCryptoUsd)}</p>
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
          <div className="px-5 py-3 border-b border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {filteredCrypto.length} Cryptocurrencies
            </p>
          </div>
          <div className="divide-y divide-border/30">
            {filteredCrypto.map((asset, idx) => {
              const priceData = getPriceData(asset.symbol);
              const balance = balanceMap[asset.symbol] ?? 0;
              const usdValue = balance * (priceData?.price ?? 0);
              const change = priceData?.change24h ?? 0;
              const isPos = change >= 0;

              return (
                <motion.button
                  key={asset.symbol}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => navigate(`/assets/crypto/${asset.symbol}`)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary/20 transition-colors text-left"
                >
                  <div className={`w-10 h-10 rounded-xl ${asset.bg} flex items-center justify-center shrink-0`}>
                    <span className={`text-base font-bold ${asset.text}`}>{asset.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.symbol}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {priceData ? (
                      <>
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          {priceData.price >= 1000
                            ? `$${priceData.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                            : priceData.price >= 1
                            ? `$${priceData.price.toFixed(4)}`
                            : `$${priceData.price.toFixed(6)}`}
                        </p>
                        <p className={`text-xs font-medium flex items-center justify-end gap-0.5 ${isPos ? "text-emerald-500" : "text-red-500"}`}>
                          {isPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPos ? "+" : ""}{change.toFixed(2)}%
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                    {balance > 0 && (
                      <p className="text-xs text-primary font-medium mt-0.5">{fmtUsd(usdValue)}</p>
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
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
                      <p className="text-sm font-semibold text-primary tabular-nums">{fmtUsd(cashBalance)}</p>
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
