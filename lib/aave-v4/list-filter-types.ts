// Aave V4 listing filter param shape + visibility helpers. Extracted from the
// filter component so the dimension registry (lib/aave-v4/list-filter-dimensions)
// can import these without a runtime cycle through the React component.

import type { AaveV4StatusBucket } from "@/lib/aave-v4/listing-visibility";

export type AaveV4Debt = "all" | "withDebt" | "noDebt";
// "underwater" = HF < 1.0 (liquidatable — a factual on-chain state, not a risk
// opinion). No "at risk" band: Rails doesn't editorialize where a still-healthy
// position sits; the HF value carries that.
export type AaveV4Health = "all" | "underwater";
/** Tri-state liquidation filter. "with" → positions liquidated at least
 *  once, "without" → positions never liquidated, "all" → no restriction. */
export type AaveV4Liquidations = "all" | "with" | "without";
/** Visibility tier — now dust-only. The open/closed/liquidated axis moved to the
 *  first-class Status filter (see listing-visibility.ts / server migration 034);
 *  the two can't independently own "closed" (a USD "$0" cut would strip the very
 *  closed rows a Status=Closed selection asks for). So this narrowed to: "nodust"
 *  hides positions under the dust line; "all" shows everything (the default). */
export type AaveV4Show = "all" | "nodust";

/** Dust line for the "Hide dust" toggle — combined supply + debt below this (USD)
 *  is hidden. Applies within the (open) positions that Status already admits. */
export const AAVE_V4_DUST_USD = 100;

export interface AaveV4ListFilterParams {
  wallet?: string;
  ownerEns?: string;
  /** Multi-select spoke keys. Empty = all spokes. */
  spokes: string[];
  /** Multi-select hub tiers (lowercase keys: "core", "plus", "prime"). */
  hubs: string[];
  /** Multi-select token symbols on the supply side. "???" matches unknown
   *  reserves. Empty = no restriction. */
  supplyAssets: string[];
  /** Multi-select token symbols on the debt side. ANDs with `supplyAssets`
   *  server-side. Empty = no restriction. */
  borrowAssets: string[];
  debt: AaveV4Debt;
  health: AaveV4Health;
  liquidations: AaveV4Liquidations;
  /** Structural lifecycle status buckets (open / closed). Raw intent:
   *  undefined / [] = the contextual default (the full set — everything), which
   *  maps to no server-side status filter. A concrete subset is an explicit
   *  choice. Liquidation is a separate orthogonal axis (see `liquidations` and
   *  listing-visibility.ts). */
  statuses?: AaveV4StatusBucket[];
  /** Dust visibility. Raw intent: undefined = default ("all"). "nodust" hides
   *  positions under the dust line. */
  show?: AaveV4Show;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

/** Dust visibility default — always "all" (show everything). Dust hiding is an
 *  explicit opt-in, not a contextual default; the open/closed axis it used to
 *  carry now lives on the Status filter (listing-visibility.ts). */
export function aaveV4ShowDefault(): AaveV4Show {
  return "all";
}

export function effectiveAaveV4Show(f: { show?: AaveV4Show }): AaveV4Show {
  return f.show ?? aaveV4ShowDefault();
}
