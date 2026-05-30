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
import {
  FilterDropdown,
  DisplaySettingsIcon,
  type FilterOption,
} from "@/components/shared/filter-dropdown";
import { resolvePrice, type PriceEntry } from "@/lib/aave/prices";
import type { ReserveStats } from "@/lib/aave-v4/spoke-cards";
import { aaveV4DisplaySymbol } from "@/lib/aave-v4/pt-tokens";
import { fmtUsd } from "@/lib/aave-v4/format";

const CHART_HEIGHT = 180;

const COLLATERAL_FADED = "rgba(59,130,246,0.2)";
const DEBT_GREEN_FADED = "rgba(52,211,153,0.2)";

// Below this USD value, lifetime flows (withdrawn / repaid / liquidated) don't
// earn a breakdown row or a hatched segment. Kept low ($0.01) so test-sized
// positions where a few cents moved still tell the full story — anything
// truly zero is already filtered upstream.
const LIFETIME_DUST_USD = 0.01;

interface AssetRow {
  symbol: string;
  // Lifetime totals — drive the historical-view side bars and breakdown rows.
  supplied: number;
  withdrawn: number;
  borrowed: number;
  repaid: number;
  liquidatedDebt: number;
  liquidatedCollateral: number;
  // Current state — drives the solid tower segments and the "In Protocol" /
  // "Outstanding" totals. Sourced from chain-truth when present, otherwise
  // derived from lifetime fields.
  netSupply: number;
  netDebt: number;
  price: number;
  netSupplyUsd: number;
  netDebtUsd: number;
  isClosed: boolean;
  hasHistoricActivity: boolean;
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
      const netSupply =
        r.currentSupplied ?? Math.max(0, r.supplied - r.withdrawn - r.liquidatedCollateral);
      const netDebt =
        r.currentBorrowed ?? Math.max(0, r.borrowed - r.repaid - r.liquidatedDebt);
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
        supplied: r.supplied,
        withdrawn: r.withdrawn,
        borrowed: r.borrowed,
        repaid: r.repaid,
        liquidatedDebt: r.liquidatedDebt,
        liquidatedCollateral: r.liquidatedCollateral,
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
  const totalLiquidatedCollUsd = allRows.reduce(
    (s, r) => s + r.liquidatedCollateral * r.price,
    0,
  );
  const totalLiquidatedDebtUsd = allRows.reduce(
    (s, r) => s + r.liquidatedDebt * r.price,
    0,
  );
  // Lifetime side-bar totals — the chain-truth path zeros out r.supplied /
  // r.borrowed for rows whose live balance is non-zero, so reconstruct the
  // lifetime peak from the available flows so the side bar is visible even
  // when chain truth replaced the event-derived totals.
  const totalDepositedUsd = allRows.reduce((s, r) => {
    const lifetime = Math.max(
      r.supplied,
      r.netSupply + r.withdrawn + r.liquidatedCollateral,
    );
    return s + lifetime * r.price;
  }, 0);
  const totalBorrowedUsd = allRows.reduce((s, r) => {
    const lifetime = Math.max(
      r.borrowed,
      r.netDebt + r.repaid + r.liquidatedDebt,
    );
    return s + lifetime * r.price;
  }, 0);

  const withdrawnAssets = allRows
    .map((r) => ({ symbol: r.symbol, amount: r.withdrawn, usd: r.withdrawn * r.price }))
    .filter((r) => r.usd > LIFETIME_DUST_USD)
    .sort((a, b) => b.usd - a.usd);
  const repaidAssets = allRows
    .map((r) => ({ symbol: r.symbol, amount: r.repaid, usd: r.repaid * r.price }))
    .filter((r) => r.usd > LIFETIME_DUST_USD)
    .sort((a, b) => b.usd - a.usd);
  const liquidatedCollAssets = allRows
    .map((r) => ({ symbol: r.symbol, amount: r.liquidatedCollateral, usd: r.liquidatedCollateral * r.price }))
    .filter((r) => r.usd > LIFETIME_DUST_USD)
    .sort((a, b) => b.usd - a.usd);
  const liquidatedDebtAssets = allRows
    .map((r) => ({ symbol: r.symbol, amount: r.liquidatedDebt, usd: r.liquidatedDebt * r.price }))
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
  const hasHistoricDebt = allRows.some(
    (r) => r.borrowed > 0 || r.repaid > 0 || r.liquidatedDebt > 0,
  );
  const supplyOnly = isLiveView
    ? debtAssets.length === 0
    : !hasHistoricDebt && debtAssets.length === 0;

