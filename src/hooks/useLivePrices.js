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

const HOLDINGS = {
  BTC: 0.4521,
  ETH: 3.825,
  SOL: 42.5,
  BNB: 8.12,
  XRP: 2500,
  ADA: 5000,
  DOGE: 10000,
  AVAX: 65,
};

const ICONS = {
  BTC: "₿", ETH: "Ξ", SOL: "◎", BNB: "◆", XRP: "✕", ADA: "₳", DOGE: "Ð", AVAX: "▲",
};

const NAMES = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB",
  XRP: "XRP", ADA: "Cardano", DOGE: "Dogecoin", AVAX: "Avalanche",
};

export function useLivePrices() {
  const [cryptoList, setCryptoList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchPrices = useCallback(async () => {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`;

    const res = await fetch(url);
    const data = await res.json();

    const symbolById = Object.fromEntries(
      Object.entries(COINGECKO_IDS).map(([sym, id]) => [id, sym])
    );

    const list = data.map((coin) => {
      const symbol = symbolById[coin.id];
      const price = coin.current_price;
      const holdings = HOLDINGS[symbol] || 0;
      const volume = coin.total_volume >= 1e9
        ? `${(coin.total_volume / 1e9).toFixed(1)}B`
        : `${(coin.total_volume / 1e6).toFixed(0)}M`;
      const marketCap = coin.market_cap >= 1e12
        ? `${(coin.market_cap / 1e12).toFixed(2)}T`
        : `${(coin.market_cap / 1e9).toFixed(1)}B`;

      return {
        symbol,
        name: NAMES[symbol] || coin.name,
        price,
        change24h: parseFloat((coin.price_change_percentage_24h || 0).toFixed(2)),
        volume,
        marketCap,
        holdings,
        icon: ICONS[symbol] || "•",
      };
    }).filter(Boolean).sort((a, b) =>
      Object.keys(HOLDINGS).indexOf(a.symbol) - Object.keys(HOLDINGS).indexOf(b.symbol)
    );

    setCryptoList(list);
    setLastUpdated(new Date());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const portfolioTotal = cryptoList.reduce(
    (sum, coin) => sum + coin.price * coin.holdings, 0
  );

  const portfolioChange24h = cryptoList.length > 0
    ? cryptoList.reduce((sum, coin) => {
        const weight = (coin.price * coin.holdings) / (portfolioTotal || 1);
        return sum + coin.change24h * weight;
      }, 0)
    : 0;

  return {
    cryptoList,
    isLoading,
    lastUpdated,
    portfolioTotal,
    portfolioChange24h: parseFloat(portfolioChange24h.toFixed(2)),
    refetch: fetchPrices,
  };
}