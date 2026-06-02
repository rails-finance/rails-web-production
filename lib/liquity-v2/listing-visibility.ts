// Visibility resolution for the Liquity V2 listing.
//
// The listing doubles as a wallet / trove view. On the bare directory we hide
// closed, liquidated, and zombie (sub-min-debt, near-zero) troves by default;
// when the query is scoped to a specific identity — an owner address, an ENS
// name, or a single trove ID — we relax to "show everything" so a wallet's
// full history, including closed and liquidated troves, is visible. That's the
// self-service-support case: someone looking up their own address wants the
// closed trove surfaced, not filtered away.
//
// `status` / `showZombie` on the filter object carry RAW user intent:
//   - undefined  → "no opinion": resolve to the contextual default
//   - "all"      → explicit "show everything" (no server-side filter)
//   - concrete   → an explicit choice (open/closed/liquidated; true/false)
//
// Keeping an untouched filter `undefined` is what makes auto-relax work with no
// boundary-reset bookkeeping: typing a wallet never carries a stale "open"
// default, because the default is never written into the object — it's only
// applied here, at read time, once we know whether the query is scoped.
//
// Both the listing page (URL <-> API serialization) and TroveListFilters
// (button highlighting + active-filter count) resolve effective values through
// this module so the two halves can never drift.

/** Just the filter fields visibility depends on — structural, so the page's
 *  TroveListFilterParams satisfies it without an import cycle. */
export interface ListingVisibilityInput {
  status?: string;
  showZombie?: boolean | "all";
  ownerAddress?: string;
  ownerEns?: string;
  troveId?: string;
}

/** Effective status. "all" means no status filter is applied. */
export type EffectiveStatus = "all" | "open" | "closed" | "liquidated";
/** Effective zombie visibility. "all" = show everything including zombies. */
export type EffectiveShowZombie = "all" | boolean;

/** A query is "scoped" when it targets a specific identity (owner address, ENS
 *  name, or a single trove ID). Scoped queries show full history by default;
 *  the bare directory hides dead positions by default. */
export function isScopedQuery(f: ListingVisibilityInput): boolean {
  return Boolean(f.ownerAddress || f.ownerEns || f.troveId);
}

export function defaultStatus(f: ListingVisibilityInput): EffectiveStatus {
  return isScopedQuery(f) ? "all" : "open";
}

export function defaultShowZombie(f: ListingVisibilityInput): EffectiveShowZombie {
  return isScopedQuery(f) ? "all" : false;
}

export function effectiveStatus(f: ListingVisibilityInput): EffectiveStatus {
  return (f.status as EffectiveStatus | undefined) ?? defaultStatus(f);
}

export function effectiveShowZombie(f: ListingVisibilityInput): EffectiveShowZombie {
  return f.showZombie ?? defaultShowZombie(f);
}
