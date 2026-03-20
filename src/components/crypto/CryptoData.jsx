// Static crypto market data for the dashboard
export const CRYPTO_LIST = [
  { symbol: "BTC", name: "Bitcoin", price: 87432.18, change24h: 2.34, volume: "42.1B", marketCap: "1.72T", holdings: 0.4521, icon: "₿" },
  { symbol: "ETH", name: "Ethereum", price: 3241.56, change24h: -1.12, volume: "18.7B", marketCap: "389.2B", holdings: 3.825, icon: "Ξ" },
  { symbol: "SOL", name: "Solana", price: 187.42, change24h: 5.67, volume: "8.2B", marketCap: "82.4B", holdings: 42.5, icon: "◎" },
  { symbol: "BNB", name: "BNB", price: 612.38, change24h: 0.89, volume: "2.1B", marketCap: "91.3B", holdings: 8.12, icon: "◆" },
  { symbol: "XRP", name: "XRP", price: 2.41, change24h: -0.45, volume: "4.8B", marketCap: "138.5B", holdings: 2500, icon: "✕" },
  { symbol: "ADA", name: "Cardano", price: 0.782, change24h: 3.21, volume: "1.2B", marketCap: "27.4B", holdings: 5000, icon: "₳" },
  { symbol: "DOGE", name: "Dogecoin", price: 0.234, change24h: -2.78, volume: "3.1B", marketCap: "34.1B", holdings: 10000, icon: "Ð" },
  { symbol: "AVAX", name: "Avalanche", price: 42.18, change24h: 4.12, volume: "980M", marketCap: "16.8B", holdings: 65, icon: "▲" },
];

export const PORTFOLIO_TOTAL = 89247.32;
export const PORTFOLIO_CHANGE_24H = 1.87;
export const PORTFOLIO_PNL = 12483.56;

export const CHART_DATA = [
  { time: "00:00", price: 85200 },
  { time: "02:00", price: 85800 },
  { time: "04:00", price: 86100 },
  { time: "06:00", price: 85500 },
  { time: "08:00", price: 86400 },
  { time: "10:00", price: 87100 },
  { time: "12:00", price: 86800 },
  { time: "14:00", price: 87500 },
  { time: "16:00", price: 87200 },
  { time: "18:00", price: 87800 },
  { time: "20:00", price: 87100 },
  { time: "22:00", price: 87432 },
];

export const RECENT_TRADES = [
  { type: "buy", pair: "BTC/USDT", amount: 0.025, price: 86950, time: "2 min ago" },
  { type: "sell", pair: "ETH/USDT", amount: 1.5, price: 3255, time: "18 min ago" },
  { type: "buy", pair: "SOL/USDT", amount: 12, price: 184.20, time: "1 hr ago" },
  { type: "buy", pair: "ADA/USDT", amount: 1000, price: 0.76, time: "3 hr ago" },
  { type: "sell", pair: "DOGE/USDT", amount: 5000, price: 0.241, time: "5 hr ago" },
];