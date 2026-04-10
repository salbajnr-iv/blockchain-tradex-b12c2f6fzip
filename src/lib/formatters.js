/**
 * Shared number & price formatting utilities.
 * All functions accept a `compact` boolean to honour the user's
 * "Compact numbers" display preference from ThemeContext.
 */

/**
 * Format a USD amount, optionally in compact notation.
 * compact=true  → $1.2M / $45.3K / $892
 * compact=false → $1,200,000.00
 */
export function fmtUsd(value, compact = false) {
  const n = Number(value ?? 0);
  if (compact) {
    if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(n) >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a crypto price (preserves enough decimal places for small coins).
 */
export function fmtPrice(value, compact = false) {
  const n = Number(value ?? 0);
  if (compact && Math.abs(n) >= 1_000) {
    if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(n) >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
    return `$${(n / 1_000).toFixed(1)}K`;
  }
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (n >= 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

/**
 * Format a plain number, optionally compact.
 */
export function fmtNumber(value, compact = false, decimals = 2) {
  const n = Number(value ?? 0);
  if (compact) {
    if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(n) >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}
