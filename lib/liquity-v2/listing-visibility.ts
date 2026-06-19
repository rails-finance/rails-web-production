// Visibility resolution for the Liquity V2 listing.
//
// The listing doubles as a wallet / trove view, and the default in every case is
// "show everything" — active, zombie, closed, and liquidated troves are all
// visible out of the box, on the bare directory and on a scoped wallet/trove
// query alike. That's the self-service-support case: someone looking up their
// own address wants the closed trove surfaced, not filtered away — and a visitor
// browsing the directory sees the full picture rather than an active-only slice.
//
// Status is a MULTI-SELECT over four display buckets — active / zombie / closed
// / liquidated. (Zombie is not a stored status; on the server it's open +
// is_zombie. We expose it as a first-class bucket here and the server resolves
// the four buckets onto (status, is_zombie) predicates.) The selection is
// serialized as a single comma-separated `status` URL param, e.g.
// `?status=active,zombie,liquidated`.
//
// `statuses` on the filter object carries RAW user intent:
//   - undefined / []  → "no opinion": resolve to the contextual default
//   - a concrete set  → an explicit choice
//
// Keeping an untouched filter `undefined` keeps the default out of the filter
// object: the full-set default is never written in, only applied here at read
// time, so a cleared selection always resolves back to "show everything".
//
// Both the listing page (URL <-> API serialization) and TroveListFilters
// (chip + active-count) resolve effective values through this module so the two
// halves can never drift.

/** The four display buckets the Status filter exposes. */
export type StatusBucket = "active" | "zombie" | "closed" | "liquidated";

/** Canonical order — used for stable URL/chip serialization and set compares. */
export const ALL_STATUS_BUCKETS: StatusBucket[] = ["active", "zombie", "closed", "liquidated"];

export function isStatusBucket(v: string): v is StatusBucket {
  return (ALL_STATUS_BUCKETS as string[]).includes(v);
}

/** Reduce an arbitrary token list to valid buckets, deduped, in canonical order. */
export function canonicalStatuses(values: string[]): StatusBucket[] {
  const set = new Set(values.filter(isStatusBucket));
  return ALL_STATUS_BUCKETS.filter((b) => set.has(b));
}

/** Order-independent equality of two bucket selections. */
export function sameStatusSet(a: StatusBucket[], b: StatusBucket[]): boolean {
  if (a.length !== b.length) return false;
  const bs = new Set(b);
  return a.every((x) => bs.has(x));
}

/** Just the filter fields visibility depends on — structural, so the page's
 *  TroveListFilterParams satisfies it without an import cycle. */
export interface ListingVisibilityInput {
  statuses?: StatusBucket[];
  ownerAddress?: string;
  ownerEns?: string;
  troveId?: string;
}

/** A query is "scoped" when it targets a specific identity (owner address, ENS
 *  name, or a single trove ID). Status defaults to the full set regardless of
 *  scope; this predicate remains for callers that care about identity scope. */
export function isScopedQuery(f: ListingVisibilityInput): boolean {
  return Boolean(f.ownerAddress || f.ownerEns || f.troveId);
}

/** The contextual default selection: the full set (everything) in all cases —
 *  bare directory and scoped wallet/trove query alike. The bare `/liquity-v2`
 *  view shows active, zombie, closed, and liquidated troves out of the box, and
 *  because the full set maps to NO server-side status filter the canonical URL
 *  stays clean (no `status=` param). */
export function defaultStatuses(_f: ListingVisibilityInput): StatusBucket[] {
  return [...ALL_STATUS_BUCKETS];
}

/** The selection actually in effect: an explicit non-empty choice wins; an empty
 *  or absent selection resolves to the contextual default (you can never view
 *  zero buckets — clearing returns to the default). */
export function effectiveStatuses(f: ListingVisibilityInput): StatusBucket[] {
  const sel = canonicalStatuses(f.statuses ?? []);
  return sel.length > 0 ? sel : defaultStatuses(f);
}

/** True when the effective selection is the full set — i.e. "show everything",
 *  which maps to NO server-side status filter. */
export function isAllStatuses(f: ListingVisibilityInput): boolean {
  return effectiveStatuses(f).length === ALL_STATUS_BUCKETS.length;
}
