"use client";

// LlamaLend dual-tower economics chart.
//
// Mirrors the AaveV4 tower's structure (collateral tower on the left, debt
// tower on the right, optional outflow breakdown rows below each) but values
// the towers in token units rather than USD — LlamaLend positions are
// typically single-collateral / single-debt, so per-asset USD normalisation
// would just be price × bar with no informational gain.
//
// Buckets (from `lib/llamalend/economics.ts`):
//   collateral: Deposited (lifetime inflow) − Withdrawn − Hard-Liq Seized
//               − Soft-Liq'd (reserved, gated on B2) = Current
//   debt:       Borrowed − Repaid − Debt Cleared (liq) = Outstanding
//
// The soft-liq bucket renders as a placeholder row in the breakdown table
// when the position has been through soft-liquidation events but B2 hasn't
// landed yet — once B2 synthesizes soft_liquidated events with amounts,
// economics.ts will fill softLiqOutflow and this placeholder is silently
// replaced with the real number.

import { useState } from "react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import {
  type TowerSegment,
  type BreakdownRow,
  DualTowerChart,
  fmt,
  REPAID_PATTERN,
  WITHDRAWN_PATTERN,
  LIQUIDATION_PATTERN,
} from "@/components/shared/economics-chart-primitives";
import {
  FilterDropdown,
  DisplaySettingsIcon,
  type FilterOption,
} from "@/components/shared/filter-dropdown";
import type { LlamalendEconomics, AssetBucket } from "@/lib/llamalend/economics";

const CHART_HEIGHT = 180;

const COLLATERAL_FADED = "rgba(59,130,246,0.2)";
const DEBT_GREEN_FADED = "rgba(52,211,153,0.2)";

function netCurrent(b: AssetBucket): number {
  return Math.max(0, b.current);
}

function ChartDisplayMenu({
  hideHistorical,
  onToggleHistorical,
  hasHistory,
}: {
  hideHistorical: boolean;
  onToggleHistorical: () => void;
  hasHistory: boolean;
}) {
  const options: FilterOption[] = [
    ...(hasHistory ? [{ key: "hide-historical", label: "Hide inactive / repaid" }] : []),
  ];
  const visible = new Set<string>();
  if (hideHistorical) visible.add("hide-historical");
  if (options.length === 0) return null;
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
        if (key === "hide-historical") onToggleHistorical();
      }}
    />
  );
}

export interface LlamalendTowerChartProps {
  economics: LlamalendEconomics;
}

