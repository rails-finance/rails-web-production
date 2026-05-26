// Shared number formatters for Aave V4 position surfaces. Lifted out of
// components/protocol/aave-v4/aave-v4-spoke-card.tsx so the listing card
// (AaveV4PositionListingCard) renders identical values to the detail card —
// same "$575.4K" cutoff, same "< $1" rule, same HF rounding, same liq-price
// magnitude scaling. Single source of truth.

import { formatCompact } from "@/lib/shared/format-event";

export function fmtUsd(n: number): { display: string; title: string } {
  if (n < 1) return { display: "< $1", title: "< $1" };
  const c = formatCompact(n, { decimals: 2 });
  return { display: `$${c.display}`, title: `$${c.title}` };
}

export function hfLabel(hf: number | null): string {
  if (hf == null || hf >= 100) return "∞";
  return hf.toFixed(2);
}

// Aave's risk thresholds: HF≥2 comfortable, ≥1.5 healthy, ≥1.2 warning,
// <1.2 danger, <1 already liquidatable.
export function hfColorClass(hf: number | null): string {
  if (hf == null || hf >= 2) return "text-green-400";
  if (hf >= 1.5) return "text-green-400";
  if (hf >= 1.2) return "text-yellow-400";
  return "text-red-400";
}

// Liq prices vary wildly: BTC at $100k vs USDC at $1. Scale formatting to the
// magnitude so we don't get either "$100,000.00" or "$0".
export function fmtLiqPrice(p: number): string {
  if (p < 0.01) return "< $0.01";
  if (p < 1) return "$" + p.toFixed(3);
  if (p < 100) return "$" + p.toFixed(2);
  if (p < 1_000) return "$" + p.toFixed(0);
  if (p < 1_000_000) return "$" + (p / 1000).toFixed(p < 10_000 ? 2 : 1) + "K";
  return "$" + (p / 1_000_000).toFixed(2) + "M";
}
