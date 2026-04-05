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

async function fetchFromCoinGecko(signal) {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h,7d",
    { signal }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  return data.map((c) => ({
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
  }));
}

async function fetchFromCoinCap(signal) {
  const res = await fetch(
    "https://api.coincap.io/v2/assets?limit=100",
    { signal }
  );
  if (!res.ok) throw new Error(`CoinCap ${res.status}`);
  const { data } = await res.json();
  return data.map((c) => {
    const sym = c.symbol.toUpperCase();
    return {
      id: c.id,
      symbol: sym,
      name: c.name,
      image: `https://assets.coincap.io/assets/icons/${c.symbol.toLowerCase()}@2x.png`,
      price: parseFloat(c.priceUsd) || 0,
      change24h: parseFloat((parseFloat(c.changePercent24Hr) || 0).toFixed(2)),
      change7d: 0,
      volume: formatLarge(parseFloat(c.volumeUsd24Hr)),
      volumeRaw: parseFloat(c.volumeUsd24Hr) || 0,
      marketCap: formatLarge(parseFloat(c.marketCapUsd)),
      marketCapRaw: parseFloat(c.marketCapUsd) || 0,
      rank: parseInt(c.rank) || 999,
      high24h: 0,
      low24h: 0,
      ath: 0,
      athChangePercent: 0,
      circulatingSupply: parseFloat(c.supply) || 0,
    };
  });
}

export function useMarketCoins() {
  const [coins, setCoins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchCoins = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      let data;
      try {
        data = await fetchFromCoinGecko(controller.signal);
      } catch (geckoErr) {
        if (geckoErr.name === "AbortError") throw geckoErr;
        console.warn("CoinGecko failed, trying CoinCap:", geckoErr.message);
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 8000);
        try {
          data = await fetchFromCoinCap(fallbackController.signal);
        } finally {
          clearTimeout(fallbackTimeout);
        }
      }

      setCoins(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
        console.warn("Market fetch failed:", err.message);
      }
    } finally {
      clearTimeout(timeout);
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
