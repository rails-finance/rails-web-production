// Aave V4 listing filter param shape + visibility helpers. Extracted from the
// filter component so the dimension registry (lib/aave-v4/list-filter-dimensions)
// can import these without a runtime cycle through the React component.

export type AaveV4Debt = "all" | "withDebt" | "noDebt";
// "underwater" = HF < 1.0 (liquidatable — a factual on-chain state, not a risk
// opinion). No "at risk" band: Rails doesn't editorialize where a still-healthy
// position sits; the HF value carries that.
export type AaveV4Health = "all" | "underwater";
/** Tri-state liquidation filter. "with" → positions liquidated at least
 *  once, "without" → positions never liquidated, "all" → no restriction. */
export type AaveV4Liquidations = "all" | "with" | "without";
/** Visibility tier. "active" hides effectively-closed positions (supply and
 *  debt both ~$0); "nodust" additionally hides anything under the dust line;
 *  "all" shows everything including closed. */
export type AaveV4Show = "all" | "active" | "nodust";

/** Dust line for the "No dust" tier — combined supply + debt below this (USD)
 *  is hidden. Closed/near-zero (the "active" tier) is a fixed <$1 server-side. */
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
  /** Visibility tier. Raw intent: undefined = use the contextual default
   *  (active on the bare directory, all on a wallet-scoped query). */
  show?: AaveV4Show;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

/** The listing doubles as a wallet view. The bare directory hides closed /
 *  near-zero positions by default; a wallet/ENS-scoped query relaxes to "all"
 *  so a wallet's full history is visible (see the Liquity rail for the same
 *  rule). `show` carries raw intent — undefined means "use this default". */
export function aaveV4ShowDefault(f: { wallet?: string; ownerEns?: string }): AaveV4Show {
  return f.wallet || f.ownerEns ? "all" : "active";
}

export function effectiveAaveV4Show(f: { show?: AaveV4Show; wallet?: string; ownerEns?: string }): AaveV4Show {
  return f.show ?? aaveV4ShowDefault(f);
}
