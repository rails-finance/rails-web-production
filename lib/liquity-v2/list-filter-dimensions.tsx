import type { FilterDimension, FilterOptionDef } from "@/components/shared/filter-bar/types";
import { joinOptionLabels } from "@/components/shared/filter-bar/types";
import type { TroveListFilterParams } from "@/lib/liquity-v2/list-filter-types";
import {
  defaultStatus,
  effectiveStatus,
  defaultShowZombie,
  effectiveShowZombie,
  type EffectiveStatus,
  type EffectiveShowZombie,
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
  // Status folds in two terminal/degenerate states as plain values:
  //   - Liquidated: a liquidated Liquity trove is terminal (the ID can't
  //     reopen), so "with liquidations" is just status=liquidated.
  //   - Zombie: an unredeemable (sub-min-debt) trove is a real protocol state.
  //     The API exposes it as a separate `showZombie` flag, so we map the
  //     (status, zombie) pair onto a single key here.
  // No standalone "All": no selection already means the contextual default
  // (active on the bare directory, full history on a scoped wallet/trove query —
  // see listing-visibility.ts), so an explicit "all" would either duplicate
  // Reset (scoped) or be the directory's show-everything, which clearing covers.
  const STATUS_LABEL: Record<string, string> = {
    active: "Active",
    zombie: "Zombie",
    closed: "Closed",
    liquidated: "Liquidated",
  };
  // Collapse the (status, zombie) pair into one key. null = "everything" (no
  // specific state) → no selection / no chip.
  const statusKey = (s: EffectiveStatus, z: EffectiveShowZombie): string | null => {
    if (s === "closed") return "closed";
    if (s === "liquidated") return "liquidated";
    if (z === true) return "zombie";
    if (s === "open" && z === false) return "active";
    return null;
  };
  const status: Dim = {
    id: "status",
    label: "Status",
    group: "Status",
    cardinality: "single",
    options: [
      { value: "active", label: "Active" },
      { value: "zombie", label: "Zombie" },
      { value: "closed", label: "Closed" },
      { value: "liquidated", label: "Liquidated" },
    ],
    get: (f) => {
      const k = statusKey(effectiveStatus(f), effectiveShowZombie(f));
      return k ? [k] : [];
    },
    defaultValues: (f) => {
      const k = statusKey(defaultStatus(f), defaultShowZombie(f));
      return k ? [k] : [];
    },
    set: (f, values) => {
      const v = values[0];
      let nextStatus: string | undefined;
      let nextZombie: boolean | "all" | undefined;
      if (v === "active") {
        nextStatus = "open";
        nextZombie = false;
      } else if (v === "zombie") {
        nextStatus = "open";
        nextZombie = true;
      } else if (v === "closed") {
        nextStatus = "closed";
      } else if (v === "liquidated") {
        nextStatus = "liquidated";
      }
      // Write undefined when the choice equals the contextual default so the
      // default is never baked in (keeps auto-relax-on-scope working).
      return {
        ...f,
        status: nextStatus === defaultStatus(f) ? undefined : nextStatus,
        showZombie: nextZombie === defaultShowZombie(f) ? undefined : nextZombie,
      };
    },
    chipLabel: (vals) => STATUS_LABEL[vals[0]] ?? vals[0],
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
