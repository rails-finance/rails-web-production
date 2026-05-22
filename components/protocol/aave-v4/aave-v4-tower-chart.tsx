"use client";

// Multi-asset Aave V4 dual-tower chart. Ported from rails-explorer's
// `MultiAssetTowerChart` inside `components/protocol/aave/aave-economics.tsx`,
// trimmed to V4 (no V3 livePositions branch, no protocolLabel switch).
//
// Renders one collateral tower (blue) + one debt tower (emerald) per spoke.
// Withdrawn / repaid amounts render as hatched segments on top of the active
// segments so the chart tells the lifetime story; the Display dropdown collapses
// back to current-state-only.

import { useState } from "react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import {
  type TowerSegment,
  type BreakdownRow,
  DualTowerChart,
  fmt,
  REPAID_PATTERN,
  WITHDRAWN_PATTERN,
} from "@/components/shared/economics-chart-primitives";
import {
  FilterDropdown,
  DisplaySettingsIcon,
  type FilterOption,
} from "@/components/shared/filter-dropdown";
import { resolvePrice, type PriceEntry } from "@/lib/aave/prices";
import type { ReserveStats } from "@/lib/aave-v4/spoke-cards";
import { aaveV4DisplaySymbol } from "@/lib/aave-v4/pt-tokens";

const CHART_HEIGHT = 180;

const COLLATERAL_FADED = "rgba(59,130,246,0.2)";
const DEBT_GREEN_FADED = "rgba(52,211,153,0.2)";

function fmtUsdCompact(n: number): string {
  if (n >= 1_000_000) {
    const v = (n / 1_000_000).toFixed(1);
    return "$" + (v.endsWith(".0") ? v.slice(0, -2) : v) + "M";
  }
  if (n >= 1_000) {
    const v = (n / 1_000).toFixed(1);
    return "$" + (v.endsWith(".0") ? v.slice(0, -2) : v) + "K";
  }
  return "$" + n.toFixed(0);
}

