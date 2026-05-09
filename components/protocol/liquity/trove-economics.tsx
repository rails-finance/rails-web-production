"use client";

import { useMemo, useState } from "react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import type { LiquityContext } from "@/lib/shared/types/protocols/liquity";
import type { TroveEconomics as TroveEconomicsType } from "@/types/api/trove";
import { calculateAccruedInterest } from "@/lib/liquity/utils/interest-calculator";
import { FORK_ALL_IDS } from "@/lib/shared/fork-config";
import { getBatchManagerName } from "@/lib/liquity/batch-managers";
import {
  type TowerSegment,
  type BreakdownRow,
  CHART_HEIGHT,
  DualTowerChart,
  checkerPattern,
  formatPrice,
  formatCompactUsd,
  formatUsdValue,
} from "@/components/shared/economics-chart-primitives";
import { FilterDropdown, DisplaySettingsIcon, type FilterOption } from "@/components/shared/filter-dropdown";
import { usePreferences } from "@/lib/shared/preferences-context";
import { TrovePriceAxis } from "@/components/protocol/liquity/trove-price-axis";
import { formatRatio, ratioLabel, ratioColorClass } from "@/lib/shared/ratio-format";
import { useTroveSimulator } from "@/lib/liquity/use-simulator";
import { LiquitySimulatorCard } from "@/components/protocol/liquity/liquity-simulator-card";

// Phase-2: simulator overlay is wired through `useTroveSimulator()` — the
// "What if?" toggle in the chart toolbar opens an interactive card below the
// liquidation-price axis. Tower segments + breakdown rows still reflect the
// historical/live snapshot; threading sim edits through them is a follow-up.

// ---- Types ----

/** Minimal event shape — works with both BaseActivityEvent and TimelineEvent */
interface MinimalEvent {
  timestamp: number;
  context?: { protocol?: string; data?: unknown };
  gas?: { gasCostEth: number; gasCostUsd: number };
}

interface TroveEconomicsProps {
  events: MinimalEvent[];
  currentPrice?: number;
  hideHeader?: boolean;
}

// ---- Economics calculation from events ----

function isLiquityMinimal(e: MinimalEvent): e is MinimalEvent & { context: { protocol: string; data: LiquityContext } } {
  const p = e.context?.protocol;
  return (p === "liquity-v2-troves" || FORK_ALL_IDS.has(p as string)) && !!e.context?.data;
}

