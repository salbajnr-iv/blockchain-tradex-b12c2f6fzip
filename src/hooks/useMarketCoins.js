import { useState, useEffect, useCallback } from "react";

function fmt(num, divisor, suffix) {
  return num >= divisor ? `${(num / divisor).toFixed(2)}${suffix}` : null;
}

function formatLarge(n) {
  if (!n) return "$0";
  return (
    fmt(n, 1e12, "T") ||
    fmt(n, 1e9, "B") ||
    fmt(n, 1e6, "M") ||
    `$${n.toLocaleString()}`
  );
}

export function useMarketCoins() {
  const [coins, setCoins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchCoins = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h,7d"
      );
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
      const data = await res.json();

      setCoins(
        data.map((c) => ({
          id: c.id,
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          image: c.image,
          price: c.current_price ?? 0,
          change24h: parseFloat((c.price_change_percentage_24h ?? 0).toFixed(2)),
          change7d: parseFloat((c.price_change_percentage_7d_in_currency ?? 0).toFixed(2)),
          volume: formatLarge(c.total_volume),
          volumeRaw: c.total_volume ?? 0,
          marketCap: formatLarge(c.market_cap),
          marketCapRaw: c.market_cap ?? 0,
          rank: c.market_cap_rank ?? 999,
          high24h: c.high_24h ?? 0,
          low24h: c.low_24h ?? 0,
          ath: c.ath ?? 0,
          athChangePercent: parseFloat((c.ath_change_percentage ?? 0).toFixed(2)),
          circulatingSupply: c.circulating_supply ?? 0,
        }))
      );
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
      console.warn("Market fetch failed:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoins();
    const id = setInterval(fetchCoins, 60000);
    return () => clearInterval(id);
  }, [fetchCoins]);

  return { coins, isLoading, error, lastUpdated, refetch: fetchCoins };
}
