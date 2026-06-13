// Pure transform: raw cross-hub credit lines (+ a price map) → a per-hub view
// model for the /aave-v4/hubs comparison surface. Kept side-effect-free and out
// of the component so the aggregation logic is one readable place.
//
// Framing: present, don't rank (see migration/aave-v4-hub-comparison.md). This
// module computes only descriptive aggregates — sizes, composition, utilisation,
// LT ranges. No score, no ordering by a risk metric (hubs stay in canonical
// order). Utilisation is a ratio, rendered with a single neutral fill.
//
// Unit reconciliation (see fetch-aave-v4-hubs): caps are whole-token units;
// addedAssets / totalOwed are raw (full `decimals`). We divide the raw amounts
// by 10^decimals to get token units, then both sides share a unit for util and
// price for USD. Number() on the big raw strings loses only sub-display digits.

import type { AaveV4HubsResponse, HubCreditLine, HubTierKey } from "@/lib/api/fetch-aave-v4-hubs";
import { assetClass, ASSET_CLASS_LABEL, type AssetClass } from "@/lib/aave-v4/asset-class";

/** uint40 max — the protocol's "uncapped" sentinel (MAX_ALLOWED_SPOKE_CAP). */
const MAX_CAP = 1_099_511_627_775;

export interface HubAssetAgg {
  symbol: string;
  underlying: string;
  cls: AssetClass;
  classLabel: string;
  /** LT range across the spokes that list it; equal min/max when uniform. */
  ltMin: number | null;
  ltMax: number | null;
  /** Token amounts (supplied / borrowed), summed across spokes. */
  supplied: number;
  borrowed: number;
  suppliedUsd: number;
  borrowedUsd: number;
  price: number | null;
  /** Aggregate caps (whole tokens). null when every line is uncapped. */
  addCap: number | null;
  drawCap: number | null;
  /** Ratios in [0,∞); null when the corresponding cap is 0 or uncapped. */
  supplyUtil: number | null;
  drawUtil: number | null;
  spokeCount: number;
  anyHalted: boolean;
  /** bool_or of canBorrow across spokes; null when config not yet indexed. */
  canBorrow: boolean | null;
}

export interface HubView {
  hub: HubTierKey;
  label: string;
  purpose: string;
  positionCount: number;
  suppliedUsd: number;
  borrowedUsd: number;
  /** Collateral composition by asset class, descending, ≥1% only. */
  composition: { cls: AssetClass; label: string; pct: number }[];
  assets: HubAssetAgg[];
  spokeNames: string[];
  haltedSpokes: string[];
}

export const HUB_LABEL: Record<HubTierKey, string> = {
  core: "Core",
  plus: "Plus",
  prime: "Prime",
};

// Neutral, descriptive one-liners — what the hub is for, not how good it is.
export const HUB_PURPOSE: Record<HubTierKey, string> = {
  core: "The broadest market, and the shared liquidity backbone other spokes draw stablecoins from.",
  plus: "Stablecoin-strategy markets — Ethena dollars and correlated yield collateral.",
  prime: "A tightly-scoped market for bluechip collateral.",
};

function toTokens(raw: string, decimals: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return 0;
  return n / 10 ** decimals;
}

function capValue(whole: string): number | null {
  const n = Number(whole);
  if (!Number.isFinite(n)) return null;
  if (n >= MAX_CAP) return null; // uncapped sentinel
  return n;
}

