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
 * borrow universe is fetched async) so this stays a pure builder. Order here is
 * the order of the + Filter menu; `group` inserts the section headers.
 */
export function aaveV4FilterDimensions({ assetOptions }: { assetOptions: FilterOptionDef[] }): Dim[] {
  const health: Dim = {
    id: "health",
    label: "Health",
    group: "Risk",
    cardinality: "single",
    options: [{ value: "underwater", label: "Underwater" }],
    get: (f) => (f.health === "underwater" ? ["underwater"] : []),
    set: (f, values) => ({ ...f, health: values[0] === "underwater" ? "underwater" : "all" }),
    chipLabel: bareLabel,
  };

  const debt = enumDim<AaveV4Debt>({
    id: "debt",
    label: "Debt",
    group: "Risk",
    field: "debt",
    options: [
      { value: "withDebt", label: "With debt" },
      { value: "noDebt", label: "Supply only" },
    ],
  });

  const liquidations = enumDim<AaveV4Liquidations>({
    id: "liquidations",
    label: "Liquidations",
    group: "Risk",
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
    set: (f, values) => ({ ...f, hubs: values }),
    chipLabel: (vals, opts) => `Hub: ${joinOptionLabels(vals, opts)}`,
  };

  const spokes: Dim = {
    id: "spokes",
    label: "Spoke",
    group: "Market",
    cardinality: "multi",
    options: SPOKE_OPTIONS,
    get: (f) => f.spokes,
    set: (f, values) => ({ ...f, spokes: values }),
    chipLabel: (vals, opts) => `Spoke: ${joinOptionLabels(vals, opts)}`,
  };

  const supplying: Dim = {
    id: "supplyAssets",
    label: "Supplying",
    group: "Assets",
    cardinality: "multi",
    options: assetOptions,
    get: (f) => f.supplyAssets,
    set: (f, values) => ({ ...f, supplyAssets: values }),
    chipLabel: (vals, opts) => `Supplying: ${joinOptionLabels(vals, opts)}`,
  };

  const borrowing: Dim = {
    id: "borrowAssets",
    label: "Borrowing",
    group: "Assets",
    cardinality: "multi",
    options: assetOptions,
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
    options: [
      { value: "all", label: "Include closed" },
      { value: "active", label: "Hide closed" },
      { value: "nodust", label: "Hide dust" },
    ],
    get: (f) => [effectiveAaveV4Show(f)],
    set: (f, values) => ({ ...f, show: (values[0] as AaveV4Show) ?? undefined }),
    defaultValues: (f) => [aaveV4ShowDefault(f)],
    chipLabel: bareLabel,
  };

  return [health, debt, liquidations, hubs, spokes, supplying, borrowing, visibility];
}
