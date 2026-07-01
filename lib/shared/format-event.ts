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

// The single source of truth for a token amount on every event-card surface
// (event header, event-detail rows, the timeline spine — across protocols).
// Returns the bare number; callers append the symbol/icon.
//
// Precision is chosen so a small amount of a high-unit-price asset never
// underflows to "0" while a stablecoin never grows a decimal tail:
//   • With a per-unit `priceUsd`, decimals are dollar-anchored — enough places
//     that the last shown digit is worth ~$1. BTC @ $58,749 → 5 decimals
//     (0.001 reads "0.001", not "0"); ETH @ $3,000 → 4; a $1 stablecoin → 0
//     (so 5,784 stays "5,784"). Sub-unit amounts keep a 2-decimal floor so a
//     $1 stablecoin still shows "0.61".
//   • Without a price, decimals scale to the number's own magnitude — so
//     interest figures (0.0312 ETH, 0.00041 WBTC) render legibly with no price.
// A genuinely non-zero amount is never shown as "0": if it rounds away at the
// chosen precision it surfaces the smallest representable unit as "< 0.0000…1".
// ≥ 1M compacts ("1.2M", "34.5M", "2.1B") so a whale balance can't push the
// narrow timeline spine out of layout; below 1M stays fully grouped.
export function fmtTokenAmount(v: string | number | undefined, priceUsd?: number): string {
  if (v == null || v === "") return "0";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n) || n === 0) return "0";
  const abs = Math.abs(n);

  // ≥ 1M units: compact ("1.2M", "34.5M", "2.1B"). Bounds the string width on
  // the narrow timeline spine — a whale's 7-figure balance would otherwise
  // render in full ("12,345,678") and push the icon rail out. Below 1M stays
  // fully grouped (see below), so no current value changes.
  if (abs >= 1_000_000) return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

  // 1,000–999,999: whole number with grouping, no fractional tail — regardless
  // of price (nobody needs 5 decimals on a 5,784 balance).
  if (abs >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const decimals =
    priceUsd && priceUsd > 0
      ? // Dollar-anchored: last digit ≈ $1. Floor at 2 decimals for sub-unit
        // amounts so sub-dollar stablecoin balances stay legible. Capped at 8.
        Math.min(8, Math.max(abs < 1 ? 2 : 0, Math.ceil(Math.log10(priceUsd))))
      : abs >= 1
        ? 4
        : Math.min(8, Math.ceil(-Math.log10(abs)) + 2);

  // Non-zero underflow guard: if rounding to `decimals` would print "0", show
  // the smallest representable unit as a "< …" floor instead of a false zero.
  const smallest = Math.pow(10, -decimals);
  if (abs < 0.5 * smallest) {
    const floor = smallest.toLocaleString(undefined, { maximumFractionDigits: decimals });
    return (n < 0 ? "> −" : "< ") + floor;
  }

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