function calculateEconomicsFromEvents(events: MinimalEvent[]): (TroveEconomicsType & { _meta: TroveMeta }) | null {
  const liquityEvents = events.filter(isLiquityMinimal);
  if (liquityEvents.length === 0) return null;

  // Find troves the wallet actually owns (opened or joined)
  const OPEN_OPS = new Set(["openTrove", "openTroveAndJoinBatch"]);
  const ownedTroveIds = new Set<string>();
  for (const e of liquityEvents) {
    const c = e.context.data;
    if (OPEN_OPS.has(c.operation) && c.troveId) ownedTroveIds.add(c.troveId);
  }

  // Separate third-party events (redeemer/liquidator acting on someone else's trove)
  // from trove-owner events (wallet's own trove operations)
  const ownerEvents = liquityEvents.filter(e => {
    const c = e.context.data;
    // Redeemer-initiated redemption against another trove
    if (c.operation === "redeemCollateral" && c.troveOwner) return false;
    // Liquidation of a trove the wallet doesn't own (wallet is the liquidator)
    if (c.operation === "liquidate" && c.troveId && !ownedTroveIds.has(c.troveId)) return false;
    return true;
  });

  // If no owner events remain, this wallet is a pure redeemer/liquidator — return null
  if (ownerEvents.length === 0) return null;

  // Sort chronologically
  const sorted = [...ownerEvents].sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted[sorted.length - 1];
  const ctx = latest.context.data;

  let totalBorrowed = 0;
  let totalRepaid = 0;
  let totalCollateralDeposited = 0;
  let totalCollateralWithdrawn = 0;
  let totalUpfrontFees = 0;
  let totalGasCostEth = 0;
  let totalGasCostUsd = 0;

  // Redemption metrics
  let redemptionDebtCleared = 0;
  let redemptionCollLost = 0;
  let redemptionCollValue = 0;
  let redemptionFeesRetained = 0;
  let hasRedemptions = false;

  // Liquidation metrics
  let liquidationDebtCleared = 0;
  let liquidationCollSurplus = 0;
  let hasLiquidations = false;

  for (const event of sorted) {
    const c = event.context.data;

    // Gas
    if (event.gas) {
      totalGasCostEth += event.gas.gasCostEth;
      totalGasCostUsd += event.gas.gasCostUsd;
    }

    if (c.operation === "redeemCollateral") {
      hasRedemptions = true;
      if (c.troveOperation) {
        const debtCleared = Math.abs(c.troveOperation.debtChangeFromOperation);
        redemptionDebtCleared += debtCleared;
        const collLost = Math.abs(c.troveOperation.collChangeFromOperation);
        redemptionCollLost += collLost;
        redemptionCollValue += collLost * c.collateralPrice;
      }
      if (c.redemption) {
        const fee = parseFloat(c.redemption.redemptionFee) || 0;
        redemptionFeesRetained += fee;
      }
      continue;
    }

    if (c.operation === "liquidate") {
      hasLiquidations = true;
      if (c.troveOperation) {
        liquidationDebtCleared += Math.abs(c.troveOperation.debtChangeFromOperation);
      }
      if (c.liquidation) {
        liquidationCollSurplus += c.liquidation.collSurplus;
      }
      continue;
    }

    // Standard trove operations
    if (c.troveOperation) {
      const debtChange = c.troveOperation.debtChangeFromOperation;
      const collChange = c.troveOperation.collChangeFromOperation;

      if (debtChange > 0) totalBorrowed += debtChange;
      else if (debtChange < 0) totalRepaid += Math.abs(debtChange);

      if (collChange > 0) totalCollateralDeposited += collChange;
      else if (collChange < 0) totalCollateralWithdrawn += Math.abs(collChange);

      totalUpfrontFees += c.troveOperation.debtIncreaseFromUpfrontFee || 0;
    }
  }

  const realizedPL = redemptionDebtCleared - redemptionCollValue;

  const liquidatedCollateral = sorted
    .filter(e => e.context.data.operation === "liquidate" && e.context.data.troveOperation)
    .reduce((sum, e) => sum + Math.abs(e.context.data.troveOperation!.collChangeFromOperation), 0);
  const liquidatedCollSeized = Math.max(0, liquidatedCollateral - liquidationCollSurplus);

  const netCollateralChange =
    totalCollateralDeposited - totalCollateralWithdrawn - liquidatedCollateral - redemptionCollLost;

  // Interest: difference method (same as rails-web)
  const totalDebtRepaidOrCleared = totalRepaid + redemptionDebtCleared + liquidationDebtCleared;
  const totalDebtCreated = totalBorrowed + totalUpfrontFees;
  const interestAndManagementFees = Math.max(0, totalDebtRepaidOrCleared - totalDebtCreated);

  return {
    redemption: hasRedemptions ? {
      totalDebtCleared: redemptionDebtCleared,
      totalCollateralLost: redemptionCollLost,
      totalCollateralValueAtRedemption: redemptionCollValue,
      totalFeesRetained: redemptionFeesRetained,
      realizedPL,
    } : null,
    liquidation: hasLiquidations ? {
      totalDebtCleared: liquidationDebtCleared,
      totalCollateralSeized: liquidatedCollSeized,
      totalCollateralSurplus: liquidationCollSurplus,
    } : null,
    gas: {
      totalGasUsed: 0,
      totalGasCostEth,
      totalGasCostUsd,
    },
    costs: {
      totalInterestPaid: interestAndManagementFees,
      totalUpfrontFees,
      totalManagementFees: 0,
    },
    position: {
      totalBorrowed,
      totalRepaid,
      totalCollateralDeposited,
      totalCollateralWithdrawn,
      netCollateralChange,
    },
    _meta: {
      collateralType: ctx.collateralType,
      stablecoinSymbol: ctx.assetType || "BOLD",
      collateralAmount: ctx.stateAfter.coll,
      currentDebt: ctx.stateAfter.debt,
      interestRate: ctx.stateAfter.annualInterestRate,
      isInBatch: ctx.isInBatch,
      batchManagementFee: ctx.batchUpdate?.annualManagementFee ?? 0,
      isZombie: ctx.isZombieTrove,
      lastActivityAt: latest.timestamp,
      status: ctx.stateAfter.debt === 0 && ctx.stateAfter.coll === 0 ? "closed"
        : ctx.operation === "liquidate" ? "liquidated"
        : "open",
    },
  };
}

interface TroveMeta {
  collateralType: string;
  stablecoinSymbol: string;
  collateralAmount: number;
  currentDebt: number;
  interestRate: number;
  isInBatch: boolean;
  batchManagementFee: number;
  isZombie: boolean;
  lastActivityAt: number;
  status: "open" | "closed" | "liquidated";
}

// ---- Pattern constants (using shared checkerPattern) ----

const REDEMPTION_PATTERN = checkerPattern("rgba(251, 146, 60, 0.6)");
const LIQUIDATION_PATTERN = checkerPattern("rgba(248, 113, 113, 0.6)");
const REPAID_PATTERN = checkerPattern("rgba(52, 211, 153, 0.5)");
const WITHDRAWN_PATTERN = checkerPattern("rgba(96, 165, 250, 0.5)");
const COSTS_PATTERN = checkerPattern("rgba(217, 70, 239, 0.5)");

// ---- Redeemer summary ----

interface RedeemerStats {
  totalDebtRedeemed: number;
  totalCollateralReceived: number;
  redemptionCount: number;
  uniqueTroves: number;
  totalGasCostEth: number;
  totalGasCostUsd: number;
  firstTimestamp: number;
  lastTimestamp: number;
  collateralType: string;
  stableSymbol: string;
}

