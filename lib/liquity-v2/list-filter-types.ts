// Liquity V2 listing filter param shape. Extracted from TroveListFilters so the
// dimension registry (lib/liquity-v2/list-filter-dimensions) can import it
// without pulling in the "use client" component. Re-exported from the component
// for existing callers (the listing page). Visibility helpers live separately in
// lib/liquity-v2/listing-visibility.ts.

import type { StatusBucket } from "@/lib/liquity-v2/listing-visibility";

export interface TroveListFilterParams {
  troveId?: string;
  /** Multi-select status buckets (active / zombie / closed / liquidated).
   *  Empty/undefined = use the contextual default (active on the bare directory,
   *  everything on a scoped wallet/trove query). See listing-visibility.ts. */
  statuses?: StatusBucket[];
  /** Multi-select collateral types. Empty/undefined = all. */
  collateralTypes?: string[];
  ownerAddress?: string;
  ownerEns?: string;
  activeWithin?: string;
  createdWithin?: string;
  batchOnly?: boolean;
  individualOnly?: boolean;
  hasRedemptions?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
