import { useState, useEffect, useCallback, useRef } from "react";

// CoinGecko OHLC endpoint: returns [[timestamp_ms, open, high, low, close]]
// Days options: 1, 7, 14, 30, 90, 180, 365, max
// Granularity: 1 day → 30min, 1-90 days → hourly, 91+ days → daily

const DAYS_MAP = {
  "1D":  1,
  "1W":  7,
  "1M":  30,
  "3M":  90,
  "6M":  180,
  "1Y":  365,
};

// ── Technical Indicators ──────────────────────────────────────────────────────

function sma(prices, period) {
  const result = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    const slice = prices.slice(i - period + 1, i + 1);
    result.push(slice.reduce((s, v) => s + v, 0) / period);
  }
  return result;
}

function ema(prices, period) {
  const k = 2 / (period + 1);
  const result = [];
  let emaVal = null;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (emaVal === null) {
      emaVal = prices.slice(0, period).reduce((s, v) => s + v, 0) / period;
    } else {
      emaVal = prices[i] * k + emaVal * (1 - k);
    }
    result.push(emaVal);
  }
  return result;
}

function bollingerBands(prices, period = 20, stdDevMultiplier = 2) {
  const mids = sma(prices, period);
  return prices.map((_, i) => {
    if (mids[i] === null) return { upper: null, mid: null, lower: null };
    const slice = prices.slice(Math.max(0, i - period + 1), i + 1);
    const mean = mids[i];
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length;
    const stdDev = Math.sqrt(variance);
    return {
      upper: mean + stdDevMultiplier * stdDev,
      mid: mean,
      lower: mean - stdDevMultiplier * stdDev,
    };
  });
}

function rsi(prices, period = 14) {
  const result = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) { result.push(null); continue; }
    const changes = [];
    for (let j = i - period + 1; j <= i; j++) {
      changes.push(prices[j] - prices[j - 1]);
    }
    const gains = changes.map((c) => (c > 0 ? c : 0));
    const losses = changes.map((c) => (c < 0 ? -c : 0));
    const avgGain = gains.reduce((s, v) => s + v, 0) / period;
    const avgLoss = losses.reduce((s, v) => s + v, 0) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

function macd(prices, fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(prices, fast);
  const emaSlow = ema(prices, slow);
  const macdLine = prices.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i] - emaSlow[i] : null
  );
  const macdValues = macdLine.filter((v) => v !== null);
  const signalLine = ema(macdValues, signal);
  let si = 0;
  const signalFull = macdLine.map((v) => {
    if (v === null) return null;
    return signalLine[si++] ?? null;
  });
  const histogram = macdLine.map((v, i) =>
    v !== null && signalFull[i] !== null ? v - signalFull[i] : null
  );
  return { macdLine, signalLine: signalFull, histogram };
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useCandlestickChart(coinId, timeframe = "1D") {
  const [candles, setCandles] = useState([]);
  const [indicators, setIndicators] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const cacheRef = useRef({});

  const fetchOhlc = useCallback(async () => {
    if (!coinId) return;
    const cacheKey = `${coinId}_${timeframe}`;
    const cached = cacheRef.current[cacheKey];
    if (cached && Date.now() - cached.ts < 60_000) {
      setCandles(cached.candles);
      setIndicators(cached.indicators);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const days = DAYS_MAP[timeframe] || 1;
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`CoinGecko OHLC ${res.status}`);
      const raw = await res.json();

      const candleData = raw.map(([ts, o, h, l, c]) => ({
        time: Math.floor(ts / 1000), // convert ms → seconds
        open: o, high: h, low: l, close: c,
      })).sort((a, b) => a.time - b.time);

      const closes = candleData.map((c) => c.close);
      const times = candleData.map((c) => c.time);

      const sma20Values = sma(closes, 20);
      const sma50Values = sma(closes, 50);
      const ema12Values = ema(closes, 12);
      const ema26Values = ema(closes, 26);
      const bbValues = bollingerBands(closes, 20);
      const rsiValues = rsi(closes, 14);
      const macdValues = macd(closes);

      const toSeries = (values) =>
        times.map((t, i) => (values[i] !== null ? { time: t, value: parseFloat((values[i]).toFixed(4)) } : null)).filter(Boolean);

      const computedIndicators = {
        sma20: toSeries(sma20Values),
        sma50: toSeries(sma50Values),
        ema12: toSeries(ema12Values),
        ema26: toSeries(ema26Values),
        bbUpper: toSeries(bbValues.map((b) => b.upper)),
        bbMid:   toSeries(bbValues.map((b) => b.mid)),
        bbLower: toSeries(bbValues.map((b) => b.lower)),
        rsi: toSeries(rsiValues),
        macdLine: toSeries(macdValues.macdLine),
        macdSignal: toSeries(macdValues.signalLine),
        macdHistogram: times
          .map((t, i) => macdValues.histogram[i] !== null
            ? { time: t, value: parseFloat((macdValues.histogram[i]).toFixed(6)), color: macdValues.histogram[i] >= 0 ? "#26a69a" : "#ef5350" }
            : null)
          .filter(Boolean),
      };

      cacheRef.current[cacheKey] = { candles: candleData, indicators: computedIndicators, ts: Date.now() };
      setCandles(candleData);
      setIndicators(computedIndicators);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
        console.warn("OHLC fetch failed:", err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [coinId, timeframe]);

  useEffect(() => {
    fetchOhlc();
  }, [fetchOhlc]);

  return { candles, indicators, isLoading, error, refetch: fetchOhlc };
}
