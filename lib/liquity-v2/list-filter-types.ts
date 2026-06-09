// Liquity V2 listing filter param shape. Extracted from TroveListFilters so the
// dimension registry (lib/liquity-v2/list-filter-dimensions) can import it
// without pulling in the "use client" component. Re-exported from the component
// for existing callers (the listing page). Visibility helpers live separately in
// lib/liquity-v2/listing-visibility.ts.

export interface TroveListFilterParams {
  troveId?: string;
  status?: string;
  /** Multi-select collateral types. Empty/undefined = all. */
  collateralTypes?: string[];
  ownerAddress?: string;
  ownerEns?: string;
  activeWithin?: string;
  createdWithin?: string;
  batchOnly?: boolean;
  individualOnly?: boolean;
  hasRedemptions?: boolean;
  /** Zombie visibility. true = only zombies, false = hide zombies,
   *  "all" = explicit show-everything, undefined = use contextual default. */
  showZombie?: boolean | "all";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
