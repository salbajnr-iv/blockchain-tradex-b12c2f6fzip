// ─────────────────────────────────────────────────────────────────────────────
// EXCHANGE RATES — Static rates, updated April 2026
// All prices in the investment catalog are stored in USD.
// To display in another currency: price_usd * RATES[currency]
// ─────────────────────────────────────────────────────────────────────────────

// 1 USD expressed in each currency
export const RATES = {
  USD: 1,
  EUR: 0.917,
  GBP: 0.790,
  JPY: 151.50,
  CHF: 0.902,
  CAD: 1.362,
  AUD: 1.543,
  CNY: 7.241,
  INR: 83.45,
  BRL: 4.967,
  KRW: 1334.5,
  SGD: 1.348,
  HKD: 7.825,
  AED: 3.672,
  MXN: 17.20,
  SEK: 10.42,
  NOK: 10.58,
  DKK: 6.83,
  NZD: 1.634,
  ZAR: 18.85,
};

// Display metadata for each currency
export const CURRENCIES = [
  { code: "USD", symbol: "$",   name: "US Dollar",         flag: "🇺🇸" },
  { code: "EUR", symbol: "€",   name: "Euro",              flag: "🇪🇺" },
  { code: "GBP", symbol: "£",   name: "British Pound",     flag: "🇬🇧" },
  { code: "JPY", symbol: "¥",   name: "Japanese Yen",      flag: "🇯🇵" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc",       flag: "🇨🇭" },
  { code: "CAD", symbol: "C$",  name: "Canadian Dollar",   flag: "🇨🇦" },
  { code: "AUD", symbol: "A$",  name: "Australian Dollar", flag: "🇦🇺" },
  { code: "CNY", symbol: "¥",   name: "Chinese Yuan",      flag: "🇨🇳" },
  { code: "INR", symbol: "₹",   name: "Indian Rupee",      flag: "🇮🇳" },
  { code: "BRL", symbol: "R$",  name: "Brazilian Real",    flag: "🇧🇷" },
  { code: "KRW", symbol: "₩",   name: "South Korean Won",  flag: "🇰🇷" },
  { code: "SGD", symbol: "S$",  name: "Singapore Dollar",  flag: "🇸🇬" },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar",  flag: "🇭🇰" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham",        flag: "🇦🇪" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso",      flag: "🇲🇽" },
  { code: "SEK", symbol: "kr",  name: "Swedish Krona",     flag: "🇸🇪" },
  { code: "NOK", symbol: "kr",  name: "Norwegian Krone",   flag: "🇳🇴" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar",flag: "🇳🇿" },
];

// Currencies shown in the quick picker (most popular)
export const POPULAR_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CNY", "INR", "BRL", "KRW"];

export const getCurrencyMeta = (code) =>
  CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];

// Convert a USD price to a target currency
export const convertFromUSD = (priceUsd, toCurrency = "USD") => {
  const rate = RATES[toCurrency] ?? 1;
  return priceUsd * rate;
};

// LocalStorage persistence key
export const CURRENCY_PREF_KEY = "invest_display_currency";

export const getStoredCurrency = () => {
  try {
    const stored = localStorage.getItem(CURRENCY_PREF_KEY);
    if (stored && RATES[stored] !== undefined) return stored;
  } catch {}
  return "USD";
};

export const setStoredCurrency = (code) => {
  try { localStorage.setItem(CURRENCY_PREF_KEY, code); } catch {}
};

// Format a USD price for display in the chosen currency
export const formatPrice = (priceUsd, currency = "USD") => {
  if (priceUsd == null || isNaN(priceUsd)) return formatZero(currency);
  const converted = convertFromUSD(priceUsd, currency);
  const meta = getCurrencyMeta(currency);
  const sym = meta.symbol;

  // JPY and KRW don't use decimals
  if (currency === "JPY" || currency === "KRW") {
    const rounded = Math.round(converted);
    if (rounded >= 1_000_000) return `${sym}${(rounded / 1_000_000).toFixed(2)}M`;
    if (rounded >= 1_000)     return `${sym}${rounded.toLocaleString()}`;
    return `${sym}${rounded}`;
  }

  if (converted >= 1_000_000) return `${sym}${(converted / 1_000_000).toFixed(2)}M`;
  if (converted >= 1_000)     return `${sym}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (converted >= 1)         return `${sym}${converted.toFixed(4)}`;
  return `${sym}${converted.toFixed(6)}`;
};

export const formatAmount = (priceUsd, currency = "USD") => {
  if (priceUsd == null || isNaN(priceUsd)) return formatZero(currency);
  const converted = convertFromUSD(priceUsd, currency);
  const meta = getCurrencyMeta(currency);
  const sym = meta.symbol;

  if (currency === "JPY" || currency === "KRW") {
    const rounded = Math.round(converted);
    if (rounded >= 1_000_000_000) return `${sym}${(rounded / 1_000_000_000).toFixed(2)}B`;
    if (rounded >= 1_000_000)     return `${sym}${(rounded / 1_000_000).toFixed(2)}M`;
    if (rounded >= 1_000)         return `${sym}${rounded.toLocaleString()}`;
    return `${sym}${rounded}`;
  }

  if (converted >= 1_000_000_000_000) return `${sym}${(converted / 1_000_000_000_000).toFixed(2)}T`;
  if (converted >= 1_000_000_000)     return `${sym}${(converted / 1_000_000_000).toFixed(2)}B`;
  if (converted >= 1_000_000)         return `${sym}${(converted / 1_000_000).toFixed(2)}M`;
  if (converted >= 1_000)             return `${sym}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (converted >= 1)                 return `${sym}${converted.toFixed(4)}`;
  return `${sym}${converted.toFixed(6)}`;
};

const formatZero = (currency) => {
  const sym = getCurrencyMeta(currency).symbol;
  return currency === "JPY" || currency === "KRW" ? `${sym}0` : `${sym}0.00`;
};
