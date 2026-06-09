import type { FilterDimension, FilterOptionDef } from "@/components/shared/filter-bar/types";
import { joinOptionLabels } from "@/components/shared/filter-bar/types";
import type { TroveListFilterParams } from "@/lib/liquity-v2/list-filter-types";
import {
  defaultStatus,
  effectiveStatus,
  defaultShowZombie,
  effectiveShowZombie,
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
  // Liquidated is a status value here, not a separate axis: a liquidated Liquity
  // trove is terminal (the ID can't reopen), so "with liquidations" is just
  // status=liquidated.
  const STATUS_LABEL: Record<string, string> = {
    all: "All statuses",
    open: "Active",
    closed: "Closed",
    liquidated: "Liquidated",
  };
  const status: Dim = {
    id: "status",
    label: "Status",
    group: "Status",
    cardinality: "single",
    options: [
      { value: "open", label: "Active" },
      { value: "closed", label: "Closed" },
      { value: "liquidated", label: "Liquidated" },
      { value: "all", label: "All statuses" },
    ],
    get: (f) => [effectiveStatus(f)],
    defaultValues: (f) => [defaultStatus(f)],
    set: (f, values) => {
      const v = values[0];
      return { ...f, status: !v || v === defaultStatus(f) ? undefined : v };
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

  const ZOMBIE_LABEL: Record<string, string> = {
    all: "Include zombies",
    only: "Only zombies",
    hide: "Hide zombies",
  };
  const zombieKey = (z: "all" | boolean): string => (z === "all" ? "all" : z ? "only" : "hide");
  const zombie: Dim = {
    id: "zombie",
    label: "Zombies",
    group: "Zombies",
    cardinality: "single",
    options: [
      { value: "only", label: "Only zombies" },
      { value: "hide", label: "Hide zombies" },
      { value: "all", label: "Include zombies" },
    ],
    get: (f) => [zombieKey(effectiveShowZombie(f))],
    defaultValues: (f) => [zombieKey(defaultShowZombie(f))],
    set: (f, values) => {
      const v = values[0];
      const defKey = zombieKey(defaultShowZombie(f));
      const resolved: boolean | "all" | undefined =
        v === "all" ? "all" : v === "only" ? true : v === "hide" ? false : undefined;
      return { ...f, showZombie: !v || v === defKey ? undefined : resolved };
    },
    chipLabel: (vals) => ZOMBIE_LABEL[vals[0]] ?? vals[0],
  };

  return [status, collateral, redemptions, delegation, zombie];
}
