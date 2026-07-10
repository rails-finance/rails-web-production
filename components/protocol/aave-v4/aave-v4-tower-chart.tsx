"use client";

// Multi-asset Aave V4 dual-tower chart. Trimmed to V4 (no V3 livePositions
// branch, no protocolLabel switch).
//
// Renders one collateral tower (blue) + one debt tower (green) per spoke.
// Withdrawn / repaid amounts render as hatched segments on top of the active
// segments so the chart tells the lifetime story; the Display dropdown collapses
// back to current-state-only.

import { useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import {
  type TowerSegment,
  type BreakdownRow,
  DualTowerChart,
  fmt,
  LIQUIDATION_PATTERN,
  REPAID_PATTERN,
  WITHDRAWN_PATTERN,
} from "@/components/shared/economics-chart-primitives";
import { FilterDropdown, DisplaySettingsIcon, type FilterOption } from "@/components/shared/filter-dropdown";
import { resolvePrice, type PriceEntry } from "@/lib/aave/prices";
import type { ReserveStats } from "@/lib/aave-v4/spoke-cards";
import { aaveV4DisplaySymbol } from "@/lib/aave-v4/pt-tokens";
import { fmtUsd } from "@/lib/aave-v4/format";

const CHART_HEIGHT = 180;

/** Lifetime USD totals that mirror the chart's breakdown-legend rows
 *  (Deposited / Withdrawn / Liquidated / In Protocol; Borrowed / Repaid /
 *  Liquidated / Outstanding). Pulled out so the footnote narration can quote
 *  the exact figures the towers draw without re-deriving them — surplus-
 *  included always (a lifetime summary doesn't honour the chart's hide-surplus
 *  display toggle). Anchored to chain-truth net balances + flows, matching the
 *  reconciled side-bar math in the chart body. */
export interface AaveLifetimeTotals {
  depositedUsd: number;
  withdrawnUsd: number;
  liquidatedCollUsd: number;
  inProtocolUsd: number;
  borrowedUsd: number;
  repaidUsd: number;
  liquidatedDebtUsd: number;
  outstandingUsd: number;
  hasDebtHistory: boolean;
}

export function computeAaveLifetimeTotals(
  reserves: ReserveStats[],
  prices?: Record<string, PriceEntry | number>,
): AaveLifetimeTotals {
  const t: AaveLifetimeTotals = {
    depositedUsd: 0,
    withdrawnUsd: 0,
    liquidatedCollUsd: 0,
    inProtocolUsd: 0,
    borrowedUsd: 0,
    repaidUsd: 0,
    liquidatedDebtUsd: 0,
    outstandingUsd: 0,
    hasDebtHistory: false,
  };
  for (const r of reserves) {
    // Current holdings at live price; lifetime outflows at price-at-the-time
    // (accumulated per event upstream in calculateAaveEconomics). Deposited/
    // Borrowed derive from the two so "Deposited − Withdrawn = In Protocol" still
    // reconciles.
    const price = resolvePrice(r.symbol, prices) ?? 1;
    const netSupply = r.currentSupplied ?? Math.max(0, r.supplied - r.withdrawn - r.liquidatedCollateral);
    const netDebt = r.currentBorrowed ?? Math.max(0, r.borrowed - r.repaid - r.liquidatedDebt);
    const inProtocolUsd = netSupply * price;
    const outstandingUsd = netDebt * price;
    t.inProtocolUsd += inProtocolUsd;
    t.withdrawnUsd += r.withdrawnUsd;
    t.liquidatedCollUsd += r.liquidatedCollateralUsd;
    t.depositedUsd += inProtocolUsd + r.withdrawnUsd + r.liquidatedCollateralUsd;
    t.outstandingUsd += outstandingUsd;
    t.repaidUsd += r.repaidUsd;
    t.liquidatedDebtUsd += r.liquidatedDebtUsd;
    t.borrowedUsd += outstandingUsd + r.repaidUsd + r.liquidatedDebtUsd;
    if (r.borrowed > 0 || r.repaid > 0 || r.liquidatedDebt > 0) t.hasDebtHistory = true;
  }
  return t;
}

const COLLATERAL_FADED = "rgba(59,130,246,0.2)";
const DEBT_GREEN_FADED = "rgba(74, 222, 128,0.2)";

// Below this USD value, lifetime flows (withdrawn / repaid / liquidated) don't
// earn a breakdown row or a hatched segment. Kept low ($0.01) so test-sized
// positions where a few cents moved still tell the full story — anything
// truly zero is already filtered upstream.
const LIFETIME_DUST_USD = 0.01;

interface AssetRow {
  symbol: string;
  /** Hub (Core/Plus/Prime/Paxos). Same asset can appear under two hubs as two
   *  distinct reserves; carried so segments/legends key and label them apart. */
  hub?: "core" | "plus" | "prime" | "paxos";
  // Lifetime totals — drive the historical-view side bars and breakdown rows.
  supplied: number;
  withdrawn: number;
  borrowed: number;
  repaid: number;
  liquidatedDebt: number;
  liquidatedCollateral: number;
  // Lifetime OUTFLOW value in USD at price-at-the-time (each event valued at its
  // own block price). Drives every historical USD figure so a settled position's
  // flows stay fixed instead of drifting with today's market. Current holdings
  // (netSupplyUsd / netDebtUsd) stay on live prices — see below.
  withdrawnUsd: number;
  repaidUsd: number;
  liquidatedDebtUsd: number;
  liquidatedCollateralUsd: number;
  // Current state — drives the solid tower segments and the "In Protocol" /
  // "Current Debt" totals. Sourced from chain-truth when present, otherwise
  // derived from lifetime fields.
  netSupply: number;
  netDebt: number;
  price: number;
  netSupplyUsd: number;
  netDebtUsd: number;
  isClosed: boolean;
  hasHistoricActivity: boolean;
}

/** " · Core" etc. — appended to a reserve's label so two same-symbol reserves
 *  drawn from different hubs read as distinct rows. Empty when hub is unknown. */
function hubSuffix(hub?: "core" | "plus" | "prime" | "paxos" | null): string {
  return hub ? ` · ${hub.charAt(0).toUpperCase()}${hub.slice(1)}` : "";
}

function AaveChartDisplayMenu({
  hideHistorical,
  onToggleHistorical,
  hasHistory,
  hideUsd,
  onToggleHideUsd,
  hideSurplus,
  onToggleHideSurplus,
  hasSurplus,
  grouped,
  onToggleGroup,
  canGroup,
}: {
  hideHistorical: boolean;
  onToggleHistorical: () => void;
  hasHistory: boolean;
  hideUsd: boolean;
  onToggleHideUsd: () => void;
  hideSurplus?: boolean;
  onToggleHideSurplus?: () => void;
  hasSurplus?: boolean;
  grouped?: boolean;
  onToggleGroup?: () => void;
  canGroup?: boolean;
}) {
  const options: FilterOption[] = [
    ...(canGroup ? [{ key: "group-assets", label: "Group assets" }] : []),
    { key: "hide-usd-values", label: "Hide USD values" },
    ...(hasHistory ? [{ key: "hide-historical", label: "Hide inactive / repaid" }] : []),
    ...(hasSurplus ? [{ key: "hide-surplus", label: "Hide surplus collateral" }] : []),
  ];
  const visible = new Set<string>();
  if (grouped) visible.add("group-assets");
  if (hideUsd) visible.add("hide-usd-values");
  if (hideHistorical) visible.add("hide-historical");
  if (hideSurplus) visible.add("hide-surplus");
  return (
    <FilterDropdown
      label="Display"
      options={options}
      selected={visible}
      onSelect={() => {}}
      multi
      minimal
      align="right"
      variant="ghost"
      triggerIcon={<DisplaySettingsIcon size={14} />}
      onToggle={(key) => {
        if (key === "group-assets") onToggleGroup?.();
        if (key === "hide-historical") onToggleHistorical();
        if (key === "hide-usd-values") onToggleHideUsd();
        if (key === "hide-surplus") onToggleHideSurplus?.();
      }}
    />
  );
}

export interface AaveV4TowerChartProps {
  reserves: ReserveStats[];
  prices?: Record<string, PriceEntry | number>;
  /** Symbols whose individual liquidation can't trigger a basket liq at base
   *  state — rendered with a softer blue so the prominent blue answers
   *  "what's bearing the risk?". */
  surplusSymbols?: Set<string>;
  hideSurplus?: boolean;
  onToggleHideSurplus?: () => void;
}

export function AaveV4TowerChart({
  reserves,
  prices,
  surplusSymbols,
  hideSurplus,
  onToggleHideSurplus,
}: AaveV4TowerChartProps) {
  const [hideHistorical, setHideHistorical] = useState(false);
  const [hideUsd, setHideUsd] = useState(true);
  // null = follow the auto-default (group when there's anything to merge); once
  // the reader toggles "Group assets" this pins their choice.
  const [groupOverride, setGroupOverride] = useState<boolean | null>(null);

  const allRows: AssetRow[] = reserves
    .filter(
      (r) =>
        r.supplied > 0 ||
        r.borrowed > 0 ||
        r.liquidatedDebt > 0 ||
        r.liquidatedCollateral > 0 ||
        (r.currentSupplied ?? 0) > 0 ||
        (r.currentBorrowed ?? 0) > 0,
    )
    .map((r) => {
      // Current state from chain truth when available; otherwise reconcile
      // lifetime flows including liquidation seizures / debt clears.
      const netSupply = r.currentSupplied ?? Math.max(0, r.supplied - r.withdrawn - r.liquidatedCollateral);
      const netDebt = r.currentBorrowed ?? Math.max(0, r.borrowed - r.repaid - r.liquidatedDebt);
      const price = resolvePrice(r.symbol, prices) ?? 1;
      const hasHistoricActivity =
        r.supplied > 0 ||
        r.borrowed > 0 ||
        r.withdrawn > 0 ||
        r.repaid > 0 ||
        r.liquidatedDebt > 0 ||
        r.liquidatedCollateral > 0;
      return {
        symbol: r.symbol,
        hub: r.hub,
        supplied: r.supplied,
        withdrawn: r.withdrawn,
        borrowed: r.borrowed,
        repaid: r.repaid,
        liquidatedDebt: r.liquidatedDebt,
        liquidatedCollateral: r.liquidatedCollateral,
        withdrawnUsd: r.withdrawnUsd,
        repaidUsd: r.repaidUsd,
        liquidatedDebtUsd: r.liquidatedDebtUsd,
        liquidatedCollateralUsd: r.liquidatedCollateralUsd,
        netSupply,
        netDebt,
        price,
        netSupplyUsd: netSupply * price,
        netDebtUsd: netDebt * price,
        isClosed: netSupply * price < LIFETIME_DUST_USD && netDebt * price < LIFETIME_DUST_USD,
        hasHistoricActivity,
      };
    });

  if (allRows.length === 0) return null;

  const activeRows = allRows.filter((r) => !r.isClosed);

  const supplyAssetsAll = activeRows
    .filter((r) => r.netSupplyUsd > 0.01)
    .sort((a, b) => b.netSupplyUsd - a.netSupplyUsd);
  const debtAssets = activeRows.filter((r) => r.netDebtUsd > 0.01).sort((a, b) => b.netDebtUsd - a.netDebtUsd);

  const isSurplus = (sym: string) => surplusSymbols?.has(sym) ?? false;
  const supplyAssets = hideSurplus ? supplyAssetsAll.filter((r) => !isSurplus(r.symbol)) : supplyAssetsAll;

  const totalSupplyUsd = supplyAssets.reduce((s, r) => s + r.netSupplyUsd, 0);
  const totalDebtUsd = debtAssets.reduce((s, r) => s + r.netDebtUsd, 0);
  // Outflows are valued at price-at-the-time (accumulated per event upstream in
  // calculateAaveEconomics), not the current price — so a closed position's flow
  // history stays fixed. Current holdings (netSupplyUsd / netDebtUsd) keep live
  // prices, since "what's it worth now" is a current-price question.
  const totalWithdrawnUsd = allRows.reduce((s, r) => s + r.withdrawnUsd, 0);
  const totalRepaidUsd = allRows.reduce((s, r) => s + r.repaidUsd, 0);
  const totalLiquidatedCollUsd = allRows.reduce((s, r) => s + r.liquidatedCollateralUsd, 0);
  const totalLiquidatedDebtUsd = allRows.reduce((s, r) => s + r.liquidatedDebtUsd, 0);
  // Lifetime side-bar totals = current balance + everything that has left the
  // position (withdrawn / repaid / liquidated). Anchor to the chain-truth
  // `netSupply` / `netDebt` rather than the event-derived gross `r.supplied` /
  // `r.borrowed`: gross cumulative double-counts capital re-deposited after a
  // loop, and counts capital that left through an un-indexed aggregator-wrapper
  // withdrawal (the same drift the chain-truth path exists to correct). That
  // inflation made the side bar shoot far above the tower and broke the
  // breakdown math. Reconstructing from net + flows keeps the bar honest, so
  // "Deposited − Withdrawn = In Protocol" reconciles and the bar can't exceed
  // the tower's own segment sum.
  // Deposited/Borrowed = current holding (live price) + outflows (price-at-the-
  // time). Deriving it this way keeps the reconciliation invariant intact
  // (Deposited − Withdrawn − Liquidated = In Protocol) while the departed capital
  // is valued at what it was worth when it left, not today.
  const totalDepositedUsd = allRows.reduce(
    (s, r) => s + r.netSupplyUsd + r.withdrawnUsd + r.liquidatedCollateralUsd,
    0,
  );
  const totalBorrowedUsd = allRows.reduce((s, r) => s + r.netDebtUsd + r.repaidUsd + r.liquidatedDebtUsd, 0);

  // Per-asset flow arrays feed the hatched segments, the breakdown rows, and the
  // side-bar totals from a single `usd` — valued at price-at-the-time.
  const withdrawnAssets = allRows
    .map((r) => ({ symbol: r.symbol, hub: r.hub, amount: r.withdrawn, usd: r.withdrawnUsd }))
    .filter((r) => r.usd > LIFETIME_DUST_USD)
    .sort((a, b) => b.usd - a.usd);
  const repaidAssets = allRows
    .map((r) => ({ symbol: r.symbol, hub: r.hub, amount: r.repaid, usd: r.repaidUsd }))
    .filter((r) => r.usd > LIFETIME_DUST_USD)
    .sort((a, b) => b.usd - a.usd);
  const liquidatedCollAssets = allRows
    .map((r) => ({
      symbol: r.symbol,
      hub: r.hub,
      amount: r.liquidatedCollateral,
      usd: r.liquidatedCollateralUsd,
    }))
    .filter((r) => r.usd > LIFETIME_DUST_USD)
    .sort((a, b) => b.usd - a.usd);
  const liquidatedDebtAssets = allRows
    .map((r) => ({ symbol: r.symbol, hub: r.hub, amount: r.liquidatedDebt, usd: r.liquidatedDebtUsd }))
    .filter((r) => r.usd > LIFETIME_DUST_USD)
    .sort((a, b) => b.usd - a.usd);

  const hasLive = supplyAssets.length > 0 || debtAssets.length > 0;
  const hasHistory =
    totalWithdrawnUsd > LIFETIME_DUST_USD ||
    totalRepaidUsd > LIFETIME_DUST_USD ||
    totalLiquidatedCollUsd > LIFETIME_DUST_USD ||
    totalLiquidatedDebtUsd > LIFETIME_DUST_USD;
  const isLiveView = hideHistorical && (hasLive || !hasHistory);

  // Suppress the debt tower for pure supply-side wallets. In live view that
  // means no current debt; in historical view it means no debt-side activity
  // ever (raw token amounts, so an unresolved price for the borrow asset
  // doesn't collapse a liquidated position back to a "supply only" chart).
  const hasHistoricDebt = allRows.some((r) => r.borrowed > 0 || r.repaid > 0 || r.liquidatedDebt > 0);
  // Frozen to the historical shape regardless of the toggle: a wallet that ever
  // held debt keeps its debt tower (now muted) in live view rather than
  // collapsing to a single-tower layout.
  const supplyOnly = !hasHistoricDebt && debtAssets.length === 0;

  // Asset grouping: collapse any single category (active collateral, active
  // debt, withdrawn, repaid, liquidated) that holds ≥2 assets into one block,
  // so multi-asset spokes stop fragmenting into a noisy stack. The merge is
  // per-category — a category with one asset still renders per-asset (keeping
  // its icon + native amount), so single-asset positions and the "one repaid +
  // one still-collateral" shape look identical whether grouped or not. Active
  // collateral keeps its surplus / risk-bearing split (≤2 blocks) since that's
  // the one risk-relevant distinction. Auto-on whenever anything is mergeable;
  // the Display menu's "Group assets" flips back to the full per-asset view.
  const nonSurplusSupply = supplyAssets.filter((r) => !isSurplus(r.symbol));
  const surplusSupply = supplyAssets.filter((r) => isSurplus(r.symbol));
  // Frozen to the full category set so grouping (and therefore the active
  // segments' positions) is identical whether or not flows are muted.
  const categoryCounts = [
    nonSurplusSupply.length,
    surplusSupply.length,
    debtAssets.length,
    withdrawnAssets.length,
    liquidatedCollAssets.length,
    repaidAssets.length,
    liquidatedDebtAssets.length,
  ];
  const canGroup = categoryCounts.some((c) => c >= 2);
  const grouped = canGroup && (groupOverride ?? true);

  // Direction arrow: → for assets moving into the protocol (supply, repay,
  // debt-cleared); ← for assets moving out (withdraw, borrow, coll-liquidated).
  // Replaces explicit "supplied/withdrawn/borrowed/repaid" wording.
  const dirArrow = (dir: "in" | "out") =>
    dir === "in" ? (
      <ArrowRight className="w-3 h-3 text-rb-500 shrink-0" />
    ) : (
      <ArrowLeft className="w-3 h-3 text-rb-500 shrink-0" />
    );

  const tipBody = (symbol: string | undefined, usd: number, dir: "in" | "out") => (
    <div className="flex items-center gap-1.5">
      {symbol && <TokenChipIcon symbol={symbol} size={14} filterable={false} />}
      {symbol && <span>{aaveV4DisplaySymbol(symbol)}</span>}
      {dirArrow(dir)}
      <span className="ml-auto tabular-nums">{fmtUsd(usd).title}</span>
    </div>
  );

  // Tooltip for a merged block: the category total, then the per-asset
  // constituents that were folded in (capped, with an "+N more" overflow).
  const mergedTip = (
    items: { symbol: string; hub?: "core" | "plus" | "prime" | "paxos"; usd: number }[],
    total: number,
    dir: "in" | "out",
  ) => (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 font-medium">
        {dirArrow(dir)}
        <span className="ml-auto tabular-nums">{fmtUsd(total).title}</span>
      </div>
      {items.slice(0, 6).map((i) => (
        <div key={`${i.symbol}-${i.hub ?? ""}`} className="flex items-center gap-1.5 text-rb-500">
          <TokenChipIcon symbol={i.symbol} size={12} filterable={false} />
          <span>
            {aaveV4DisplaySymbol(i.symbol)}
            {hubSuffix(i.hub)}
          </span>
          <span className="ml-auto tabular-nums">{fmtUsd(i.usd).title}</span>
        </div>
      ))}
      {items.length > 6 && <div className="text-rb-500">+{items.length - 6} more</div>}
    </div>
  );

  // Active collateral / debt: one merged block when grouped & ≥2, else per-asset.
  const activeSegs = (
    assets: AssetRow[],
    usdOf: (r: AssetRow) => number,
    colorClass: string,
    keyPrefix: string,
    mergedLabel: string,
    dir: "in" | "out",
  ): TowerSegment[] => {
    if (grouped && assets.length >= 2) {
      const total = assets.reduce((s, r) => s + usdOf(r), 0);
      return [
        {
          key: `${keyPrefix}-grp`,
          label: mergedLabel,
          value: total,
          colorClass,
          tooltip: mergedTip(
            assets.map((r) => ({ symbol: r.symbol, hub: r.hub, usd: usdOf(r) })),
            total,
            dir,
          ),
        },
      ];
    }
    return assets.map((r) => ({
      key: `${keyPrefix}-${r.symbol}-${r.hub ?? ""}`,
      label: `${aaveV4DisplaySymbol(r.symbol)}${hubSuffix(r.hub)}`,
      value: usdOf(r),
      colorClass,
      tooltip: tipBody(r.symbol, usdOf(r), dir),
    }));
  };

  // Lifetime-flow (withdrawn / repaid / liquidated) hatched segments: one merged
  // block when grouped & ≥2, else one hatched segment per asset (reversed so the
  // largest sits nearest the active segments, as before).
  const flowSegs = (
    items: { symbol: string; hub?: "core" | "plus" | "prime" | "paxos"; amount: number; usd: number }[],
    pattern: CSSProperties,
    keyPrefix: string,
    mergedLabel: string,
    dir: "in" | "out",
  ): TowerSegment[] => {
    if (grouped && items.length >= 2) {
      const total = items.reduce((s, i) => s + i.usd, 0);
      return [
        {
          key: `${keyPrefix}-grp`,
          label: mergedLabel,
          value: total,
          colorClass: "",
          patternStyle: pattern,
          tooltip: mergedTip(items, total, dir),
        },
      ];
    }
    return [...items].reverse().map((i) => ({
      key: `${keyPrefix}-${i.symbol}-${i.hub ?? ""}`,
      label: `${aaveV4DisplaySymbol(i.symbol)}${hubSuffix(i.hub)} ${mergedLabel.toLowerCase()}`,
      value: i.usd,
      colorClass: "",
      patternStyle: pattern,
      tooltip: tipBody(i.symbol, i.usd, dir),
    }));
  };

  // Lifetime-flow segments are always built (so the tower's segment count,
  // gaps and scale never change between views) and tagged `hidden` in live
  // view — the primitive paints them `visibility: hidden` in place, so the
  // active segments stay pinned exactly where the historical view drew them
  // rather than rescaling to fill the freed height.
  const markHidden = (segs: TowerSegment[]): TowerSegment[] => segs.map((s) => ({ ...s, hidden: isLiveView }));

  const collSegments: TowerSegment[] = [
    ...activeSegs(nonSurplusSupply, (r) => r.netSupplyUsd, "bg-blue-500", "coll", "Collateral", "in"),
    ...activeSegs(surplusSupply, (r) => r.netSupplyUsd, "bg-blue-500/60", "coll-surplus", "Surplus collateral", "in"),
    ...markHidden(flowSegs(liquidatedCollAssets, LIQUIDATION_PATTERN, "coll-liquidated", "Liquidated", "out")),
    ...markHidden(flowSegs(withdrawnAssets, WITHDRAWN_PATTERN, "coll-withdrawn", "Withdrawn", "out")),
  ];

  const debtSegments: TowerSegment[] = [
    ...activeSegs(debtAssets, (r) => r.netDebtUsd, "bg-green-400", "debt", "Debt", "out"),
    ...markHidden(flowSegs(liquidatedDebtAssets, LIQUIDATION_PATTERN, "debt-liquidated", "Liquidated", "in")),
    ...markHidden(flowSegs(repaidAssets, REPAID_PATTERN, "debt-repaid", "Repaid", "in")),
  ];

  const collPeak = collSegments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const debtPeak = debtSegments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  // Fold the historic-view side-bar totals into the scale so a lifetime bar can
  // never paint above the chart. With the reconciled totals above this is ~a
  // no-op (bar ≈ tower), but it also covers the hide-surplus case (collPeak
  // drops below the still-full deposited total) and the brief pre-price-
  // hydration render where per-asset prices haven't streamed in yet.
  // Side-bar max is folded in regardless of view so the tower scale is frozen
  // across the toggle; the bars themselves render `hidden` in live view (column
  // width still reserved → no horizontal shift of the tower).
  const sideBarMax = Math.max(totalDepositedUsd, totalBorrowedUsd);
  const towerMax = Math.max(collPeak, debtPeak, sideBarMax) * 1.08;

  const collSideBar =
    totalDepositedUsd > 0
      ? { heightPct: (totalDepositedUsd / towerMax) * CHART_HEIGHT, color: COLLATERAL_FADED, hidden: isLiveView }
      : undefined;
  const debtSideBar =
    totalBorrowedUsd > 0
      ? { heightPct: (totalBorrowedUsd / towerMax) * CHART_HEIGHT, color: DEBT_GREEN_FADED, hidden: isLiveView }
      : undefined;

  // Breakdown-row counterparts to the segment builders: merge a category into a
  // single USD row when grouped & ≥2 (no icon — the row is a sum across assets),
  // else per-asset rows with the native amount + icon as before.
  const flowRows = (
    items: { symbol: string; hub?: "core" | "plus" | "prime" | "paxos"; amount: number; usd: number }[],
    pattern: CSSProperties,
    mergedLabel: string,
  ): BreakdownRow[] => {
    if (grouped && items.length >= 2) {
      const total = items.reduce((s, i) => s + i.usd, 0);
      return [{ sign: "−", label: mergedLabel, amount: fmtUsd(total).display, swatchStyle: pattern }];
    }
    return items.map((i) => ({
      sign: "−",
      label:
        mergedLabel === "Liquidated"
          ? `${aaveV4DisplaySymbol(i.symbol)}${hubSuffix(i.hub)} liquidated`
          : `${aaveV4DisplaySymbol(i.symbol)}${hubSuffix(i.hub)}`,
      amount: fmt(i.amount),
      usdHint: hideUsd ? undefined : fmtUsd(i.usd).display,
      swatchStyle: pattern,
      icon: <TokenChipIcon symbol={i.symbol} size={14} filterable={false} />,
    }));
  };

  const currentRows = (
    assets: AssetRow[],
    nativeOf: (r: AssetRow) => number,
    usdOf: (r: AssetRow) => number,
    swatchClass: string,
    mergedLabel: string,
  ): BreakdownRow[] => {
    if (grouped && assets.length >= 2) {
      const total = assets.reduce((s, r) => s + usdOf(r), 0);
      return [{ sign: "", label: mergedLabel, amount: fmtUsd(total).display, swatchClass }];
    }
    return [...assets].reverse().map((r) => ({
      sign: "",
      label: `${aaveV4DisplaySymbol(r.symbol)}${hubSuffix(r.hub)}`,
      amount: fmt(nativeOf(r)),
      usdHint: hideUsd ? undefined : fmtUsd(usdOf(r)).display,
      swatchClass,
      icon: <TokenChipIcon symbol={r.symbol} size={14} filterable={false} />,
    }));
  };

  const collRows: BreakdownRow[] = [
    ...(!isLiveView
      ? [
          {
            sign: "",
            label: "Deposited (all time)",
            amount: fmtUsd(totalDepositedUsd).display,
            swatchStyle: { backgroundColor: COLLATERAL_FADED },
          } as BreakdownRow,
        ]
      : []),
    ...(!isLiveView ? flowRows(withdrawnAssets, WITHDRAWN_PATTERN, "Withdrawn") : []),
    ...(!isLiveView ? flowRows(liquidatedCollAssets, LIQUIDATION_PATTERN, "Liquidated") : []),
    ...currentRows(
      supplyAssets,
      (r) => r.netSupply,
      (r) => r.netSupplyUsd,
      "bg-blue-500",
      "Combined Collateral",
    ),
    {
      sign: "",
      // Parity with Liquity's "Current Collateral" total for borrow positions;
      // a never-borrowed wallet has nothing collateralised, so it reads as a
      // plain supply balance instead.
      label: supplyOnly ? "Currently Supplied" : "Current Collateral",
      amount: fmtUsd(totalSupplyUsd).display,
      isResult: true,
    },
  ];

  const debtRows: BreakdownRow[] = [
    ...(!isLiveView
      ? [
          {
            sign: "",
            label: "Borrowed (all time)",
            amount: fmtUsd(totalBorrowedUsd).display,
            swatchStyle: { backgroundColor: DEBT_GREEN_FADED },
          } as BreakdownRow,
        ]
      : []),
    ...(!isLiveView ? flowRows(repaidAssets, REPAID_PATTERN, "Repaid") : []),
    ...(!isLiveView ? flowRows(liquidatedDebtAssets, LIQUIDATION_PATTERN, "Liquidated") : []),
    ...currentRows(
      debtAssets,
      (r) => r.netDebt,
      (r) => r.netDebtUsd,
      "bg-green-400",
      "Debt",
    ),
    { sign: "", label: "Current Debt", amount: fmtUsd(totalDebtUsd).display, isResult: true },
  ];

  const placeholderClass =
    "w-16 sm:w-20 rounded-sm border border-dashed border-rb-400 dark:border-rb-500/60 bg-rb-100/40 dark:bg-rb-800/40";
  const ghostTower = <div className={placeholderClass} style={{ height: CHART_HEIGHT }} />;
  // Labelled ghost for the pure supply-side case — the dashed tower stands in
  // for the absent debt side, with a faded "No debt" so the emptiness reads as
  // intentional rather than a loading gap. Sized to match the collateral tower's
  // filled height (never taller): debt is always ≤ collateral, so a full-height
  // ghost beside a shorter supply tower read as illogically large. Clamped to a
  // floor so the "No debt" label stays legible when collateral is tiny. Both
  // towers are bottom-aligned, so the shorter ghost shares the baseline.
  const collTowerPx = towerMax > 0 ? Math.min(CHART_HEIGHT, (collPeak / towerMax) * CHART_HEIGHT) : CHART_HEIGHT;
  const ghostDebtHeight = Math.max(40, collTowerPx);
  const ghostDebtTower = (
    <div className={`${placeholderClass} flex items-center justify-center`} style={{ height: ghostDebtHeight }}>
      <span className="text-[11px] font-medium text-rb-500/60 select-none">No debt</span>
    </div>
  );
  const collPlaceholder = collSegments.length === 0 ? ghostTower : undefined;
  const debtPlaceholder = debtSegments.length === 0 ? ghostTower : undefined;

  return (
    <div className="space-y-2">
      {(hasLive || hasHistory) && (
        <div className="flex justify-end gap-1.5">
          <AaveChartDisplayMenu
            hideHistorical={hideHistorical}
            onToggleHistorical={() => setHideHistorical((v) => !v)}
            hasHistory={hasHistory}
            hideUsd={hideUsd}
            onToggleHideUsd={() => setHideUsd((v) => !v)}
            hideSurplus={hideSurplus}
            onToggleHideSurplus={onToggleHideSurplus}
            hasSurplus={(surplusSymbols?.size ?? 0) > 0}
            grouped={grouped}
            onToggleGroup={() => setGroupOverride(!grouped)}
            canGroup={canGroup}
          />
        </div>
      )}
      <DualTowerChart
        left={{
          segments: collSegments,
          breakdownRows: collRows,
          sideBar: collSideBar,
          placeholder: collPlaceholder,
          sideBarTooltip: collSideBar ? (
            <div className="flex items-center gap-1.5">
              <span>Deposited (all time)</span>
              {dirArrow("in")}
              <span className="ml-auto tabular-nums">{fmtUsd(totalDepositedUsd).title}</span>
            </div>
          ) : undefined,
        }}
        right={
          supplyOnly
            ? // Pure supply-side wallet: keep the dual-tower footprint with a
              // ghost debt tower (dashed outline) so the chart stays centered
              // instead of collapsing left. No breakdown rows on the debt side.
              {
                segments: [],
                breakdownRows: [],
                placeholder: ghostDebtTower,
              }
            : {
                segments: debtSegments,
                breakdownRows: debtRows,
                sideBar: debtSideBar,
                placeholder: debtPlaceholder,
                sideBarTooltip: debtSideBar ? (
                  <div className="flex items-center gap-1.5">
                    <span>Borrowed (all time)</span>
                    {dirArrow("out")}
                    <span className="ml-auto tabular-nums">{fmtUsd(totalBorrowedUsd).title}</span>
                  </div>
                ) : undefined,
              }
        }
        height={CHART_HEIGHT}
        maxValue={towerMax}
        className="mb-6"
      />
    </div>
  );
}
