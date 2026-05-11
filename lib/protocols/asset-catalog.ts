/**
 * Shared shape for "what assets does this protocol scope accept, and on what
 * terms?". Powers the simulator's add-position picker (so users can model a
 * deposit/borrow for an asset they don't currently hold) and is the natural
 * source of truth for token<>protocol relationships across the app.
 *
 * One catalog per `(protocol, scope)` pair. Scope distinguishes per-spoke
 * (Aave V4), per-market (Compound V3, Morpho), or per-collateral-branch
 * (Liquity V2, f(x) V2) listings within a single protocol. Scope is null for
 * protocols with a single global pool (Aave V3, Spark).
 */
export interface CatalogAsset {
  symbol: string;
  /** Lower-cased ERC-20 address. */
  address: `0x${string}`;
  /** Can be deposited as supply / liquidity. */
  canSupply: boolean;
  /** Can be borrowed (or otherwise drawn) from this scope. */
  canBorrow: boolean;
  /** Counts toward HF / collateralisation when supplied. False for borrow-only
   *  listings (LT = 0). */
  canCollateral: boolean;
  /** Liquidation threshold as a decimal fraction (e.g. 0.825). Zero or absent
   *  for borrow-only assets. */
  lt?: number;
  /** Loan-to-value ceiling for new borrows backed by this asset. Currently
   *  only used as a display hint — the simulator drives off LT. */
  ltv?: number;
}

export interface AssetCatalog {
  /** Canonical protocol id matching `lib/shared/transit-helpers.ts:PROTOCOL_COLORS`. */
  protocol: string;
  /** Sub-scope name (e.g. spoke / market). Null for single-pool protocols. */
  scope: string | null;
  assets: CatalogAsset[];
}

/** Look up a single asset by symbol within a catalog. Returns null when the
 *  asset isn't listed for that scope. */
export function findCatalogAsset(catalog: AssetCatalog, symbol: string): CatalogAsset | null {
  return catalog.assets.find(a => a.symbol === symbol) ?? null;
}

/** Filter catalog to assets eligible for a given side. */
export function listSuppliable(catalog: AssetCatalog): CatalogAsset[] {
  return catalog.assets.filter(a => a.canSupply);
}

export function listBorrowable(catalog: AssetCatalog): CatalogAsset[] {
  return catalog.assets.filter(a => a.canBorrow);
}
