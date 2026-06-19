import type { FilterDimension, FilterOptionDef } from "@/components/shared/filter-bar/types";
import { joinOptionLabels } from "@/components/shared/filter-bar/types";
import type { TroveListFilterParams } from "@/lib/liquity-v2/list-filter-types";
import {
  canonicalStatuses,
  defaultStatuses,
  effectiveStatuses,
  sameStatusSet,
} from "@/lib/liquity-v2/listing-visibility";

type Dim = FilterDimension<TroveListFilterParams>;

/** Chip label that uses the option labels verbatim (no `Dimension:` prefix) —
 *  for self-describing single-select states like "Redeemed" / "Delegated". */
function bareLabel(values: string[], options: FilterOptionDef[]): string {
  return joinOptionLabels(values, options);
}

/**
 * Liquity V2 listing filter dimensions. Collateral options (token icons) are
 * injected so this stays a pure builder. Order here is the order of the section
 * dropdowns; each dimension lives in its own single-dimension group so the
 * dropdown button names it (the per-dimension header is suppressed).
 *
 * Status and zombie visibility carry a contextual default (the listing doubles
 * as a wallet view — see lib/liquity-v2/listing-visibility.ts): the default maps
 * to NO chip, and `set` writes `undefined` rather than the default value so the
 * auto-relax-on-scope behavior is preserved (a stale "open" is never baked in).
 */
export function troveFilterDimensions({ collateralOptions }: { collateralOptions: FilterOptionDef[] }): Dim[] {
  // Status is a multi-select over four buckets. Zombie (an unredeemable
  // sub-min-debt trove) and Liquidated (a terminal state) are real protocol
  // states surfaced as first-class buckets alongside Active/Closed; the server
  // resolves the selection onto (status, is_zombie) predicates. Selecting all
  // four = "show everything" (no server filter). No selection = the contextual
  // default (active on the bare directory, everything on a scoped wallet/trove
  // query — see listing-visibility.ts), so `set` writes `undefined` whenever the
  // choice equals that default, keeping auto-relax-on-scope working and URLs
  // clean.
  const status: Dim = {
    id: "status",
    label: "Status",
    group: "Status",
    cardinality: "multi",
    options: [
      { value: "active", label: "Active" },
      { value: "zombie", label: "Zombie" },
      { value: "closed", label: "Closed" },
      { value: "liquidated", label: "Liquidated" },
    ],
    get: (f) => effectiveStatuses(f),
    defaultValues: (f) => defaultStatuses(f),
    set: (f, values) => {
      const sel = canonicalStatuses(values);
      const def = defaultStatuses(f);
      // Write undefined when the selection is empty (clearing returns to the
      // default) or matches the contextual default, so the default is never
      // baked into the URL and auto-relax-on-scope keeps working.
      return {
        ...f,
        statuses: sel.length === 0 || sameStatusSet(sel, def) ? undefined : sel,
      };
    },
    chipLabel: (vals, opts) => `Status: ${joinOptionLabels(canonicalStatuses(vals), opts)}`,
  };

  const collateral: Dim = {
    id: "collateralTypes",
    label: "Collateral",
    group: "Collateral",
    cardinality: "multi",
    options: collateralOptions,
    get: (f) => f.collateralTypes ?? [],
    set: (f, values) => ({ ...f, collateralTypes: values.length > 0 ? values : undefined }),
    chipLabel: (vals, opts) => `Collateral: ${joinOptionLabels(vals, opts)}`,
  };

  const redemptions: Dim = {
    id: "redemptions",
    label: "Redemptions",
    group: "Redemptions",
    cardinality: "single",
    options: [
      { value: "with", label: "Redeemed" },
      { value: "without", label: "Never redeemed" },
    ],
    get: (f) => (f.hasRedemptions === true ? ["with"] : f.hasRedemptions === false ? ["without"] : []),
    set: (f, values) => ({
      ...f,
      hasRedemptions: values[0] === "with" ? true : values[0] === "without" ? false : undefined,
    }),
    chipLabel: bareLabel,
  };

  // batchOnly (delegated to a batch manager) vs individualOnly (self-managed
  // interest rate) — mutually exclusive, mapped onto the two boolean fields.
  const delegation: Dim = {
    id: "delegation",
    label: "Delegation",
    group: "Delegation",
    cardinality: "single",
    options: [
      { value: "delegated", label: "Delegated" },
      { value: "individual", label: "Individual" },
    ],
    get: (f) => (f.batchOnly ? ["delegated"] : f.individualOnly ? ["individual"] : []),
    set: (f, values) => ({
      ...f,
      batchOnly: values[0] === "delegated" ? true : undefined,
      individualOnly: values[0] === "individual" ? true : undefined,
    }),
    chipLabel: bareLabel,
  };

  return [status, collateral, redemptions, delegation];
}
