import { useState, useEffect, useCallback } from "react";

const COINGECKO_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
};

const TIMEFRAME_DAYS = {
  "1H": 0.04,   // ~1 hour
  "4H": 0.17,
  "1D": 1,
  "1W": 7,
  "1M": 30,
};

export function usePriceChart(symbol = "BTC", timeframe = "1D") {
  const [chartData, setChartData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChart = useCallback(async () => {
    setIsLoading(true);
    const id = COINGECKO_IDS[symbol] || "bitcoin";
    const days = TIMEFRAME_DAYS[timeframe] || 1;
    const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;

    const res = await fetch(url);
    const data = await res.json();

    const prices = data.prices || [];
    const formatted = prices.map(([ts, price]) => ({
      time: new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        ...(days >= 1 ? { month: "short", day: "numeric" } : {}),
        hour12: false,
      }),
      price: parseFloat(price.toFixed(4)),
    }));

    // downsample to max 60 points
    const step = Math.max(1, Math.floor(formatted.length / 60));
    const sampled = formatted.filter((_, i) => i % step === 0);

    setChartData(sampled);

    if (prices.length > 0) {
      const first = prices[0][1];
      const last = prices[prices.length - 1][1];
      setCurrentPrice(last);
      setPriceChange(parseFloat((((last - first) / first) * 100).toFixed(2)));
    }
    setIsLoading(false);
  }, [symbol, timeframe]);

  useEffect(() => {
    fetchChart();
  }, [fetchChart]);

  return { chartData, currentPrice, priceChange, isLoading };
}