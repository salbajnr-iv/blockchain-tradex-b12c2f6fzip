import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePortfolio } from "@/contexts/PortfolioContext";

const LivePricesContext = createContext(null);

const COINGECKO_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
  XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", AVAX: "avalanche-2",
};

const COINCAP_IDS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binance-coin",
  XRP: "xrp", ADA: "cardano", DOGE: "dogecoin", AVAX: "avalanche",
};

const ICONS = {
  BTC: "₿", ETH: "Ξ", SOL: "◎", BNB: "◆", XRP: "✕", ADA: "₳", DOGE: "Ð", AVAX: "▲",
};

const NAMES = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB",
  XRP: "XRP", ADA: "Cardano", DOGE: "Dogecoin", AVAX: "Avalanche",
};

const COIN_ORDER = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX"];

// Used as seed data when both APIs fail — keeps the UI usable
const FALLBACK_PRICES = {
  BTC:  { price: 83000,  change24h: 0, volume: "28.5B", marketCap: "1.6T" },
  ETH:  { price: 1820,   change24h: 0, volume: "12.1B", marketCap: "219B" },
  SOL:  { price: 125,    change24h: 0, volume: "3.2B",  marketCap: "63B"  },
  BNB:  { price: 590,    change24h: 0, volume: "1.8B",  marketCap: "86B"  },
  XRP:  { price: 2.05,   change24h: 0, volume: "5.4B",  marketCap: "118B" },
  ADA:  { price: 0.68,   change24h: 0, volume: "520M",  marketCap: "24B"  },
  DOGE: { price: 0.165,  change24h: 0, volume: "1.1B",  marketCap: "24B"  },
  AVAX: { price: 20,     change24h: 0, volume: "310M",  marketCap: "8.3B" },
};

async function fetchFromCoinGecko(signal) {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`,
    { signal }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  const symbolById = Object.fromEntries(
    Object.entries(COINGECKO_IDS).map(([sym, id]) => [id, sym])
  );
  return data.map((coin) => {
    const symbol = symbolById[coin.id];
    if (!symbol) return null;
    const volume = coin.total_volume >= 1e9
      ? `${(coin.total_volume / 1e9).toFixed(1)}B`
      : `${(coin.total_volume / 1e6).toFixed(0)}M`;
    const marketCap = coin.market_cap >= 1e12
      ? `${(coin.market_cap / 1e12).toFixed(2)}T`
      : `${(coin.market_cap / 1e9).toFixed(1)}B`;
    return { symbol, price: coin.current_price, change24h: parseFloat((coin.price_change_percentage_24h || 0).toFixed(2)), volume, marketCap };
  }).filter(Boolean);
}

async function fetchFromCoinCap(signal) {
  const res = await fetch("https://api.coincap.io/v2/assets?limit=50", { signal });
  if (!res.ok) throw new Error(`CoinCap ${res.status}`);
  const { data } = await res.json();
  const idToSymbol = Object.fromEntries(
    Object.entries(COINCAP_IDS).map(([sym, id]) => [id, sym])
  );
  return data.map((coin) => {
    const symbol = idToSymbol[coin.id];
    if (!symbol) return null;
    const volumeRaw = parseFloat(coin.volumeUsd24Hr) || 0;
    const mcRaw = parseFloat(coin.marketCapUsd) || 0;
    const volume = volumeRaw >= 1e9 ? `${(volumeRaw / 1e9).toFixed(1)}B` : `${(volumeRaw / 1e6).toFixed(0)}M`;
    const marketCap = mcRaw >= 1e12 ? `${(mcRaw / 1e12).toFixed(2)}T` : `${(mcRaw / 1e9).toFixed(1)}B`;
    return { symbol, price: parseFloat(coin.priceUsd) || 0, change24h: parseFloat((parseFloat(coin.changePercent24Hr) || 0).toFixed(2)), volume, marketCap };
  }).filter(Boolean);
}

export function LivePricesProvider({ children }) {
  const { holdingsMap, cashBalance } = usePortfolio();
  // Pre-seed with fallback prices so the UI is never blank
  const [rawPrices, setRawPrices] = useState(
    Object.entries(FALLBACK_PRICES).map(([symbol, p]) => ({ symbol, ...p }))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchPrices = useCallback(async () => {
    try {
      let priceData;
      // Try CoinGecko first (no abort controller — let fetch handle naturally)
      try {
        priceData = await Promise.race([
          fetchFromCoinGecko(new AbortController().signal),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 7000)),
        ]);
      } catch (geckoErr) {
        console.warn("CoinGecko failed, falling back to CoinCap:", geckoErr.message);
        // Fallback to CoinCap
        priceData = await Promise.race([
          fetchFromCoinCap(new AbortController().signal),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
        ]);
      }
      setRawPrices(priceData);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn("Price fetch failed (both sources):", err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const cryptoList = COIN_ORDER.map((symbol) => {
    const live = rawPrices.find((d) => d.symbol === symbol);
    const p = live || FALLBACK_PRICES[symbol];
    if (!p) return null;
    const holdingRow = holdingsMap[symbol];
    return {
      symbol,
      name: NAMES[symbol] || symbol,
      price: p.price,
      change24h: p.change24h,
      volume: p.volume,
      marketCap: p.marketCap,
      holdings: holdingRow?.amount || 0,
      avgCost: holdingRow?.average_cost || 0,
      icon: ICONS[symbol] || "•",
      isStale: !live, // flag when using fallback
    };
  }).filter(Boolean);

  const cryptoPortfolioValue = cryptoList.reduce((sum, c) => sum + c.price * c.holdings, 0);
  const portfolioTotal = cryptoPortfolioValue + (cashBalance || 0);
  const portfolioChange24h = cryptoList.length > 0 && cryptoPortfolioValue > 0
    ? parseFloat(cryptoList.reduce((sum, c) => {
        const weight = (c.price * c.holdings) / cryptoPortfolioValue;
        return sum + c.change24h * weight;
      }, 0).toFixed(2))
    : 0;

  return (
    <LivePricesContext.Provider value={{
      cryptoList,
      isLoading,
      lastUpdated,
      portfolioTotal,
      cryptoPortfolioValue,
      cashBalance,
      portfolioChange24h,
      refetch: fetchPrices,
    }}>
      {children}
    </LivePricesContext.Provider>
  );
}

export function useLivePrices() {
  const ctx = useContext(LivePricesContext);
  if (!ctx) throw new Error("useLivePrices must be used within LivePricesProvider");
  return ctx;
}