  // Direction arrow: → for assets moving into the protocol (supply, repay,
  // debt-cleared); ← for assets moving out (withdraw, borrow, coll-liquidated).
  // Replaces explicit "supplied/withdrawn/borrowed/repaid" wording.
  const dirArrow = (dir: 'in' | 'out') =>
    dir === 'in'
      ? <ArrowRight className="w-3 h-3 text-rb-500 shrink-0" />
      : <ArrowLeft className="w-3 h-3 text-rb-500 shrink-0" />;

  const tipBody = (symbol: string | undefined, usd: number, dir: 'in' | 'out') => (
    <div className="flex items-center gap-1.5">
      {symbol && <TokenChipIcon symbol={symbol} size={14} filterable={false} />}
      {symbol && <span>{aaveV4DisplaySymbol(symbol)}</span>}
      {dirArrow(dir)}
      <span className="ml-auto tabular-nums">{fmtUsd(usd).title}</span>
    </div>
  );

  const collSegments: TowerSegment[] = [
    ...supplyAssets.map((r) => ({
      key: `coll-${r.symbol}`,
      label: aaveV4DisplaySymbol(r.symbol),
      value: r.netSupplyUsd,
      colorClass: isSurplus(r.symbol) ? "bg-blue-500/60" : "bg-blue-500",
      tooltip: tipBody(r.symbol, r.netSupplyUsd, 'in'),
    })),
    ...(!isLiveView
      ? [...liquidatedCollAssets].reverse().map((l) => ({
          key: `coll-liquidated-${l.symbol}`,
          label: `${aaveV4DisplaySymbol(l.symbol)} liquidated`,
          value: l.usd,
          colorClass: "",
          patternStyle: LIQUIDATION_PATTERN,
          tooltip: tipBody(l.symbol, l.usd, 'out'),
        }))
      : []),
    ...(!isLiveView
      ? [...withdrawnAssets].reverse().map((w) => ({
          key: `coll-withdrawn-${w.symbol}`,
          label: `${aaveV4DisplaySymbol(w.symbol)} withdrawn`,
          value: w.usd,
          colorClass: "",
          patternStyle: WITHDRAWN_PATTERN,
          tooltip: tipBody(w.symbol, w.usd, 'out'),
        }))
      : []),
  ];