function calculateRedeemerStats(events: MinimalEvent[]): RedeemerStats | null {
  const liquityEvents = events.filter(isLiquityMinimal);
  const redeemerEvents = liquityEvents.filter(e => {
    const c = e.context.data;
    return c.operation === "redeemCollateral" && c.troveOwner;
  });
  if (redeemerEvents.length === 0) return null;

  const sorted = [...redeemerEvents].sort((a, b) => a.timestamp - b.timestamp);
  let totalDebtRedeemed = 0;
  let totalCollateralReceived = 0;
  let totalGasCostEth = 0;
  let totalGasCostUsd = 0;
  const troveIds = new Set<string>();

  for (const event of sorted) {
    const c = event.context.data;
    if (event.gas) {
      totalGasCostEth += event.gas.gasCostEth || 0;
      totalGasCostUsd += event.gas.gasCostUsd || 0;
    }
    if (c.troveOperation) {
      totalDebtRedeemed += Math.abs(c.troveOperation.debtChangeFromOperation);
      totalCollateralReceived += Math.abs(c.troveOperation.collChangeFromOperation);
    }
    if (c.troveId) troveIds.add(c.troveId);
  }

  const ctx = sorted[0].context.data;
  return {
    totalDebtRedeemed,
    totalCollateralReceived,
    redemptionCount: redeemerEvents.length,
    uniqueTroves: troveIds.size,
    totalGasCostEth,
    totalGasCostUsd,
    firstTimestamp: sorted[0].timestamp,
    lastTimestamp: sorted[sorted.length - 1].timestamp,
    collateralType: ctx.collateralType,
    stableSymbol: ctx.assetType || "BOLD",
  };
}

