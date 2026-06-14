"use client";

// Shared price chip — a token icon + USD price, optionally prefixed with the
// asset symbol. Extracted from the near-identical PricePill copies that lived
// inside aave-v4-price-runway.tsx and trove-price-axis.tsx so both runways and
// the bottom price strip render prices the same way.

import { TokenChipIcon } from "@/components/shared/token-chip-icon";

/** Compact USD formatter shared across the price-display surfaces. */
export function fmtPrice(v: number): string {
  if (!isFinite(v) || v <= 0) return "–";
  if (v < 1) return `$${v.toFixed(4)}`;
  if (v < 100) return `$${v.toFixed(2)}`;
  if (v < 10_000) return `$${Math.round(v).toLocaleString()}`;
  if (v < 1_000_000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${(v / 1_000_000).toFixed(2)}M`;
}

/**
 * Snap a raw reference price to a clean, human-readable round number near it
 * (e.g. 4,706 → 5,000), so a runway's upper gridline reads as an at-a-glance
 * scale mark rather than a derived "caution threshold". Stays strictly above
 * `floor` (the liquidation price) so the band it anchors never degenerates.
 */
export function niceReferencePrice(raw: number, floor: number): number {
  if (!(raw > 0)) return raw;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const mults = [1, 2, 2.5, 5, 10];
  const candidates = Array.from(new Set([mag / 10, mag, mag * 10].flatMap((base) => mults.map((m) => m * base)))).sort(
    (a, b) => a - b,
  );
  let best = candidates.reduce((p, c) => (Math.abs(c - raw) < Math.abs(p - raw) ? c : p), candidates[0]);
  if (best <= floor) best = candidates.find((c) => c > floor) ?? raw;
  return best;
}

export interface PricePillProps {
  symbol: string;
  address?: string;
  price: number;
  /** Render the asset symbol before the price (used by the price strip). */
  showSymbol?: boolean;
  /** Forwarded to the token icon. Defaults to true to preserve the runway
   *  behaviour where icons act as token filters inside a TokenFilterProvider. */
  filterable?: boolean;
  /** Native tooltip — used when the symbol isn't shown inline (price strip) so
   *  hovering still reveals which asset the price is for. */
  title?: string;
  /** Drop the chip background so the price sits directly on its container
   *  surface (used by the price strip, which supplies its own dark backing). */
  bare?: boolean;
}

export function PricePill({
  symbol,
  address,
  price,
  showSymbol = false,
  filterable = true,
  title,
  bare = false,
}: PricePillProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs tabular-nums cursor-default${bare ? "" : " bg-sunken"}`}
    >
      <TokenChipIcon symbol={symbol} address={address} size={14} filterable={filterable} />
      {showSymbol && <span className="font-medium text-rb-500">{symbol}</span>}
      <span className="font-bold text-green-400">{fmtPrice(price)}</span>
    </span>
  );
}