  const debtSegments: TowerSegment[] = [
    ...debtAssets.map((r) => ({
      key: `debt-${r.symbol}`,
      label: aaveV4DisplaySymbol(r.symbol),
      value: r.netDebtUsd,
      colorClass: "bg-emerald-400",
      tooltip: tipBody(r.symbol, r.netDebtUsd, 'out'),
    })),
    ...(!isLiveView
      ? [...liquidatedDebtAssets].reverse().map((l) => ({
          key: `debt-liquidated-${l.symbol}`,
          label: `${aaveV4DisplaySymbol(l.symbol)} liquidated`,
          value: l.usd,
          colorClass: "",
          patternStyle: LIQUIDATION_PATTERN,
          tooltip: tipBody(l.symbol, l.usd, 'in'),
        }))
      : []),
    ...(!isLiveView
      ? [...repaidAssets].reverse().map((rA) => ({
          key: `debt-repaid-${rA.symbol}`,
          label: `${aaveV4DisplaySymbol(rA.symbol)} repaid`,
          value: rA.usd,
          colorClass: "",
          patternStyle: REPAID_PATTERN,
          tooltip: tipBody(rA.symbol, rA.usd, 'in'),
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
            amount: fmtUsd(totalDepositedUsd).display,
            swatchStyle: { backgroundColor: COLLATERAL_FADED },
          } as BreakdownRow,
        ]
      : []),
    ...(!isLiveView
      ? withdrawnAssets.map((w) => ({
          sign: "−",
          label: aaveV4DisplaySymbol(w.symbol),
          amount: fmt(w.amount),
          usdHint: hideUsd ? undefined : fmtUsd(w.usd).display,
          swatchStyle: WITHDRAWN_PATTERN,
          icon: <TokenChipIcon symbol={w.symbol} size={14} filterable={false} />,
        })) as BreakdownRow[]
      : []),
    ...(!isLiveView
      ? liquidatedCollAssets.map((l) => ({
          sign: "−",
          label: `${aaveV4DisplaySymbol(l.symbol)} liquidated`,
          amount: fmt(l.amount),
          usdHint: hideUsd ? undefined : fmtUsd(l.usd).display,
          swatchStyle: LIQUIDATION_PATTERN,
          icon: <TokenChipIcon symbol={l.symbol} size={14} filterable={false} />,
        })) as BreakdownRow[]
      : []),
    ...[...supplyAssets].reverse().map(
      (r) =>
        ({
          sign: "",
          label: aaveV4DisplaySymbol(r.symbol),
          amount: fmt(r.netSupply),
          usdHint: hideUsd ? undefined : fmtUsd(r.netSupplyUsd).display,
          swatchClass: "bg-blue-500",
          icon: <TokenChipIcon symbol={r.symbol} size={14} filterable={false} />,
        }) as BreakdownRow,
    ),
    {
      sign: "",
      label: isLiveView ? "Total" : "In Protocol",
      amount: fmtUsd(totalSupplyUsd).display,
      isResult: true,
    },
  ];

  const debtRows: BreakdownRow[] = [
    ...(!isLiveView
      ? [
          {
            sign: "",
            label: "Borrowed",
            amount: fmtUsd(totalBorrowedUsd).display,
            swatchStyle: { backgroundColor: DEBT_GREEN_FADED },
          } as BreakdownRow,
        ]
      : []),
    ...(!isLiveView
      ? repaidAssets.map((rA) => ({
          sign: "−",
          label: aaveV4DisplaySymbol(rA.symbol),
          amount: fmt(rA.amount),
          usdHint: hideUsd ? undefined : fmtUsd(rA.usd).display,
          swatchStyle: REPAID_PATTERN,
          icon: <TokenChipIcon symbol={rA.symbol} size={14} filterable={false} />,
        })) as BreakdownRow[]
      : []),
    ...(!isLiveView
      ? liquidatedDebtAssets.map((l) => ({
          sign: "−",
          label: `${aaveV4DisplaySymbol(l.symbol)} liquidated`,
          amount: fmt(l.amount),
          usdHint: hideUsd ? undefined : fmtUsd(l.usd).display,
          swatchStyle: LIQUIDATION_PATTERN,
          icon: <TokenChipIcon symbol={l.symbol} size={14} filterable={false} />,
        })) as BreakdownRow[]
      : []),
    ...[...debtAssets].reverse().map(
      (r) =>
        ({
          sign: "",
          label: aaveV4DisplaySymbol(r.symbol),
          amount: fmt(r.netDebt),
          usdHint: hideUsd ? undefined : fmtUsd(r.netDebtUsd).display,
          swatchClass: "bg-emerald-400",
          icon: <TokenChipIcon symbol={r.symbol} size={14} filterable={false} />,
        }) as BreakdownRow,
    ),
    {
      sign: "",
      label: "Outstanding",
      amount: fmtUsd(totalDebtUsd).display,
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
          sideBarTooltip: collSideBar ? (
            <div className="flex items-center gap-1.5">
              <span>Total</span>
              {dirArrow('in')}
              <span className="ml-auto tabular-nums">{fmtUsd(totalDepositedUsd).title}</span>
            </div>
          ) : undefined,
        }}
        right={
          supplyOnly
            ? undefined
            : {
                segments: debtSegments,
                breakdownRows: debtRows,
                sideBar: debtSideBar,
                placeholder: debtPlaceholder,
                sideBarTooltip: debtSideBar ? (
                  <div className="flex items-center gap-1.5">
                    <span>Total</span>
                    {dirArrow('out')}
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