/** Aggregate one hub's credit lines into per-asset rows + hub totals. */
function buildHubView(
  hub: HubTierKey,
  lines: HubCreditLine[],
  prices: Record<string, number>,
  positionCount: number,
): HubView {
  // Group lines by asset (symbol). A spoke can list the same asset under one
  // line per hub, so (symbol) is the right key within a single hub.
  const bySymbol = new Map<string, HubCreditLine[]>();
  for (const l of lines) {
    const arr = bySymbol.get(l.symbol);
    if (arr) arr.push(l);
    else bySymbol.set(l.symbol, [l]);
  }

  const assets: HubAssetAgg[] = [];
  for (const [symbol, group] of bySymbol) {
    const underlying = group[0].underlying;
    const decimals = group[0].decimals;
    const price = prices[underlying.toLowerCase()] ?? null;

    let supplied = 0;
    let borrowed = 0;
    let addCapSum = 0;
    let drawCapSum = 0;
    let anyAddCapped = false;
    let anyDrawCapped = false;
    let ltMin: number | null = null;
    let ltMax: number | null = null;
    let anyHalted = false;
    let canBorrow: boolean | null = null;
    const spokes = new Set<string>();

    for (const l of group) {
      spokes.add(l.spoke);
      supplied += toTokens(l.addedAssets, decimals);
      borrowed += toTokens(l.totalOwed, decimals);
      const ac = capValue(l.addCap);
      const dc = capValue(l.drawCap);
      if (ac != null) { addCapSum += ac; anyAddCapped = true; }
      if (dc != null) { drawCapSum += dc; anyDrawCapped = true; }
      if (l.lt != null) {
        ltMin = ltMin == null ? l.lt : Math.min(ltMin, l.lt);
        ltMax = ltMax == null ? l.lt : Math.max(ltMax, l.lt);
      }
      if (l.halted) anyHalted = true;
      if (l.canBorrow != null) canBorrow = (canBorrow ?? false) || l.canBorrow;
    }

    const addCap = anyAddCapped ? addCapSum : null;
    const drawCap = anyDrawCapped ? drawCapSum : null;
    assets.push({
      symbol,
      underlying,
      cls: assetClass(symbol),
      classLabel: ASSET_CLASS_LABEL[assetClass(symbol)],
      ltMin,
      ltMax,
      supplied,
      borrowed,
      suppliedUsd: price != null ? supplied * price : 0,
      borrowedUsd: price != null ? borrowed * price : 0,
      price,
      addCap,
      drawCap,
      supplyUtil: addCap && addCap > 0 ? supplied / addCap : null,
      drawUtil: drawCap && drawCap > 0 ? borrowed / drawCap : null,
      spokeCount: spokes.size,
      anyHalted,
      canBorrow,
    });
  }

  assets.sort((a, b) => b.suppliedUsd - a.suppliedUsd || b.supplied - a.supplied);

  const suppliedUsd = assets.reduce((s, a) => s + a.suppliedUsd, 0);
  const borrowedUsd = assets.reduce((s, a) => s + a.borrowedUsd, 0);

  // Composition by class, weighted by supplied USD.
  const byClass = new Map<AssetClass, number>();
  for (const a of assets) byClass.set(a.cls, (byClass.get(a.cls) ?? 0) + a.suppliedUsd);
  const composition =
    suppliedUsd > 0
      ? [...byClass.entries()]
          .map(([cls, usd]) => ({ cls, label: ASSET_CLASS_LABEL[cls], pct: Math.round((usd / suppliedUsd) * 100) }))
          .filter((c) => c.pct >= 1)
          .sort((a, b) => b.pct - a.pct)
      : [];

  const spokeNamesSet = new Map<string, string>();
  const haltedSet = new Map<string, string>();
  for (const l of lines) {
    spokeNamesSet.set(l.spoke, l.spokeName);
    if (l.halted) haltedSet.set(l.spoke, l.spokeName);
  }

  return {
    hub,
    label: HUB_LABEL[hub],
    purpose: HUB_PURPOSE[hub],
    positionCount,
    suppliedUsd,
    borrowedUsd,
    composition,
    assets,
    spokeNames: [...spokeNamesSet.values()].sort(),
    haltedSpokes: [...haltedSet.values()].sort(),
  };
}

/** Build all hub views in canonical order from the API payload + a price map
 *  (keyed by lowercase token address — i.e. the prices-context PriceMap). */
export function buildHubViews(
  data: AaveV4HubsResponse,
  prices: Record<string, number>,
): HubView[] {
  const byHub = new Map<HubTierKey, HubCreditLine[]>();
  for (const l of data.lines) {
    const arr = byHub.get(l.hub);
    if (arr) arr.push(l);
    else byHub.set(l.hub, [l]);
  }
  return data.hubs.map((hub) =>
    buildHubView(hub, byHub.get(hub) ?? [], prices, data.positionCounts?.[hub] ?? 0),
  );
}

/** All distinct underlying addresses in the payload — for useRequestPrices. */
export function hubUnderlyings(data: AaveV4HubsResponse): string[] {
  return [...new Set(data.lines.map((l) => l.underlying.toLowerCase()))];
}
