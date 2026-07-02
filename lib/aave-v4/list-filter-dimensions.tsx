import Link from "next/link";
import type { FilterDimension, FilterOptionDef } from "@/components/shared/filter-bar/types";
import { joinOptionLabels } from "@/components/shared/filter-bar/types";
import { PAGE_LINK } from "@/lib/shared/ui-grammar";
import { type AaveV4ListFilterParams, effectiveAaveV4Show } from "@/lib/aave-v4/list-filter-types";
import { canonicalStatuses, defaultStatuses, effectiveStatuses, sameStatusSet } from "@/lib/aave-v4/listing-visibility";

type Dim = FilterDimension<AaveV4ListFilterParams>;

const HUB_OPTIONS: FilterOptionDef[] = [
  { value: "core", label: "Core" },
  { value: "plus", label: "Plus" },
  { value: "prime", label: "Prime" },
];

const SPOKE_OPTIONS: FilterOptionDef[] = [
  { value: "main", label: "Main" },
  { value: "bluechip", label: "Bluechip" },
  { value: "ethena_corr", label: "Ethena Correlated" },
  { value: "ethena_eco", label: "Ethena Ecosystem" },
  { value: "etherfi", label: "EtherFi" },
  { value: "forex", label: "Forex" },
  { value: "gold", label: "Gold" },
  { value: "kelp", label: "Kelp" },
  { value: "lido", label: "Lido" },
  { value: "lombard", label: "Lombard BTC" },
];

/** Each spoke belongs to exactly one hub — Aave V4 market topology, fixed at
 *  deployment (mirrors the backend's SPOKE_BY_KEY `hub` field). This is the
 *  hub→spoke layer of the same parent-scopes-child logic the asset pills use;
 *  unlike asset availability it's static structure, not chain config. */
const SPOKE_HUB: Record<string, string> = {
  main: "core",
  forex: "core",
  gold: "core",
  bluechip: "prime",
  ethena_corr: "plus",
  ethena_eco: "plus",
  etherfi: "core",
  kelp: "core",
  lido: "core",
  lombard: "core",
};

/** Spoke options scoped to the selected hubs — all spokes when no hub is
 *  selected, else only the members of those hubs. */
export function spokeOptionsForHubs(hubs: string[]): FilterOptionDef[] {
  if (hubs.length === 0) return SPOKE_OPTIONS;
  const set = new Set(hubs);
  return SPOKE_OPTIONS.filter((o) => set.has(SPOKE_HUB[o.value]));
}

/** Drop selected spokes that don't belong to the selected hubs. Keeps the
 *  hub ∩ spoke filter from silently going empty when a hub change orphans a
 *  previously-picked spoke. */
export function pruneSpokesForHubs(spokes: string[], hubs: string[]): string[] {
  if (hubs.length === 0) return spokes;
  const set = new Set(hubs);
  return spokes.filter((s) => set.has(SPOKE_HUB[s]));
}

/** Chip label that uses the option labels verbatim (no `Dimension:` prefix) —
 *  for self-describing single-select states like "Borrowing" / "Liquidatable". */
function bareLabel(values: string[], options: FilterOptionDef[]): string {
  return joinOptionLabels(values, options);
}

/**
 * Aave V4 listing filter dimensions. Asset options are injected (the supply /
 * borrow universe is fetched async) so this stays a pure builder. The Supplying
 * and Borrowing pills take separate option lists so each can mute assets never
 * seen on its side (asSupply / asDebt) — advisory dimming, not removal, since
 * the flags are empirical. Order here is the order of the + Filter menu; `group`
 * inserts the section headers.
 */