interface AssetRow {
  symbol: string;
  supplied: number;
  withdrawn: number;
  netSupply: number;
  borrowed: number;
  repaid: number;
  netDebt: number;
  price: number;
  netSupplyUsd: number;
  netDebtUsd: number;
  isClosed: boolean;
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
}: {
  hideHistorical: boolean;
  onToggleHistorical: () => void;
  hasHistory: boolean;
  hideUsd: boolean;
  onToggleHideUsd: () => void;
  hideSurplus?: boolean;
  onToggleHideSurplus?: () => void;
  hasSurplus?: boolean;
}) {
  const options: FilterOption[] = [
    { key: "hide-usd-values", label: "Hide USD values" },
    ...(hasHistory ? [{ key: "hide-historical", label: "Hide inactive / repaid" }] : []),
    ...(hasSurplus ? [{ key: "hide-surplus", label: "Hide surplus collateral" }] : []),
  ];
  const visible = new Set<string>();
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

  const allRows: AssetRow[] = reserves
    .filter((r) => r.supplied > 0 || r.borrowed > 0)
    .map((r) => {
      const netSupply = Math.max(0, r.supplied - r.withdrawn);
      const netDebt = Math.max(0, r.borrowed - r.repaid);
      const price = resolvePrice(r.symbol, prices) ?? 1;
      return {
        symbol: r.symbol,
        supplied: r.supplied,
        withdrawn: r.withdrawn,
        netSupply,
        borrowed: r.borrowed,
        repaid: r.repaid,
        netDebt,
        price,
        netSupplyUsd: netSupply * price,
        netDebtUsd: netDebt * price,
        isClosed: netSupply * price < 1 && netDebt * price < 1,
      };
    });

  if (allRows.length === 0) return null;

  const activeRows = allRows.filter((r) => !r.isClosed);
  const closedRows = allRows.filter((r) => r.isClosed);

  const supplyAssetsAll = activeRows
    .filter((r) => r.netSupplyUsd > 0.01)
    .sort((a, b) => b.netSupplyUsd - a.netSupplyUsd);
  const debtAssets = activeRows
    .filter((r) => r.netDebtUsd > 0.01)
    .sort((a, b) => b.netDebtUsd - a.netDebtUsd);

  const isSurplus = (sym: string) => surplusSymbols?.has(sym) ?? false;
  const supplyAssets = hideSurplus
    ? supplyAssetsAll.filter((r) => !isSurplus(r.symbol))
    : supplyAssetsAll;

  const totalSupplyUsd = supplyAssets.reduce((s, r) => s + r.netSupplyUsd, 0);
  const totalDebtUsd = debtAssets.reduce((s, r) => s + r.netDebtUsd, 0);
  const totalWithdrawnUsd = allRows.reduce((s, r) => s + r.withdrawn * r.price, 0);
  const totalRepaidUsd = allRows.reduce((s, r) => s + r.repaid * r.price, 0);
  const totalDepositedUsd = allRows.reduce((s, r) => s + r.supplied * r.price, 0);
  const totalBorrowedUsd = allRows.reduce((s, r) => s + r.borrowed * r.price, 0);

  const withdrawnAssets = allRows
    .map((r) => ({ symbol: r.symbol, amount: r.withdrawn, usd: r.withdrawn * r.price }))
    .filter((r) => r.usd > 1)
    .sort((a, b) => b.usd - a.usd);
  const repaidAssets = allRows
    .map((r) => ({ symbol: r.symbol, amount: r.repaid, usd: r.repaid * r.price }))
    .filter((r) => r.usd > 1)
    .sort((a, b) => b.usd - a.usd);

  const supplyOnly = totalBorrowedUsd < 1 && totalRepaidUsd < 1 && totalDebtUsd < 1;

  const hasLive = supplyAssets.length > 0 || debtAssets.length > 0;
  const hasHistory = totalWithdrawnUsd > 1 || totalRepaidUsd > 1 || closedRows.length > 0;
  const isLiveView = hideHistorical && (hasLive || !hasHistory);

  const collSegments: TowerSegment[] = [
    ...supplyAssets.map((r) => ({
      key: `coll-${r.symbol}`,
      label: aaveV4DisplaySymbol(r.symbol),
      value: r.netSupplyUsd,
      colorClass: isSurplus(r.symbol) ? "bg-blue-500/60" : "bg-blue-500",
    })),
    ...(!isLiveView
      ? [...withdrawnAssets].reverse().map((w) => ({
          key: `coll-withdrawn-${w.symbol}`,
          label: `${aaveV4DisplaySymbol(w.symbol)} withdrawn`,
          value: w.usd,
          colorClass: "",
          patternStyle: WITHDRAWN_PATTERN,
        }))
      : []),
  ];

  const debtSegments: TowerSegment[] = [
    ...debtAssets.map((r) => ({
      key: `debt-${r.symbol}`,
      label: aaveV4DisplaySymbol(r.symbol),
      value: r.netDebtUsd,
      colorClass: "bg-emerald-400",
    })),
    ...(!isLiveView
      ? [...repaidAssets].reverse().map((rA) => ({
          key: `debt-repaid-${rA.symbol}`,
          label: `${aaveV4DisplaySymbol(rA.symbol)} repaid`,
          value: rA.usd,
          colorClass: "",
          patternStyle: REPAID_PATTERN,
        }))
      : []),
  ];

  const collPeak = collSegments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const debtPeak = debtSegments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const towerMax = Math.max(collPeak, debtPeak) * 1.08;

  const collSideBar =
    !isLiveView && totalDepositedUsd > 0
      ? { heightPct: (totalDepositedUsd / towerMax) * CHART_HEIGHT, color: COLLATERAL_FADED }
      : undefined;
  const debtSideBar =
    !isLiveView && totalBorrowedUsd > 0
      ? { heightPct: (totalBorrowedUsd / towerMax) * CHART_HEIGHT, color: DEBT_GREEN_FADED }
      : undefined;

  const collRows: BreakdownRow[] = [
    ...(!isLiveView
      ? [
          {
            sign: "",
            label: "Deposited",
            amount: fmtUsdCompact(totalDepositedUsd),
            swatchStyle: { backgroundColor: COLLATERAL_FADED },
          } as BreakdownRow,
        ]
      : []),
    ...(!isLiveView
      ? withdrawnAssets.map((w) => ({
          sign: "−",
          label: aaveV4DisplaySymbol(w.symbol),
          amount: fmt(w.amount),
          usdHint: hideUsd ? undefined : fmtUsdCompact(w.usd),
          swatchStyle: WITHDRAWN_PATTERN,
          icon: <TokenChipIcon symbol={w.symbol} size={14} filterable={false} />,
        })) as BreakdownRow[]
      : []),
    ...[...supplyAssets].reverse().map(
      (r) =>
        ({
          sign: "",
          label: aaveV4DisplaySymbol(r.symbol),
          amount: fmt(r.netSupply),
          usdHint: hideUsd ? undefined : fmtUsdCompact(r.netSupplyUsd),
          swatchClass: "bg-blue-500",
          icon: <TokenChipIcon symbol={r.symbol} size={14} filterable={false} />,
        }) as BreakdownRow,
    ),
    {
      sign: "",
      label: isLiveView ? "Total" : "In Protocol",
      amount: fmtUsdCompact(totalSupplyUsd),
      isResult: true,
    },
  ];

  const debtRows: BreakdownRow[] = [
    ...(!isLiveView
      ? [
          {
            sign: "",
            label: "Borrowed",
            amount: fmtUsdCompact(totalBorrowedUsd),
            swatchStyle: { backgroundColor: DEBT_GREEN_FADED },
          } as BreakdownRow,
        ]
      : []),
    ...(!isLiveView
      ? repaidAssets.map((rA) => ({
          sign: "−",
          label: aaveV4DisplaySymbol(rA.symbol),
          amount: fmt(rA.amount),
          usdHint: hideUsd ? undefined : fmtUsdCompact(rA.usd),
          swatchStyle: REPAID_PATTERN,
          icon: <TokenChipIcon symbol={rA.symbol} size={14} filterable={false} />,
        })) as BreakdownRow[]
      : []),
    ...[...debtAssets].reverse().map(
      (r) =>
        ({
          sign: "",
          label: aaveV4DisplaySymbol(r.symbol),
          amount: fmt(r.netDebt),
          usdHint: hideUsd ? undefined : fmtUsdCompact(r.netDebtUsd),
          swatchClass: "bg-emerald-400",
          icon: <TokenChipIcon symbol={r.symbol} size={14} filterable={false} />,
        }) as BreakdownRow,
    ),
    {
      sign: "",
      label: "Outstanding",
      amount: fmtUsdCompact(totalDebtUsd),
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
          />
        </div>
      )}
      <DualTowerChart
        left={{
          segments: collSegments,
          breakdownRows: collRows,
          sideBar: collSideBar,
          placeholder: collPlaceholder,
        }}
        right={
          supplyOnly
            ? undefined
            : {
                segments: debtSegments,
                breakdownRows: debtRows,
                sideBar: debtSideBar,
                placeholder: debtPlaceholder,
              }
        }
        height={CHART_HEIGHT}
        maxValue={towerMax}
        className="mb-6"
      />
    </div>
  );
}