export function LlamalendTowerChart({ economics }: LlamalendTowerChartProps) {
  const [hideHistorical, setHideHistorical] = useState(false);

  const collRows = economics.collateral.filter(
    (r) => r.inflow > 0 || r.current > 0 || r.outflow > 0 || r.liqOutflow > 0,
  );
  const debtRows = economics.debt.filter(
    (r) => r.inflow > 0 || r.current > 0 || r.outflow > 0 || r.liqOutflow > 0,
  );
  if (collRows.length === 0 && debtRows.length === 0) return null;

  const totalCollDeposited = collRows.reduce((s, r) => s + r.inflow, 0);
  const totalCollWithdrawn = collRows.reduce((s, r) => s + r.outflow, 0);
  const totalCollSeized = collRows.reduce((s, r) => s + r.liqOutflow, 0);
  const totalCollSoftLiq = collRows.reduce((s, r) => s + r.softLiqOutflow, 0);
  const totalCollCurrent = collRows.reduce((s, r) => s + netCurrent(r), 0);

  const totalDebtBorrowed = debtRows.reduce((s, r) => s + r.inflow, 0);
  const totalDebtRepaid = debtRows.reduce((s, r) => s + r.outflow, 0);
  const totalDebtCleared = debtRows.reduce((s, r) => s + r.liqOutflow, 0);
  const totalDebtCurrent = debtRows.reduce((s, r) => s + netCurrent(r), 0);

  const hasHistory =
    totalCollWithdrawn > 0 ||
    totalCollSeized > 0 ||
    totalDebtRepaid > 0 ||
    totalDebtCleared > 0 ||
    collRows.some((r) => r.current === 0 && r.inflow > 0) ||
    debtRows.some((r) => r.current === 0 && r.inflow > 0);
  const hasLive = totalCollCurrent > 0 || totalDebtCurrent > 0;
  const isLiveView = hideHistorical && (hasLive || !hasHistory);

  // Order rule: per-asset current segments at the bottom (so the active
  // position is the dominant block), then withdrawn / repaid / seized
  // patterns stack above when historical view is active.
  const collSegments: TowerSegment[] = [
    ...[...collRows]
      .filter((r) => netCurrent(r) > 0)
      .sort((a, b) => netCurrent(b) - netCurrent(a))
      .map((r) => ({
        key: `coll-${r.symbol}`,
        label: r.symbol,
        value: netCurrent(r),
        colorClass: "bg-blue-500",
      })),
    ...(!isLiveView
      ? [...collRows]
          .filter((r) => r.outflow > 0)
          .map((r) => ({
            key: `coll-with-${r.symbol}`,
            label: `${r.symbol} withdrawn`,
            value: r.outflow,
            colorClass: "",
            patternStyle: WITHDRAWN_PATTERN,
          }))
      : []),
    ...(!isLiveView
      ? [...collRows]
          .filter((r) => r.liqOutflow > 0)
          .map((r) => ({
            key: `coll-seized-${r.symbol}`,
            label: `${r.symbol} seized`,
            value: r.liqOutflow,
            colorClass: "",
            patternStyle: LIQUIDATION_PATTERN,
          }))
      : []),
  ];

  const debtSegments: TowerSegment[] = [
    ...[...debtRows]
      .filter((r) => netCurrent(r) > 0)
      .sort((a, b) => netCurrent(b) - netCurrent(a))
      .map((r) => ({
        key: `debt-${r.symbol}`,
        label: r.symbol,
        value: netCurrent(r),
        colorClass: "bg-emerald-400",
      })),
    ...(!isLiveView
      ? [...debtRows]
          .filter((r) => r.outflow > 0)
          .map((r) => ({
            key: `debt-rep-${r.symbol}`,
            label: `${r.symbol} repaid`,
            value: r.outflow,
            colorClass: "",
            patternStyle: REPAID_PATTERN,
          }))
      : []),
    ...(!isLiveView
      ? [...debtRows]
          .filter((r) => r.liqOutflow > 0)
          .map((r) => ({
            key: `debt-cleared-${r.symbol}`,
            label: `${r.symbol} cleared (liq)`,
            value: r.liqOutflow,
            colorClass: "",
            patternStyle: LIQUIDATION_PATTERN,
          }))
      : []),
  ];

  const collPeak = collSegments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const debtPeak = debtSegments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const towerMax = Math.max(collPeak, debtPeak, 1) * 1.08;

  const collSideBar =
    !isLiveView && totalCollDeposited > 0
      ? { heightPct: (totalCollDeposited / towerMax) * CHART_HEIGHT, color: COLLATERAL_FADED }
      : undefined;
  const debtSideBar =
    !isLiveView && totalDebtBorrowed > 0
      ? { heightPct: (totalDebtBorrowed / towerMax) * CHART_HEIGHT, color: DEBT_GREEN_FADED }
      : undefined;

  const collBreakdown: BreakdownRow[] = [
    ...(!isLiveView && totalCollDeposited > 0
      ? [
          {
            sign: "",
            label: "Deposited",
            amount: fmt(totalCollDeposited),
            swatchStyle: { backgroundColor: COLLATERAL_FADED },
          } as BreakdownRow,
        ]
      : []),
    ...(!isLiveView
      ? collRows
          .filter((r) => r.outflow > 0)
          .map(
            (r) =>
              ({
                sign: "−",
                label: r.symbol,
                amount: fmt(r.outflow),
                swatchStyle: WITHDRAWN_PATTERN,
                icon: <TokenChipIcon symbol={r.symbol} size={14} filterable={false} />,
                indent: true,
              }) as BreakdownRow,
          )
      : []),
    ...(!isLiveView
      ? collRows
          .filter((r) => r.liqOutflow > 0)
          .map(
            (r) =>
              ({
                sign: "−",
                label: `${r.symbol} seized (liq)`,
                amount: fmt(r.liqOutflow),
                swatchStyle: LIQUIDATION_PATTERN,
                icon: <TokenChipIcon symbol={r.symbol} size={14} filterable={false} />,
                indent: true,
              }) as BreakdownRow,
          )
      : []),
    ...(!isLiveView && totalCollSoftLiq > 0
      ? [
          {
            sign: "−",
            label: "Soft-liquidated",
            amount: fmt(totalCollSoftLiq),
            swatchStyle: LIQUIDATION_PATTERN,
            indent: true,
          } as BreakdownRow,
        ]
      : []),
    ...[...collRows]
      .filter((r) => netCurrent(r) > 0)
      .map(
        (r) =>
          ({
            sign: "",
            label: r.symbol,
            amount: fmt(netCurrent(r)),
            swatchClass: "bg-blue-500",
            icon: <TokenChipIcon symbol={r.symbol} size={14} filterable={false} />,
          }) as BreakdownRow,
      ),
    {
      sign: "",
      label: isLiveView ? "Total" : "Current",
      amount: fmt(totalCollCurrent),
      isResult: true,
    },
  ];

  const debtBreakdown: BreakdownRow[] = [
    ...(!isLiveView && totalDebtBorrowed > 0
      ? [
          {
            sign: "",
            label: "Borrowed",
            amount: fmt(totalDebtBorrowed),
            swatchStyle: { backgroundColor: DEBT_GREEN_FADED },
          } as BreakdownRow,
        ]
      : []),
    ...(!isLiveView
      ? debtRows
          .filter((r) => r.outflow > 0)
          .map(
            (r) =>
              ({
                sign: "−",
                label: `${r.symbol} repaid`,
                amount: fmt(r.outflow),
                swatchStyle: REPAID_PATTERN,
                icon: <TokenChipIcon symbol={r.symbol} size={14} filterable={false} />,
                indent: true,
              }) as BreakdownRow,
          )
      : []),
    ...(!isLiveView
      ? debtRows
          .filter((r) => r.liqOutflow > 0)
          .map(
            (r) =>
              ({
                sign: "−",
                label: `${r.symbol} cleared (liq)`,
                amount: fmt(r.liqOutflow),
                swatchStyle: LIQUIDATION_PATTERN,
                icon: <TokenChipIcon symbol={r.symbol} size={14} filterable={false} />,
                indent: true,
              }) as BreakdownRow,
          )
      : []),
    ...[...debtRows]
      .filter((r) => netCurrent(r) > 0)
      .map(
        (r) =>
          ({
            sign: "",
            label: r.symbol,
            amount: fmt(netCurrent(r)),
            swatchClass: "bg-emerald-400",
            icon: <TokenChipIcon symbol={r.symbol} size={14} filterable={false} />,
          }) as BreakdownRow,
      ),
    {
      sign: "",
      label: "Outstanding",
      amount: fmt(totalDebtCurrent),
      isResult: true,
    },
  ];

  const placeholderClass =
    "w-16 sm:w-20 rounded-sm border border-dashed border-rb-400 dark:border-rb-500/60 bg-rb-100/40 dark:bg-rb-800/40";
  const collPlaceholder =
    collSegments.length === 0 ? <div className={placeholderClass} style={{ height: CHART_HEIGHT }} /> : undefined;
  const debtPlaceholder =
    debtSegments.length === 0 ? <div className={placeholderClass} style={{ height: CHART_HEIGHT }} /> : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-rb-500">Economics</h3>
        {(hasLive || hasHistory) && (
          <ChartDisplayMenu
            hideHistorical={hideHistorical}
            onToggleHistorical={() => setHideHistorical((v) => !v)}
            hasHistory={hasHistory}
          />
        )}
      </div>
      <DualTowerChart
        left={{
          segments: collSegments,
          breakdownRows: collBreakdown,
          sideBar: collSideBar,
          placeholder: collPlaceholder,
        }}
        right={{
          segments: debtSegments,
          breakdownRows: debtBreakdown,
          sideBar: debtSideBar,
          placeholder: debtPlaceholder,
        }}
        height={CHART_HEIGHT}
        maxValue={towerMax}
        className="mb-2"
      />
      {totalCollSoftLiq === 0 && hasHistory && (
        // Reserved-but-empty notice when the chart has any history; the
        // soft-liq bucket is meaningful for LlamaLend but the wire shape
        // doesn't surface amounts until B2 lands. Quiet line so users see
        // the bucket exists without it cluttering the chart visuals.
        <p className="text-[10px] uppercase tracking-wider text-rb-500/70 mt-1">
          Soft-liquidated bucket: empty pending soft-liq event synthesis (B2).
        </p>
      )}
    </div>
  );
}