export function aaveV4FilterDimensions({
  supplyOptions,
  borrowOptions,
  spokeOptions,
}: {
  supplyOptions: FilterOptionDef[];
  borrowOptions: FilterOptionDef[];
  spokeOptions: FilterOptionDef[];
}): Dim[] {
  // Lifecycle status — the STRUCTURAL axis: open | closed (does the position hold
  // a live balance). Two buckets only. Liquidation is NOT a status here — Aave
  // liquidations are partial and survivable, so "liquidated" lives on the
  // orthogonal History toggle below (a liquidated position can be open or closed).
  // See rails-ops/reference/events-and-liquidations-across-protocols.md. "Closed"
  // admits closed-by-owner and closed-by-liquidation alike (the card draws that
  // distinction). Default is the full set (everything, in every context — see
  // listing-visibility.ts), so `set` writes `undefined` whenever the selection is
  // empty or the full set, keeping the default out of the URL and clearing →
  // "show everything". The dust toggle below is orthogonal (it thins the open
  // positions Status admits, it doesn't decide open vs closed).
  const status: Dim = {
    id: "status",
    label: "Status",
    group: "Status",
    cardinality: "multi",
    options: [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ],
    get: (f) => effectiveStatuses(f),
    defaultValues: () => defaultStatuses(),
    set: (f, values) => {
      const sel = canonicalStatuses(values);
      return {
        ...f,
        statuses: sel.length === 0 || sameStatusSet(sel, defaultStatuses()) ? undefined : sel,
      };
    },
    chipLabel: (vals, opts) => `Status: ${joinOptionLabels(canonicalStatuses(vals), opts)}`,
  };

  // Position state — one mutually-exclusive axis read off the health factor,
  // the filter twin of the card's health pill (lib/aave-v4/health-bucket). A
  // position is exactly one of: Supply only (no borrow), Borrowing (has a
  // loan), Liquidatable (HF < 1). Stored across the existing `debt` + `health`
  // params so the page→backend mapping (noDebt / hasDebt / healthBelow) and the
  // URL shape are unchanged; only the surfaced control changes.
  //
  // Caveat: the backend exposes `healthBelow` but no `healthAbove`, so
  // "Borrowing" resolves to `hasDebt` — which still includes the (rare)
  // liquidatable rows. "Liquidatable" narrows to exactly HF < 1. A strict
  // healthy-only "Borrowing" would need a `healthAbove` predicate added
  // server-side in rails-server-mig.
  const state: Dim = {
    id: "state",
    label: "Position state",
    group: "Status",
    cardinality: "single",
    options: [
      { value: "supplyOnly", label: "Supply only" },
      { value: "borrowing", label: "Borrowing" },
      { value: "liquidatable", label: "Liquidatable" },
    ],
    get: (f) => {
      if (f.health === "underwater") return ["liquidatable"];
      if (f.debt === "noDebt") return ["supplyOnly"];
      if (f.debt === "withDebt") return ["borrowing"];
      return [];
    },
    set: (f, values) => {
      switch (values[0]) {
        case "liquidatable":
          return { ...f, debt: "all", health: "underwater" };
        case "supplyOnly":
          return { ...f, debt: "noDebt", health: "all" };
        case "borrowing":
          return { ...f, debt: "withDebt", health: "all" };
        default:
          return { ...f, debt: "all", health: "all" };
      }
    },
    chipLabel: bareLabel,
  };

  // Liquidation history — orthogonal to current state (a position can be
  // Borrowing now AND have been liquidated before), so it's a separate toggle
  // under its own "History" sub-header inside the Status panel, not a sibling
  // of the state ladder and not its own top-level filter (a whole dropdown for
  // one rare flag is too much chrome). A lone toggle: "Liquidated before" shows
  // positions liquidated at least once; its absence is the silent majority
  // (never liquidated), so that half isn't offered as a separate option.
  const liquidated: Dim = {
    id: "liquidations",
    label: "History",
    group: "Status",
    cardinality: "single",
    options: [{ value: "with", label: "Liquidated before" }],
    get: (f) => (f.liquidations === "with" ? ["with"] : []),
    set: (f, values) => ({ ...f, liquidations: values[0] === "with" ? "with" : "all" }),
    chipLabel: bareLabel,
  };

  const hubs: Dim = {
    id: "hubs",
    label: "Hub",
    group: "Market",
    cardinality: "multi",
    options: HUB_OPTIONS,
    // Link to the cross-hub comparison surface, beside the Hub title. Blue
    // (PAGE_LINK) because it navigates to a page, not a reset action.
    labelAction: (
      <Link href="/aave-v4/hubs" className={PAGE_LINK} onClick={(e) => e.stopPropagation()}>
        Compare
      </Link>
    ),
    get: (f) => f.hubs,
    // Selecting/changing hubs prunes any now-orphaned spoke selections so the
    // hub ∩ spoke intersection never silently empties.
    set: (f, values) => ({ ...f, hubs: values, spokes: pruneSpokesForHubs(f.spokes, values) }),
    chipLabel: (vals, opts) => `Hub: ${joinOptionLabels(vals, opts)}`,
  };

  const spokes: Dim = {
    id: "spokes",
    label: "Spoke",
    group: "Market",
    cardinality: "multi",
    options: spokeOptions,
    get: (f) => f.spokes,
    set: (f, values) => ({ ...f, spokes: values }),
    chipLabel: (vals, opts) => `Spoke: ${joinOptionLabels(vals, opts)}`,
  };

  const supplying: Dim = {
    id: "supplyAssets",
    label: "Supplying",
    group: "Supply",
    cardinality: "multi",
    options: supplyOptions,
    get: (f) => f.supplyAssets,
    set: (f, values) => ({ ...f, supplyAssets: values }),
    chipLabel: (vals, opts) => `Supplying: ${joinOptionLabels(vals, opts)}`,
  };

  const borrowing: Dim = {
    id: "borrowAssets",
    label: "Borrowing",
    group: "Borrow",
    cardinality: "multi",
    options: borrowOptions,
    get: (f) => f.borrowAssets,
    set: (f, values) => ({ ...f, borrowAssets: values }),
    chipLabel: (vals, opts) => `Borrowing: ${joinOptionLabels(vals, opts)}`,
  };

  // Dust — a lone toggle (mirrors the History toggle), orthogonal to Status.
  // On: hides positions under the dust line (minTotalUsd). Off (absent) is the
  // silent majority. The old three-tier Visibility ladder collapsed to this once
  // Status took over the open/closed axis — a "$0 active" cut would contradict a
  // Status=Closed selection (it would strip the very rows asked for). `get`
  // reports the effective state.
  const dust: Dim = {
    id: "show",
    label: "Dust",
    group: "View",
    cardinality: "single",
    options: [{ value: "nodust", label: "Hide dust" }],
    get: (f) => (effectiveAaveV4Show(f) === "nodust" ? ["nodust"] : []),
    set: (f, values) => ({ ...f, show: values[0] === "nodust" ? "nodust" : undefined }),
    chipLabel: bareLabel,
  };

  // Status group leads (lifecycle Status, then the position-state ladder, then
  // the History toggle); then Market / Supply / Borrow, and the Dust toggle under
  // View.
  return [status, state, liquidated, hubs, spokes, supplying, borrowing, dust];
}
