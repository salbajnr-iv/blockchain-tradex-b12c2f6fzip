import { useEffect, useRef, useLayoutEffect } from "react";
import { createChart } from "lightweight-charts";
import { useTheme } from "@/contexts/ThemeContext";

const TIMEFRAMES = ["1D", "1W", "1M", "3M", "6M", "1Y"];

const INDICATORS = [
  { key: "sma20",   label: "SMA 20",  color: "#f59e0b", type: "overlay" },
  { key: "sma50",   label: "SMA 50",  color: "#3b82f6", type: "overlay" },
  { key: "ema12",   label: "EMA 12",  color: "#8b5cf6", type: "overlay" },
  { key: "bb",      label: "Bollinger Bands", color: "#64748b", type: "overlay" },
  { key: "rsi",     label: "RSI",     color: "#f97316", type: "pane" },
  { key: "macd",    label: "MACD",    color: "#06b6d4", type: "pane" },
];

export default function CandlestickChart({
  candles,
  indicators,
  isLoading,
  timeframe,
  setTimeframe,
  chartType,
  setChartType,
  activeIndicators,
  setActiveIndicators,
}) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const seriesRef = useRef({});
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const bg   = isDark ? "#0a0f1a" : "#ffffff";
  const text = isDark ? "hsl(210, 20%, 70%)" : "hsl(220, 20%, 35%)";
  const grid = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  // Create / destroy chart
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: bg }, textColor: text },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: border, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: border, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      handleScroll: true,
      handleScale: true,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  // Update theme colors without recreating
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: { background: { color: bg }, textColor: text },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border },
    });
  }, [isDark, bg, text, grid, border]);

  // Update data
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || isLoading || !candles.length) return;

    // Remove all existing series
    Object.values(seriesRef.current).forEach((s) => {
      try { chart.removeSeries(s); } catch {}
    });
    seriesRef.current = {};

    // Main price series
    if (chartType === "candlestick") {
      const cs = chart.addCandlestickSeries({
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
      });
      cs.setData(candles);
      seriesRef.current.main = cs;
    } else {
      const ls = chart.addAreaSeries({
        lineColor: "#26a69a",
        topColor: "rgba(38, 166, 154, 0.28)",
        bottomColor: "rgba(38, 166, 154, 0.00)",
        lineWidth: 2,
      });
      ls.setData(candles.map((c) => ({ time: c.time, value: c.close })));
      seriesRef.current.main = ls;
    }

    // Overlay indicators (on same pane)
    if (activeIndicators.includes("sma20") && indicators.sma20?.length) {
      const s = chart.addLineSeries({ color: "#f59e0b", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(indicators.sma20);
      seriesRef.current.sma20 = s;
    }
    if (activeIndicators.includes("sma50") && indicators.sma50?.length) {
      const s = chart.addLineSeries({ color: "#3b82f6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(indicators.sma50);
      seriesRef.current.sma50 = s;
    }
    if (activeIndicators.includes("ema12") && indicators.ema12?.length) {
      const s = chart.addLineSeries({ color: "#8b5cf6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(indicators.ema12);
      seriesRef.current.ema12 = s;
    }
    if (activeIndicators.includes("bb") && indicators.bbUpper?.length) {
      const upper = chart.addLineSeries({ color: "rgba(100, 116, 139, 0.7)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      const mid   = chart.addLineSeries({ color: "rgba(100, 116, 139, 0.4)", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
      const lower = chart.addLineSeries({ color: "rgba(100, 116, 139, 0.7)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      upper.setData(indicators.bbUpper);
      mid.setData(indicators.bbMid);
      lower.setData(indicators.bbLower);
      seriesRef.current.bbUpper = upper;
      seriesRef.current.bbMid   = mid;
      seriesRef.current.bbLower = lower;
    }

    // Sub-pane indicators — use separate price scale
    if (activeIndicators.includes("rsi") && indicators.rsi?.length) {
      const s = chart.addLineSeries({
        color: "#f97316", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true,
        priceScaleId: "rsi",
      });
      chart.priceScale("rsi").applyOptions({ scaleMargins: { top: 0.8, bottom: 0.0 } });
      s.setData(indicators.rsi);
      seriesRef.current.rsi = s;
    }
    if (activeIndicators.includes("macd") && indicators.macdHistogram?.length) {
      const hist = chart.addHistogramSeries({
        color: "#26a69a", priceLineVisible: false, lastValueVisible: false,
        priceScaleId: "macd",
      });
      const line   = chart.addLineSeries({ color: "#06b6d4", lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, priceScaleId: "macd" });
      const signal = chart.addLineSeries({ color: "#ef5350", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, priceScaleId: "macd" });
      chart.priceScale("macd").applyOptions({ scaleMargins: { top: 0.65, bottom: 0.0 } });
      hist.setData(indicators.macdHistogram);
      if (indicators.macdLine?.length)   line.setData(indicators.macdLine);
      if (indicators.macdSignal?.length) signal.setData(indicators.macdSignal);
      seriesRef.current.macdHist   = hist;
      seriesRef.current.macdLine   = line;
      seriesRef.current.macdSignal = signal;
    }

    chart.timeScale().fitContent();
  }, [candles, indicators, chartType, activeIndicators, isLoading]);

  const toggleIndicator = (key) => {
    setActiveIndicators((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-shrink-0">
        {/* Timeframe */}
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                timeframe === tf ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
          {["candlestick", "line"].map((ct) => (
            <button
              key={ct}
              onClick={() => setChartType(ct)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                chartType === ct ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ct === "candlestick" ? "Candle" : "Line"}
            </button>
          ))}
        </div>

        {/* Indicators */}
        <div className="flex flex-wrap gap-1.5">
          {INDICATORS.map(({ key, label, color }) => {
            const active = activeIndicators.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleIndicator(key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  active
                    ? "border-transparent text-white"
                    : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                }`}
                style={active ? { backgroundColor: color + "30", borderColor: color + "60", color } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: active ? color : "currentColor", opacity: active ? 1 : 0.3 }}
                />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart container */}
      <div className="relative flex-1 min-h-0">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm rounded-xl z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Loading chart...</p>
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />
      </div>
    </div>
  );
}