function RedeemerSummary({ stats, currentPrice }: { stats: RedeemerStats; currentPrice?: number }) {
  const dateRange = `${new Date(stats.firstTimestamp * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} – ${new Date(stats.lastTimestamp * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  const collValue = currentPrice ? stats.totalCollateralReceived * currentPrice : null;
  const netPL = collValue !== null ? collValue - stats.totalDebtRedeemed : null;
  // Effective rate: BOLD per unit of collateral received
  const effectiveRate = stats.totalCollateralReceived > 0
    ? stats.totalDebtRedeemed / stats.totalCollateralReceived
    : null;

  return (
    <div className="rounded-lg bg-rb-100 dark:bg-rb-900 overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-xs font-bold border bg-amber-500/20 text-amber-400 border-amber-500/30">REDEEMER</span>
            <span className="text-sm font-medium ">
              {stats.redemptionCount} redemptions across {stats.uniqueTroves} trove{stats.uniqueTroves !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-xs ">{dateRange}</span>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className=" text-xs">BOLD Redeemed</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-2xl font-bold text-foreground tabular-nums">{formatPrice(stats.totalDebtRedeemed)}</span>
              <TokenChipIcon symbol={stats.stableSymbol} size={16} />
            </div>
          </div>
          <div>
            <div className=" text-xs">Collateral Received</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-2xl font-bold text-foreground tabular-nums">{stats.totalCollateralReceived.toFixed(2)}</span>
              <TokenChipIcon symbol={stats.collateralType} size={16} />
            </div>
            {collValue !== null && (
              <div className="text-sm text-green-400 font-medium mt-0.5">({formatUsdValue(collValue)})</div>
            )}
          </div>
          <div>
            <div className=" text-xs">Avg Rate</div>
            {effectiveRate !== null && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-2xl font-bold text-foreground tabular-nums">{formatPrice(effectiveRate)}</span>
                <span className="text-xs ">{stats.stableSymbol}/{stats.collateralType}</span>
              </div>
            )}
            {effectiveRate !== null && currentPrice && (
              <div className="text-sm  font-medium mt-0.5">
                (spot: {formatPrice(currentPrice)})
              </div>
            )}
          </div>
        </div>

        {/* Net outcome */}
        {netPL !== null && (
          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-rb-200 dark:border-rb-800 text-xs">
            <span className="">Net outcome at today&apos;s price:</span>
            <span className={`font-bold ${netPL >= 0 ? "text-green-400" : "text-red-400"}`}>
              {netPL >= 0 ? "+" : "−"}{formatUsdValue(Math.abs(netPL))}
            </span>
          </div>
        )}

        {/* Gas */}
        {stats.totalGasCostUsd > 0 && (
          <p className="text-xs  flex items-center gap-0.5 mt-2">
            Gas: {stats.totalGasCostEth.toFixed(4)}{" "}
            <TokenChipIcon symbol="ETH" size={16} />{" "}
            ({formatUsdValue(stats.totalGasCostUsd)})
          </p>
        )}
      </div>
    </div>
  );
}

// ---- Main component ----

export function TroveEconomicsSummary({
  events,
  currentPrice,
  hideHeader,
}: TroveEconomicsProps) {
  const { prefs } = usePreferences();
  const ratioMode = prefs.ratioMode;

  const baseResult = useMemo(() => calculateEconomicsFromEvents(events), [events]);
  const redeemerStats = useMemo(() => calculateRedeemerStats(events), [events]);
  // Display-menu visibility flag, mirroring Aave V4's chart toolbar:
  // false (default) → historical view (lifetime activity layered in);
  // true → live view (current open position only).
  const [hideHistorical, setHideHistorical] = useState(false);

  // Simulator overlay context — present only when the trove page mounts a
  // <TroveSimulatorProvider>. The `simSnapshot` seeds the simulator card with
  // the latest stateAfter from the timeline (open troves only).
  const simulatorCtx = useTroveSimulator();
  const simSnapshot = useMemo(() => {
    const liq = events.filter(isLiquityMinimal);
    if (liq.length === 0) return null;
    const sorted = [...liq].sort((a, b) => a.timestamp - b.timestamp);
    const ctx = sorted[sorted.length - 1].context.data as LiquityContext;
    const sa = ctx.stateAfter;
    if (!sa || !(sa.coll > 0) || !(sa.debt > 0)) return null;
    return {
      troveId: ctx.troveId,
      coll: sa.coll,
      debt: sa.debt,
      annualInterestRate: sa.annualInterestRate,
      collateralType: ctx.collateralType,
      stablecoinSymbol: ctx.assetType || "BOLD",
    };
  }, [events]);

  // Pure redeemer — no own trove operations
  if (!baseResult && redeemerStats) {
    return <RedeemerSummary stats={redeemerStats} currentPrice={currentPrice} />;
  }

  if (!baseResult) return null;

  const liquityEvents = events.filter(isLiquityMinimal);

  const meta = baseResult._meta;
  const economics: TroveEconomicsType = {
    redemption: baseResult.redemption,
    liquidation: baseResult.liquidation,
    gas: baseResult.gas,
    costs: baseResult.costs,
    position: baseResult.position,
  };
  const effectivePrice = currentPrice;

  const collateralSymbol = meta.collateralType;
  const stableSymbol = meta.stablecoinSymbol;
  const redemption = economics.redemption;
  const liquidation = economics.liquidation ?? null;

  // Simulator open-state derived from context. The toggle below opens/closes
  // the simulator for *this* trove; the panel collapses automatically when the
  // active trove changes (handled inside TroveSimulatorProvider).
  const simTroveId = simSnapshot?.troveId ?? "";
  const isSimulated = !!simTroveId && simulatorCtx?.openTroveId === simTroveId;
  const canShowSimToggle = !!simulatorCtx
    && !!simSnapshot
    && meta.status === "open"
    && !!effectivePrice
    && effectivePrice > 0;

  // Include pending interest so "Current Debt" matches reality.
  // For batched troves, meta.interestRate already includes the management fee
  // (it comes from stateAfter.annualInterestRate which is the total batch rate).
  const entireDebt = meta.status === "open" && meta.currentDebt > 0
    ? meta.currentDebt + calculateAccruedInterest(
        meta.currentDebt,
        meta.interestRate,
        meta.lastActivityAt,
        Date.now() / 1000,
      )
    : meta.currentDebt;

  // P/L at today's price.
  const opportunityPL = redemption && currentPrice
    ? redemption.totalDebtCleared - redemption.totalCollateralLost * currentPrice
    : null;

  // Total interest including what's still outstanding in current debt
  const totalInterestAndMgmtFees = Math.max(0,
    entireDebt
    + economics.position.totalRepaid
    + (redemption?.totalDebtCleared ?? 0)
    + (liquidation?.totalDebtCleared ?? 0)
    - economics.position.totalBorrowed
    - economics.costs.totalUpfrontFees
  );

  // Split interest vs delegate fees
  // meta.interestRate already includes mgmt fee for batched troves
  const apiMgmtFees = economics.costs.totalManagementFees ?? 0;
  const mgmtRate = meta.isInBatch ? meta.batchManagementFee : 0;
  const totalRate = meta.interestRate; // includes mgmt fee for batched troves
  const delegateFees = apiMgmtFees > 0
    ? Math.min(apiMgmtFees, totalInterestAndMgmtFees)
    : (mgmtRate > 0 && totalRate > 0)
      ? totalInterestAndMgmtFees * (mgmtRate / totalRate)
      : 0;
  const interestAccrued = Math.max(0, totalInterestAndMgmtFees - delegateFees);
  const totalCosts = economics.costs.totalUpfrontFees + totalInterestAndMgmtFees;

  // Debt tower
  const costsSettled = Math.min(totalCosts, economics.position.totalRepaid);
  const repaidPrincipal = economics.position.totalRepaid - costsSettled;

  // Live = current open trove; historical = lifetime activity (incl. closed/redeemed/liquidated).
  const hasLive = entireDebt > 0.01 || meta.collateralAmount > 0.0001;
  const hasHistory = economics.position.totalRepaid > 0
    || (liquidation?.totalDebtCleared ?? 0) > 0
    || (redemption?.totalDebtCleared ?? 0) > 0
    || economics.position.totalCollateralWithdrawn > 0;
  // When only one side has data the view is forced; otherwise the user's
  // hide-historical preference picks between them.
  const isLiveView = !hasHistory
    ? true
    : !hasLive
      ? false
      : hideHistorical;

  const debtSegments: TowerSegment[] = [
    { key: "current-debt", label: "Current Debt", value: entireDebt, colorClass: "bg-emerald-500" },
    ...(!isLiveView ? [{ key: "debt-liquidated", label: "Liquidated", value: liquidation?.totalDebtCleared ?? 0, colorClass: "", patternStyle: LIQUIDATION_PATTERN }] : []),
    ...(!isLiveView ? [{ key: "debt-redeemed", label: "Redeemed", value: redemption?.totalDebtCleared ?? 0, colorClass: "", patternStyle: REDEMPTION_PATTERN }] : []),
    ...(!isLiveView ? [{ key: "repaid", label: "Repaid", value: repaidPrincipal, colorClass: "", patternStyle: REPAID_PATTERN }] : []),
    ...(!isLiveView ? [{ key: "costs", label: "Costs", value: costsSettled, colorClass: "", patternStyle: COSTS_PATTERN }] : []),
  ];

  const debtSegmentSum = debtSegments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const debtPeak = Math.max(debtSegmentSum, economics.position.totalBorrowed + totalCosts);

  // Liquidated collateral
  const hasLiquidationEvents = events.some(e => isLiquityMinimal(e) && e.context.data.operation === "liquidate");
  const rawLiquidatedColl = Math.max(0,
    economics.position.totalCollateralDeposited
    + (redemption?.totalFeesRetained ?? 0)
    - meta.collateralAmount
    - economics.position.totalCollateralWithdrawn
    - (redemption?.totalCollateralLost ?? 0)
  );
  const liquidatedColl = hasLiquidationEvents && rawLiquidatedColl > 0.0001 ? rawLiquidatedColl : 0;

  const claimableSurplus = liquidation?.totalCollateralSurplus ?? 0;
  const liquidatedSeized = claimableSurplus > 0
    ? Math.max(0, liquidatedColl - claimableSurplus)
    : liquidatedColl;

  const isZombie = meta.isZombie;
  const feesReceivedColl = redemption?.totalFeesRetained ?? 0;

  // Collateral tower — Claimable + Fees Received are still currently held
  // (acquired through redemption surplus / fee receipts), so they remain in
  // live mode alongside the active In Trove segment. The striped lifetime
  // outflow rows (Redeemed, Liquidated, Withdrawn) drop in live.
  const collSegments: TowerSegment[] = effectivePrice ? [
    isZombie
      ? { key: "claimable", label: "Claimable", value: meta.collateralAmount * effectivePrice, colorClass: "bg-blue-700 ring-1 ring-inset ring-green-400" }
      : { key: "in-trove", label: "In Trove", value: meta.collateralAmount * effectivePrice, colorClass: "bg-blue-500" },
    { key: "liq-surplus", label: "Claimable", value: claimableSurplus * effectivePrice, colorClass: "bg-blue-700 ring-1 ring-inset ring-green-400" },
    { key: "fees-received", label: "Fees Received", value: feesReceivedColl * effectivePrice, colorClass: "bg-cyan-800" },
    ...(!isLiveView ? [{ key: "coll-redeemed", label: "Redeemed", value: (redemption?.totalCollateralLost ?? 0) * effectivePrice, colorClass: "", patternStyle: REDEMPTION_PATTERN }] : []),
    ...(!isLiveView ? [{ key: "liquidated", label: "Liquidated", value: liquidatedSeized * effectivePrice, colorClass: "", patternStyle: LIQUIDATION_PATTERN }] : []),
    ...(!isLiveView ? [{ key: "withdrawn", label: "Withdrawn", value: economics.position.totalCollateralWithdrawn * effectivePrice, colorClass: "", patternStyle: WITHDRAWN_PATTERN }] : []),
  ] : [];

  const collSegmentSum = collSegments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const collPeak = Math.max(collSegmentSum, effectivePrice ? (economics.position.totalCollateralDeposited + feesReceivedColl) * effectivePrice : 0);
  const towerMax = Math.max(debtPeak, collPeak) * 1.08;

  // Side bars (lifetime totals — drop in live mode).
  const debtSideBar = !isLiveView && economics.position.totalBorrowed > 0 ? {
    heightPct: (economics.position.totalBorrowed / towerMax) * CHART_HEIGHT,
    color: "rgba(52, 211, 153, 0.25)",
  } : undefined;

  const collSideBar = !isLiveView && effectivePrice && economics.position.totalCollateralDeposited > 0 ? {
    heightPct: (economics.position.totalCollateralDeposited * effectivePrice / towerMax) * CHART_HEIGHT,
    color: "rgba(59, 130, 246, 0.25)",
  } : undefined;

  // Debt breakdown rows — striped lifetime rows hidden in live mode.
  const debtBreakdownRows: BreakdownRow[] = [
    { sign: "", label: "Borrowed", amount: formatPrice(economics.position.totalBorrowed), symbol: stableSymbol, hidden: isLiveView, swatchStyle: { backgroundColor: "rgba(52, 211, 153, 0.25)" } },
    { sign: "+", label: "Costs", amount: formatPrice(totalCosts), symbol: stableSymbol, hidden: isLiveView || totalCosts === 0, swatchStyle: COSTS_PATTERN },
    { sign: "", label: "Interest Accrued", amount: formatPrice(interestAccrued), symbol: stableSymbol, hidden: isLiveView || interestAccrued === 0, indent: true },
    { sign: "", label: "Upfront Fees", amount: formatPrice(economics.costs.totalUpfrontFees), symbol: stableSymbol, hidden: isLiveView || economics.costs.totalUpfrontFees === 0, indent: true },
    { sign: "", label: "Delegate Fees", amount: formatPrice(delegateFees), symbol: stableSymbol, hidden: isLiveView || delegateFees === 0, indent: true },
    { sign: "−", label: "Repaid", amount: formatPrice(economics.position.totalRepaid), symbol: stableSymbol, hidden: isLiveView || economics.position.totalRepaid === 0, swatchStyle: REPAID_PATTERN },
    { sign: "−", label: "Redeemed", amount: formatPrice(redemption?.totalDebtCleared ?? 0), symbol: stableSymbol, hidden: isLiveView || !redemption || redemption.totalDebtCleared === 0, swatchStyle: REDEMPTION_PATTERN },
    { sign: "−", label: "Liquidated", amount: formatPrice(liquidation?.totalDebtCleared ?? 0), symbol: stableSymbol, hidden: isLiveView || !liquidation || liquidation.totalDebtCleared === 0, swatchStyle: LIQUIDATION_PATTERN },
    { sign: "", label: "Current Debt", amount: formatPrice(entireDebt), symbol: stableSymbol, isResult: true, swatchClass: "bg-emerald-500" },
  ];

  // Collateral breakdown rows — striped lifetime rows hidden in live mode.
  const collBreakdownRows: BreakdownRow[] = effectivePrice ? [
    {
      sign: "", label: "Deposited",
      amount: economics.position.totalCollateralDeposited.toFixed(2),
      symbol: collateralSymbol,
      usdHint: `[${formatCompactUsd(economics.position.totalCollateralDeposited * effectivePrice)}]`,
      hidden: isLiveView,
      swatchStyle: { backgroundColor: "rgba(59, 130, 246, 0.25)" },
    },
    {
      sign: "−", label: "Withdrawn",
      amount: economics.position.totalCollateralWithdrawn.toFixed(2),
      symbol: collateralSymbol,
      usdHint: `[${formatCompactUsd(economics.position.totalCollateralWithdrawn * effectivePrice)}]`,
      hidden: isLiveView || economics.position.totalCollateralWithdrawn === 0,
      swatchStyle: WITHDRAWN_PATTERN,
    },
    {
      sign: "−", label: "Liquidated",
      amount: liquidatedSeized.toFixed(2),
      symbol: collateralSymbol,
      usdHint: `[${formatCompactUsd(liquidatedSeized * effectivePrice)}]`,
      hidden: isLiveView || liquidatedSeized === 0,
      swatchStyle: LIQUIDATION_PATTERN,
    },
    {
      sign: "−", label: "Redeemed",
      amount: (redemption?.totalCollateralLost ?? 0).toFixed(2),
      symbol: collateralSymbol,
      usdHint: `[${formatCompactUsd((redemption?.totalCollateralLost ?? 0) * effectivePrice)}]`,
      hidden: isLiveView || !redemption || redemption.totalCollateralLost === 0,
      swatchStyle: REDEMPTION_PATTERN,
    },
    {
      sign: "+", label: "Fees Received",
      amount: feesReceivedColl.toFixed(4),
      symbol: collateralSymbol,
      usdHint: `[${formatCompactUsd(feesReceivedColl * effectivePrice)}]`,
      hidden: feesReceivedColl === 0,
      swatchClass: "bg-cyan-800",
    },
    {
      sign: "", label: "Claimable",
      amount: claimableSurplus.toFixed(4),
      symbol: collateralSymbol,
      usdHint: `[${formatCompactUsd(claimableSurplus * effectivePrice)}]`,
      hidden: claimableSurplus === 0,
      swatchClass: "bg-blue-700 ring-1 ring-inset ring-green-400",
    },
    {
      sign: "", label: isZombie ? "Claimable" : "In Trove",
      amount: meta.collateralAmount.toFixed(2),
      symbol: collateralSymbol,
      usdHint: `[${formatCompactUsd(meta.collateralAmount * effectivePrice)}]`,
      isResult: true,
      swatchClass: isZombie ? "bg-blue-700 ring-1 ring-inset ring-green-400" : "bg-blue-500",
    },
  ] : [];

  // Collateral ratio
  const collRatio = effectivePrice && entireDebt > 0
    ? (meta.collateralAmount * effectivePrice) / entireDebt * 100
    : null;

  const statusLabel = meta.status === "open" ? "ACTIVE" : meta.status === "closed" ? "CLOSED" : "LIQUIDATED";
  const statusColor = meta.status === "open"
    ? "bg-green-500/20 text-green-400 border-green-500/30"
    : meta.status === "closed"
      ? "bg-rb-400/20 dark:bg-rb-600/20  border-rb-400/30 dark:border-rb-600/30"
      : "bg-red-500/20 text-red-400 border-red-500/30";

  // Batch manager name
  const batchManagerAddr = meta.isInBatch
    ? (liquityEvents.find(e => (e.context.data as LiquityContext).batchUpdate?.interestBatchManager)?.context.data as LiquityContext | undefined)?.batchUpdate?.interestBatchManager
      ?? (liquityEvents.find(e => (e.context.data as LiquityContext).batchManager)?.context.data as LiquityContext | undefined)?.batchManager
    : undefined;
  const batchManagerName = batchManagerAddr ? getBatchManagerName(batchManagerAddr) : undefined;

  // Opened date and age
  const openedTimestamp = liquityEvents.length > 0
    ? Math.min(...liquityEvents.map(e => e.timestamp))
    : 0;
  const openedDate = openedTimestamp > 0
    ? new Date(openedTimestamp * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const ageDays = openedTimestamp > 0
    ? Math.floor((Date.now() / 1000 - openedTimestamp) / 86400)
    : 0;
  const eventCount = liquityEvents.length;

  // Pending interest breakdown
  const pendingInterest = entireDebt - meta.currentDebt;
  const pendingBase = mgmtRate > 0 && totalRate > 0
    ? pendingInterest * ((totalRate - mgmtRate) / totalRate)
    : pendingInterest;
  const pendingMgmt = pendingInterest - pendingBase;

  // Interest rate cost projections
  const baseRate = totalRate - mgmtRate;
  const dailyCostBase = (entireDebt * baseRate) / 365;
  const yearlyCostBase = entireDebt * baseRate;
  const dailyCostMgmt = mgmtRate > 0 ? (entireDebt * mgmtRate) / 365 : 0;
  const yearlyCostMgmt = mgmtRate > 0 ? entireDebt * mgmtRate : 0;

  return (
    <>
    {!hideHeader && (
    <div className={`rounded-lg overflow-hidden ${meta.status === "closed" ? "bg-rb-100/50 dark:bg-rb-850 opacity-60" : "bg-rb-100 dark:bg-rb-900"}`}>
      {/* Position Summary Header */}
      <div className="px-5 pt-7 pb-4">

        {/* Row 1: Status + opened info */}
        <div className="flex items-center justify-between mb-2">
          <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${statusColor}`}>
            {statusLabel}
          </span>
          {openedDate && (
            <div className="flex items-center gap-2 text-xs ">
              <span>Opened {openedDate}</span>
              <span className="px-1.5 py-0.5 rounded bg-rb-200 dark:bg-rb-900  text-xs font-medium">{ageDays} days</span>
              <span className=" flex items-center gap-0.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
                {eventCount}
              </span>
            </div>
          )}
        </div>

        {/* Row 2: Debt headline */}
        {entireDebt > 0 && (
          <>
            <div className=" text-xs mt-3">Debt</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-4xl font-bold text-foreground tabular-nums">{formatPrice(entireDebt)}</span>
              <TokenChipIcon symbol={stableSymbol} size={32} />
            </div>
          </>
        )}

        {/* Row 3: Debt breakdown */}
        {pendingInterest > 0.01 && (
          <div className="text-sm  mt-1">
            {formatPrice(meta.currentDebt)} + {pendingBase.toFixed(2)} interest
            {pendingMgmt > 0.01 && (
              <span className="text-pink-400"> + {pendingMgmt.toFixed(2)} delegate fee</span>
            )}
          </div>
        )}

        {/* Row 4: Three-column metrics */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          {/* Backed by */}
          <div>
            <div className=" text-xs">Backed by</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-2xl font-bold text-foreground tabular-nums">{meta.collateralAmount.toFixed(2)}</span>
              <TokenChipIcon symbol={collateralSymbol} size={16} />
            </div>
            {effectivePrice && (
              <div className="text-sm text-green-400 font-medium mt-0.5">({formatUsdValue(meta.collateralAmount * effectivePrice)})</div>
            )}
          </div>

          {/* Collateral Ratio / LTV */}
          <div>
            <div className=" text-xs">{ratioLabel(ratioMode)}</div>
            {collRatio !== null && (
              <div className={`text-2xl font-bold tabular-nums mt-1 ${ratioColorClass(collRatio, { safeClass: "text-foreground" })}`}>
                {formatRatio(collRatio, ratioMode)}
              </div>
            )}
          </div>

          {/* Interest Rate */}
          {meta.interestRate > 0 && (
            <div>
              <div className=" text-xs flex items-center gap-1">
                {meta.isInBatch && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                )}
                Interest Rate
              </div>
              <div className="text-2xl font-bold text-foreground tabular-nums mt-1">
                {(totalRate * 100).toFixed(1)}%
              </div>
              {entireDebt > 0 && (
                <div className="text-[11px]  mt-1 space-y-0.5">
                  <div>~ {dailyCostBase.toFixed(2)} day / {formatPrice(yearlyCostBase)} year</div>
                  {mgmtRate > 0 && batchManagerName && (
                    <>
                      <div className="text-pink-400">+ {(mgmtRate * 100).toFixed(1)}% {batchManagerName}</div>
                      <div className="text-pink-400">~ {dailyCostMgmt.toFixed(2)} day / {formatPrice(yearlyCostMgmt)} year</div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
    )}

    {/* Trove Economics — separate panel. The chart panel itself stays
        chromeless; the parent (a full-bleed band on the trove page, or the
        umbrella wallet card) supplies any surrounding background. */}
    <div className={hideHeader ? "" : "mt-3 pt-2"}>
            <div className={`rounded-lg transition-colors ${
              hideHeader
                ? `${meta.status === "closed" ? "opacity-60" : ""}`
                : "p-3 border border-transparent"
            }`}>
            {((hasLive && hasHistory) || canShowSimToggle) && (
              <div className="flex items-center justify-end gap-2 mb-2 min-h-[28px]">
                {canShowSimToggle && (
                  <button
                    type="button"
                    onClick={() => simulatorCtx!.toggle(simTroveId)}
                    aria-pressed={isSimulated}
                    title={isSimulated ? "Close the simulator" : "Open the what-if simulator"}
                    className={`text-xs font-medium px-2 py-1 rounded-md transition-colors cursor-pointer ${
                      isSimulated
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30"
                        : "bg-rb-200 dark:bg-rb-900 text-rb-500 hover:text-foreground hover:bg-rb-300 dark:hover:bg-rb-800 border border-transparent"
                    }`}
                  >
                    What if?
                  </button>
                )}
                {hasLive && hasHistory && (
                  <FilterDropdown
                    label="Display"
                    options={[{ key: "hide-historical", label: "Hide inactive / repaid" } satisfies FilterOption]}
                    selected={hideHistorical ? new Set(["hide-historical"]) : new Set<string>()}
                    onSelect={() => {}}
                    multi
                    minimal
                    align="right"
                    variant="ghost"
                    triggerIcon={<DisplaySettingsIcon size={14} />}
                    onToggle={() => setHideHistorical((v) => !v)}
                  />
                )}
              </div>
            )}
            {debtPeak > 0 && (
              <>
                {/* Towers + breakdowns */}
                <DualTowerChart
                  left={collBreakdownRows.length > 0 ? {
                    segments: collSegments,
                    breakdownRows: collBreakdownRows,
                    sideBar: collSideBar,
                  } : {
                    segments: debtSegments,
                    breakdownRows: debtBreakdownRows,
                    sideBar: debtSideBar,
                  }}
                  right={collBreakdownRows.length > 0 ? {
                    segments: debtSegments,
                    breakdownRows: debtBreakdownRows,
                    sideBar: debtSideBar,
                  } : undefined}
                  maxValue={towerMax}
                />
                {/* Liquidation-price axis — open troves only, requires a
                    current oracle price. When the simulator is open the
                    axis switches to the sim's coll/debt/price so it
                    mirrors what the user is changing. The axis pushes
                    drag updates through `simulatorCtx.requestPrice`,
                    which the simulator card folds back into its derived
                    state. We hide the axis entirely when the sim has
                    fully unwound the position (debt or coll = 0) — there
                    is no liquidation price for an empty trove. */}
                {meta.status === "open" && meta.collateralAmount > 0 && meta.currentDebt > 0 && effectivePrice && effectivePrice > 0 && (() => {
                  const simEdits = isSimulated ? simulatorCtx?.edits ?? null : null;
                  const useSim = simEdits && simEdits.troveId === simTroveId;
                  const axisColl = useSim ? simEdits.sim.coll : meta.collateralAmount;
                  const axisDebt = useSim ? simEdits.sim.debt : meta.currentDebt;
                  const axisOraclePrice = useSim ? simEdits.sim.price : effectivePrice;
                  if (!(axisColl > 0) || !(axisDebt > 0) || !(axisOraclePrice > 0)) return null;
                  const liqPrice = (axisDebt * 1.1) / axisColl;
                  if (!(liqPrice > 0)) return null;
                  const axisDraggable = isSimulated && !!simulatorCtx;
                  const axisPriceMin = Math.max(0.01, effectivePrice * 0.1);
                  const axisPriceMax = Math.max(effectivePrice * 2.5, 10000);
                  return (
                    <div className="mt-4">
                      <TrovePriceAxis
                        collateralSymbol={collateralSymbol}
                        debtSymbol={stableSymbol}
                        oraclePrice={axisOraclePrice}
                        liquidationPrice={liqPrice}
                        simulated={isSimulated}
                        onOraclePriceChange={axisDraggable ? (p) => simulatorCtx!.requestPrice(p) : undefined}
                        priceMin={axisDraggable ? axisPriceMin : undefined}
                        priceMax={axisDraggable ? axisPriceMax : undefined}
                      />
                    </div>
                  );
                })()}
                {isSimulated && simSnapshot && simTroveId && effectivePrice && (
                  <div className="mt-4">
                    <LiquitySimulatorCard
                      troveId={simTroveId}
                      current={{
                        coll: simSnapshot.coll,
                        debt: simSnapshot.debt,
                        annualInterestRate: simSnapshot.annualInterestRate,
                        collateralType: simSnapshot.collateralType,
                        stablecoinSymbol: simSnapshot.stablecoinSymbol,
                      }}
                      currentPrice={effectivePrice}
                      onClose={() => simulatorCtx!.close()}
                    />
                  </div>
                )}
              </>
            )}
            </div>
            {/* Footer: redemption / gas summary. The standalone collateral
                price chip lives on the TrovePriceAxis pill above — no need
                to duplicate it here. */}
            <div className="mt-3 space-y-1">
              {redemption && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs mb-1 font-semibold">
                  <span className="">Borrower&apos;s net outcome from redemptions was</span>
                  <span className={`${
                    redemption.realizedPL >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}>
                    {redemption.realizedPL >= 0 ? "+" : "−"}{formatUsdValue(Math.abs(redemption.realizedPL))}
                  </span>
                  {opportunityPL !== null && (
                    <>
                      <span className=""> or </span>
                      <span className={` ${
                        opportunityPL >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}>
                        {opportunityPL >= 0 ? "+" : "−"}{formatUsdValue(Math.abs(opportunityPL))}
                      </span>
                      <span className="text-xs ">at today&apos;s value</span>
                    </>
                  )}
                </div>
              )}
              {economics.gas.totalGasCostEth > 0 && (
                <p className="text-xs  flex items-center gap-0.5">
                  A total of {economics.gas.totalGasCostEth.toFixed(4)}{" "}
                  <TokenChipIcon symbol="ETH" size={16} />{" "}
                  ({formatUsdValue(economics.gas.totalGasCostUsd)}) has been spent on gas fees
                </p>
              )}
            </div>
    </div>
    {/* Redeemer activity (mixed wallet: owns troves + initiated redemptions) */}
    {redeemerStats && (
      <div className="mt-3">
        <RedeemerSummary stats={redeemerStats} currentPrice={currentPrice} />
      </div>
    )}
    </>
  );
}
