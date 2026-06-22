/** Shared formatting helpers for protocol event cards */

import type { GasCost } from "@/lib/shared/types/activity";

/** Format a transaction's gas cost as "0.0276 ETH ($57.68)" — the ($usd) tail
 *  is dropped below a cent. Used as the trailing bullet in each event's
 *  plain-language explainer (gas is per-transaction, not a position total). */
export function formatGasCost(gas: GasCost): string {
  const eth = gas.gasCostEth < 0.001 ? gas.gasCostEth.toFixed(6) : gas.gasCostEth.toFixed(4);
  const usd = gas.gasCostUsd > 0.01 ? ` ($${gas.gasCostUsd.toFixed(2)})` : "";
  return `${eth} ETH${usd}`;
}

/** Format a unix timestamp as "14:30" (24-hour) */
export function formatTimestamp(unix: number): string {
  const d = new Date(unix * 1000);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Stable per-day key for grouping ("Tue Apr 14 2026") — local time. */
export function dayKey(unix: number): string {
  return new Date(unix * 1000).toDateString();
}

/** Compact day-month label, e.g. "Apr 14" (locale-aware month abbrev). */
export function shortDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Two-digit-year suffix, e.g. "'26" — pair with shortDate for full prefix. */
export function shortDateYear(unix: number): string {
  return "'" + String(new Date(unix * 1000).getFullYear()).slice(-2);
}

/** Format a number with locale grouping. Default 2 decimal places. */
export function formatNum(v: string | number, decimals = 2): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/** Format a USD value: "< $0.01", "$0.50", "$1,234" */
export function formatUsd(value: number | undefined | null): string {
  if (value == null || isNaN(value) || value < 0.01) return "< $0.01";
  if (value < 1) return `$${value.toFixed(2)}`;
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/** Shorten an address: "0x1234…abcd" */
export function shortAddr(a: string): string {
  return `${a.slice(0, 6)}\u2026${a.slice(-4)}`;
}

/**
 * Format a headline value with compact notation for 4+ digit numbers.
 * Returns `{ display, title }` — wire `title` to the wrapping element so
 * hovering reveals the full-precision number.
 *
 * - n >= 1000:   "60K", "1.2M", "3.4B"   (title: "60,000.00")
 * - 100 <= n:    "1,234.56"                (title same)
 * - 1 <= n:      "12.4500"                (title same)
 * - n < 1:       "0.004567"               (title same)
 */
export function formatCompact(n: number, opts?: { decimals?: number }): { display: string; title: string } {
  const decimals = opts?.decimals;
  const fullDecimals = decimals ?? (n >= 100 ? 2 : n >= 1 ? 4 : 6);
  const title = n.toLocaleString(undefined, {
    minimumFractionDigits: fullDecimals,
    maximumFractionDigits: fullDecimals,
  });
  if (n >= 1000) {
    const compact = Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
    return { display: compact, title };
  }
  const display = n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fullDecimals,
  });
  return { display, title };
}

/** Format a unix timestamp as a friendly relative age: "14d ago", "2mo ago", "1y 3mo ago". */
export function formatRelativeAge(unix: number): string {
  const secs = Date.now() / 1000 - unix;
  if (secs < 0) return "just now";
  const days = Math.floor(secs / 86400);
  if (days < 1) {
    const hours = Math.floor(secs / 3600);
    if (hours < 1) return "just now";
    return `${hours}h ago`;
  }
  if (days < 30) return `${days}d ago`;
  const years = Math.floor(days / 365);
  if (years < 1) {
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }
  const remainderDays = days - years * 365;
  const months = Math.floor(remainderDays / 30);
  return months === 0 ? `${years}y ago` : `${years}y ${months}mo ago`;
}
