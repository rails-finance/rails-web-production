import type { FilterDimension, FilterOptionDef } from "@/components/shared/filter-bar/types";
import { joinOptionLabels } from "@/components/shared/filter-bar/types";
import {
  type AaveV4ListFilterParams,
  type AaveV4Debt,
  type AaveV4Liquidations,
  type AaveV4Show,
  aaveV4ShowDefault,
  effectiveAaveV4Show,
} from "@/lib/aave-v4/list-filter-types";

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
 *  for self-describing single-select states like "Underwater" / "With debt". */
function bareLabel(values: string[], options: FilterOptionDef[]): string {
  return joinOptionLabels(values, options);
}

/** A single-select enum dimension mapped onto one param field whose "off" value
 *  is the sentinel `all` (which the UI represents as the empty selection). */
function enumDim<K extends string>(args: {
  id: string;
  label: string;
  group: string;
  field: "debt" | "liquidations";
  options: { value: K; label: string }[];
}): Dim {
  return {
    id: args.id,
    label: args.label,
    group: args.group,
    cardinality: "single",
    options: args.options,
    get: (f) => {
      const v = f[args.field] as string;
      return v && v !== "all" ? [v] : [];
    },
    set: (f, values) => ({ ...f, [args.field]: (values[0] ?? "all") as K | "all" }),
    chipLabel: bareLabel,
  };
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
  const health: Dim = {
    id: "health",
    label: "Health",
    group: "Status",
    cardinality: "single",
    options: [{ value: "underwater", label: "Underwater" }],
    get: (f) => (f.health === "underwater" ? ["underwater"] : []),
    set: (f, values) => ({ ...f, health: values[0] === "underwater" ? "underwater" : "all" }),
    chipLabel: bareLabel,
  };

  const debt = enumDim<AaveV4Debt>({
    id: "debt",
    label: "Debt",
    group: "Status",
    field: "debt",
    options: [
      { value: "withDebt", label: "With debt" },
      { value: "noDebt", label: "Supply only" },
    ],
  });

  const liquidations = enumDim<AaveV4Liquidations>({
    id: "liquidations",
    label: "Liquidations",
    group: "Status",
    field: "liquidations",
    options: [
      { value: "with", label: "Liquidated" },
      { value: "without", label: "Never liquidated" },
    ],
  });

  const hubs: Dim = {
    id: "hubs",
    label: "Hub",
    group: "Market",
    cardinality: "multi",
    options: HUB_OPTIONS,
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

  // Visibility carries a contextual default (active on the bare directory, all
  // on a wallet-scoped query). `defaultValues` maps that default to "no chip",
  // so the quiet wallet-view resting state stays quiet — only an explicit
  // override surfaces a chip. `get` always reports the effective state so the
  // picker's radio reflects the current view even at default.
  const visibility: Dim = {
    id: "show",
    label: "Visibility",
    group: "View",
    cardinality: "single",
    // One monotonic strictness ladder, not three independent toggles:
    // all ⊃ active ⊃ nodust (nodust already hides closed). Labels read as
    // escalating levels so the single-select radio makes sense.
    options: [
      { value: "all", label: "Show all" },
      { value: "active", label: "Active only" },
      { value: "nodust", label: "Active, no dust" },
    ],
    get: (f) => [effectiveAaveV4Show(f)],
    set: (f, values) => ({ ...f, show: (values[0] as AaveV4Show) ?? undefined }),
    defaultValues: (f) => [aaveV4ShowDefault(f)],
    chipLabel: bareLabel,
  };

  // Within Status, Health (Underwater) sits last — Debt and Liquidations first.
  return [debt, liquidations, health, hubs, spokes, supplying, borrowing, visibility];
}
