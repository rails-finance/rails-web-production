// Shared number formatters for Aave V4 position surfaces. Lifted out of
// components/protocol/aave-v4/aave-v4-spoke-card.tsx so the listing card
// (AaveV4PositionListingCard) renders identical values to the detail card —
// same "$575.4K" cutoff, same "< $1" rule, same HF rounding, same liq-price
// magnitude scaling. Single source of truth.

import { formatCompact } from "@/lib/shared/format-event";

// Sub-$1 values use 2 decimals ("$0.40") so a $2.48-of-which-$0.40-debt test
// position stays legible. Only collapse to "< $0.01" for true dust where the
// cents-rounding would lie ("$0.00" is worse than "< $0.01").
export function fmtUsd(n: number): { display: string; title: string } {
  if (n < 0.01) return { display: "< $0.01", title: "< $0.01" };
  const c = formatCompact(n, { decimals: 2 });
  return { display: `$${c.display}`, title: `$${c.title}` };
}

export function hfLabel(hf: number | null): string {
  if (hf == null || hf >= 100) return "∞";
  return hf.toFixed(2);
}

// Health-factor value color. Intentionally neutral at every level — Rails
// doesn't color-code risk valence (green=safe / red=danger); the numeric HF
// and the headroom readout carry the meaning. Kept as a function so call sites
// don't need to change.
export function hfColorClass(_hf: number | null): string {
  return "text-foreground/80";
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
