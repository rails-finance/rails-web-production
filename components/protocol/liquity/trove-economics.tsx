"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
  TowerBarSkeleton,
  checkerPattern,
  formatPrice,
  formatCompactUsd,
  formatUsdValue,
} from "@/components/shared/economics-chart-primitives";
import { FilterDropdown, DisplaySettingsIcon, type FilterOption } from "@/components/shared/filter-dropdown";
import { usePreferences } from "@/lib/shared/preferences-context";
import { trovePriceRunwayExplanation } from "@/components/protocol/liquity/trove-price-axis";
import { PriceRunway } from "@/components/shared/price-runway";
import { InfoDisclosure } from "@/components/shared/info-disclosure";
import { getLiquidationThreshold } from "@/lib/utils/liquidation-utils";
import { LIQUIDATION_RESERVE_ETH } from "@/components/transaction-timeline/explanation/shared/eventHelpers";
import { formatRatio, ratioLabel, useLiquityRatioColorClass } from "@/lib/shared/ratio-format";
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

function isLiquityMinimal(
  e: MinimalEvent,
): e is MinimalEvent & { context: { protocol: string; data: LiquityContext } } {
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
  // from trove-owner events (wallet's own trove operations). Use ownedTroveIds
  // membership rather than the presence of `troveOwner`/`redeemer` fields so
  // the predicate works for both wallet-scoped and trove-scoped event feeds —
  // on a trove page every event is on the displayed (owned) trove, so no
  // redemption gets mis-classified as "against another trove".
  const ownerEvents = liquityEvents.filter((e) => {
    const c = e.context.data;
    if (c.operation === "redeemCollateral" && c.troveId && !ownedTroveIds.has(c.troveId)) return false;
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
    .filter((e) => e.context.data.operation === "liquidate" && e.context.data.troveOperation)
    .reduce((sum, e) => sum + Math.abs(e.context.data.troveOperation!.collChangeFromOperation), 0);
  const liquidatedCollSeized = Math.max(0, liquidatedCollateral - liquidationCollSurplus);

  const netCollateralChange =
    totalCollateralDeposited - totalCollateralWithdrawn - liquidatedCollateral - redemptionCollLost;

  // Interest: difference method (same as rails-web)
  const totalDebtRepaidOrCleared = totalRepaid + redemptionDebtCleared + liquidationDebtCleared;
  const totalDebtCreated = totalBorrowed + totalUpfrontFees;
  const interestAndManagementFees = Math.max(0, totalDebtRepaidOrCleared - totalDebtCreated);

  return {
    redemption: hasRedemptions
      ? {
          totalDebtCleared: redemptionDebtCleared,
          totalCollateralLost: redemptionCollLost,
          totalCollateralValueAtRedemption: redemptionCollValue,
          totalFeesRetained: redemptionFeesRetained,
          realizedPL,
        }
      : null,
    liquidation: hasLiquidations
      ? {
          totalDebtCleared: liquidationDebtCleared,
          totalCollateralSeized: liquidatedCollSeized,
          totalCollateralSurplus: liquidationCollSurplus,
        }
      : null,
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
      status:
        ctx.stateAfter.debt === 0 && ctx.stateAfter.coll === 0
          ? "closed"
          : ctx.operation === "liquidate"
            ? "liquidated"
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

  // Mirror the ownedTroveIds derivation in calculateEconomicsFromEvents so the
  // wallet-scoped vs trove-scoped predicate stays symmetric.
  const OPEN_OPS = new Set(["openTrove", "openTroveAndJoinBatch"]);
  const ownedTroveIds = new Set<string>();
  for (const e of liquityEvents) {
    const c = e.context.data;
    if (OPEN_OPS.has(c.operation) && c.troveId) ownedTroveIds.add(c.troveId);
  }

  const redeemerEvents = liquityEvents.filter((e) => {
    const c = e.context.data;
    return c.operation === "redeemCollateral" && !!c.troveId && !ownedTroveIds.has(c.troveId);
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
  const effectiveRate =
    stats.totalCollateralReceived > 0 ? stats.totalDebtRedeemed / stats.totalCollateralReceived : null;

  return (
    <div className="rounded-lg bg-raised overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-xs font-bold border bg-rb-200 dark:bg-rb-800 text-foreground border-rb-300 dark:border-rb-700">
              REDEEMER
            </span>
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
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {formatPrice(stats.totalDebtRedeemed)}
              </span>
              <TokenChipIcon symbol={stats.stableSymbol} size={16} />
            </div>
          </div>
          <div>
            <div className=" text-xs">Collateral Received</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {stats.totalCollateralReceived.toFixed(2)}
              </span>
              <TokenChipIcon symbol={stats.collateralType} size={16} />
            </div>
            {collValue !== null && (
              <div className="text-sm text-foreground font-medium mt-0.5">({formatUsdValue(collValue)})</div>
            )}
          </div>
          <div>
            <div className=" text-xs">Avg Rate</div>
            {effectiveRate !== null && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-2xl font-bold text-foreground tabular-nums">{formatPrice(effectiveRate)}</span>
                <span className="text-xs ">
                  {stats.stableSymbol}/{stats.collateralType}
                </span>
              </div>
            )}
            {effectiveRate !== null && currentPrice && (
              <div className="text-sm  font-medium mt-0.5">(spot: {formatPrice(currentPrice)})</div>
            )}
          </div>
        </div>

        {/* Net outcome */}
        {netPL !== null && (
          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-rb-200 dark:border-rb-800 text-xs">
            <span className="">Net outcome at today&apos;s price:</span>
            <span className={`font-bold text-foreground`}>
              {netPL >= 0 ? "+" : "−"}
              {formatUsdValue(Math.abs(netPL))}
            </span>
          </div>
        )}

        {/* Gas */}
        {stats.totalGasCostUsd > 0 && (
          <p className="text-xs  flex items-center gap-0.5 mt-2">
            Gas: {stats.totalGasCostEth.toFixed(4)} <TokenChipIcon symbol="ETH" size={16} /> (
            {formatUsdValue(stats.totalGasCostUsd)})
          </p>
        )}
      </div>
    </div>
  );
}

// ---- Main component ----

export function TroveEconomicsSummary({ events, currentPrice, hideHeader }: TroveEconomicsProps) {
  const { prefs } = usePreferences();
  const ratioMode = prefs.ratioMode;
  const crColor = useLiquityRatioColorClass();

  const baseResult = useMemo(() => calculateEconomicsFromEvents(events), [events]);
  const redeemerStats = useMemo(() => calculateRedeemerStats(events), [events]);
  // Display-menu visibility flag, mirroring Aave V4's chart toolbar:
  // false (default) → historical view (lifetime activity layered in);
  // true → live view (current open position only).
  const [hideHistorical, setHideHistorical] = useState(false);
  const [runwayInfoOpen, setRunwayInfoOpen] = useState(false);

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

  // Include pending interest so "Current Debt" matches reality.
  // For batched troves, meta.interestRate already includes the management fee
  // (it comes from stateAfter.annualInterestRate which is the total batch rate).
  const entireDebt =
    meta.status === "open" && meta.currentDebt > 0
      ? meta.currentDebt +
        calculateAccruedInterest(meta.currentDebt, meta.interestRate, meta.lastActivityAt, Date.now() / 1000)
      : meta.currentDebt;

  // P/L at today's price.
  const opportunityPL =
    redemption && currentPrice ? redemption.totalDebtCleared - redemption.totalCollateralLost * currentPrice : null;

  // Total interest including what's still outstanding in current debt
  const totalInterestAndMgmtFees = Math.max(
    0,
    entireDebt +
      economics.position.totalRepaid +
      (redemption?.totalDebtCleared ?? 0) +
      (liquidation?.totalDebtCleared ?? 0) -
      economics.position.totalBorrowed -
      economics.costs.totalUpfrontFees,
  );

  // Split interest vs delegate fees
  // meta.interestRate already includes mgmt fee for batched troves
  const apiMgmtFees = economics.costs.totalManagementFees ?? 0;
  const mgmtRate = meta.isInBatch ? meta.batchManagementFee : 0;
  const totalRate = meta.interestRate; // includes mgmt fee for batched troves
  const delegateFees =
    apiMgmtFees > 0
      ? Math.min(apiMgmtFees, totalInterestAndMgmtFees)
      : mgmtRate > 0 && totalRate > 0
        ? totalInterestAndMgmtFees * (mgmtRate / totalRate)
        : 0;
  const interestAccrued = Math.max(0, totalInterestAndMgmtFees - delegateFees);
  const totalCosts = economics.costs.totalUpfrontFees + totalInterestAndMgmtFees;

  // Debt tower
  const costsSettled = Math.min(totalCosts, economics.position.totalRepaid);
  const repaidPrincipal = economics.position.totalRepaid - costsSettled;

  // Live = current open trove; historical = lifetime activity (incl. closed/redeemed/liquidated).
  const hasLive = entireDebt > 0.01 || meta.collateralAmount > 0.0001;
  const hasHistory =
    economics.position.totalRepaid > 0 ||
    (liquidation?.totalDebtCleared ?? 0) > 0 ||
    (redemption?.totalDebtCleared ?? 0) > 0 ||
    economics.position.totalCollateralWithdrawn > 0;
  // When only one side has data the view is forced; otherwise the user's
  // hide-historical preference picks between them.
  const isLiveView = !hasHistory ? true : !hasLive ? false : hideHistorical;

  // Direction arrow: → into protocol (repay, debt cleared, deposit, surplus
  // retained); ← out of protocol (borrow, withdraw, liquidate-coll, costs
  // accruing to debt). Replaces the per-segment descriptor word — the
  // segment's pattern/color in the tower conveys *which* state-named flow
  // the row belongs to.
  const dirArrow = (dir: "in" | "out") =>
    dir === "in" ? (
      <ArrowRight className="w-3 h-3 text-rb-500 shrink-0" />
    ) : (
      <ArrowLeft className="w-3 h-3 text-rb-500 shrink-0" />
    );

  const debtTip = (bold: number, dir: "in" | "out") => (
    <div className="flex items-center gap-1.5">
      {dirArrow(dir)}
      <span className="ml-auto tabular-nums">
        {formatPrice(bold)} {stableSymbol}
      </span>
    </div>
  );
  const collTip = (tokenAmount: number, usd: number, dir: "in" | "out") => (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        {dirArrow(dir)}
        <span className="ml-auto tabular-nums">
          {tokenAmount.toFixed(4)} {collateralSymbol}
        </span>
      </div>
      <div className="flex justify-end tabular-nums text-rb-500">{formatUsdValue(usd)}</div>
    </div>
  );

  const debtSegments: TowerSegment[] = [
    {
      key: "current-debt",
      label: "Current Debt",
      value: entireDebt,
      colorClass: "bg-emerald-500",
      tooltip: debtTip(entireDebt, "out"),
    },
    ...(!isLiveView
      ? [
          {
            key: "debt-liquidated",
            label: "Liquidated",
            value: liquidation?.totalDebtCleared ?? 0,
            colorClass: "",
            patternStyle: LIQUIDATION_PATTERN,
            tooltip: debtTip(liquidation?.totalDebtCleared ?? 0, "in"),
          },
        ]
      : []),
    ...(!isLiveView
      ? [
          {
            key: "debt-redeemed",
            label: "Redeemed",
            value: redemption?.totalDebtCleared ?? 0,
            colorClass: "",
            patternStyle: REDEMPTION_PATTERN,
            tooltip: debtTip(redemption?.totalDebtCleared ?? 0, "in"),
          },
        ]
      : []),
    ...(!isLiveView
      ? [
          {
            key: "repaid",
            label: "Repaid",
            value: repaidPrincipal,
            colorClass: "",
            patternStyle: REPAID_PATTERN,
            tooltip: debtTip(repaidPrincipal, "in"),
          },
        ]
      : []),
    ...(!isLiveView
      ? [
          {
            key: "costs",
            label: "Costs",
            value: costsSettled,
            colorClass: "",
            patternStyle: COSTS_PATTERN,
            tooltip: debtTip(costsSettled, "out"),
          },
        ]
      : []),
  ];

  const debtSegmentSum = debtSegments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const debtPeak = Math.max(debtSegmentSum, economics.position.totalBorrowed + totalCosts);

  // Liquidated collateral
  const hasLiquidationEvents = events.some((e) => isLiquityMinimal(e) && e.context.data.operation === "liquidate");
  const rawLiquidatedColl = Math.max(
    0,
    economics.position.totalCollateralDeposited +
      (redemption?.totalFeesRetained ?? 0) -
      meta.collateralAmount -
      economics.position.totalCollateralWithdrawn -
      (redemption?.totalCollateralLost ?? 0),
  );
  const liquidatedColl = hasLiquidationEvents && rawLiquidatedColl > 0.0001 ? rawLiquidatedColl : 0;

  const claimableSurplus = liquidation?.totalCollateralSurplus ?? 0;
  const liquidatedSeized = claimableSurplus > 0 ? Math.max(0, liquidatedColl - claimableSurplus) : liquidatedColl;

  const isZombie = meta.isZombie;
  const feesReceivedColl = redemption?.totalFeesRetained ?? 0;

  // Collateral tower — Claimable + Fees Received are still currently held
  // (acquired through redemption surplus / fee receipts), so they remain in
  // live mode alongside the active In Trove segment. The striped lifetime
  // outflow rows (Redeemed, Liquidated, Withdrawn) drop in live.
  const collSegments: TowerSegment[] = effectivePrice
    ? [
        isZombie
          ? {
              key: "claimable",
              label: "Claimable",
              value: meta.collateralAmount * effectivePrice,
              colorClass: "bg-blue-700 ring-1 ring-inset ring-green-400",
              tooltip: collTip(meta.collateralAmount, meta.collateralAmount * effectivePrice, "in"),
            }
          : {
              key: "in-trove",
              label: "In Trove",
              value: meta.collateralAmount * effectivePrice,
              colorClass: "bg-blue-500",
              tooltip: collTip(meta.collateralAmount, meta.collateralAmount * effectivePrice, "in"),
            },
        {
          key: "liq-surplus",
          label: "Claimable",
          value: claimableSurplus * effectivePrice,
          colorClass: "bg-blue-700 ring-1 ring-inset ring-green-400",
          tooltip: collTip(claimableSurplus, claimableSurplus * effectivePrice, "in"),
        },
        {
          key: "fees-received",
          label: "Fees Received",
          value: feesReceivedColl * effectivePrice,
          colorClass: "bg-cyan-800",
          tooltip: collTip(feesReceivedColl, feesReceivedColl * effectivePrice, "in"),
        },
        ...(!isLiveView
          ? [
              {
                key: "coll-redeemed",
                label: "Redeemed",
                value: (redemption?.totalCollateralLost ?? 0) * effectivePrice,
                colorClass: "",
                patternStyle: REDEMPTION_PATTERN,
                tooltip: collTip(
                  redemption?.totalCollateralLost ?? 0,
                  (redemption?.totalCollateralLost ?? 0) * effectivePrice,
                  "out",
                ),
              },
            ]
          : []),
        ...(!isLiveView
          ? [
              {
                key: "liquidated",
                label: "Liquidated",
                value: liquidatedSeized * effectivePrice,
                colorClass: "",
                patternStyle: LIQUIDATION_PATTERN,
                tooltip: collTip(liquidatedSeized, liquidatedSeized * effectivePrice, "out"),
              },
            ]
          : []),
        ...(!isLiveView
          ? [
              {
                key: "withdrawn",
                label: "Withdrawn",
                value: economics.position.totalCollateralWithdrawn * effectivePrice,
                colorClass: "",
                patternStyle: WITHDRAWN_PATTERN,
                tooltip: collTip(
                  economics.position.totalCollateralWithdrawn,
                  economics.position.totalCollateralWithdrawn * effectivePrice,
                  "out",
                ),
              },
            ]
          : []),
      ]
    : [];

  const collSegmentSum = collSegments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const collPeak = Math.max(
    collSegmentSum,
    effectivePrice ? (economics.position.totalCollateralDeposited + feesReceivedColl) * effectivePrice : 0,
  );
  const towerMax = Math.max(debtPeak, collPeak) * 1.08;

  // Side bars (lifetime totals — drop in live mode).
  const debtSideBar =
    !isLiveView && economics.position.totalBorrowed > 0
      ? {
          heightPct: (economics.position.totalBorrowed / towerMax) * CHART_HEIGHT,
          color: "rgba(52, 211, 153, 0.25)",
        }
      : undefined;

  const collSideBar =
    !isLiveView && effectivePrice && economics.position.totalCollateralDeposited > 0
      ? {
          heightPct: ((economics.position.totalCollateralDeposited * effectivePrice) / towerMax) * CHART_HEIGHT,
          color: "rgba(59, 130, 246, 0.25)",
        }
      : undefined;

  // Debt breakdown rows — striped lifetime rows hidden in live mode.
  const debtBreakdownRows: BreakdownRow[] = [
    {
      sign: "",
      label: "Borrowed",
      amount: formatPrice(economics.position.totalBorrowed),
      symbol: stableSymbol,
      hidden: isLiveView,
      swatchStyle: { backgroundColor: "rgba(52, 211, 153, 0.25)" },
    },
    {
      sign: "+",
      label: "Costs",
      amount: formatPrice(totalCosts),
      symbol: stableSymbol,
      hidden: isLiveView || totalCosts === 0,
      swatchStyle: COSTS_PATTERN,
    },
    {
      sign: "",
      label: "Interest Accrued",
      amount: formatPrice(interestAccrued),
      symbol: stableSymbol,
      hidden: isLiveView || interestAccrued === 0,
      indent: true,
    },
    {
      sign: "",
      label: "Upfront Fees",
      amount: formatPrice(economics.costs.totalUpfrontFees),
      symbol: stableSymbol,
      hidden: isLiveView || economics.costs.totalUpfrontFees === 0,
      indent: true,
    },
    {
      sign: "",
      label: "Delegate Fees",
      amount: formatPrice(delegateFees),
      symbol: stableSymbol,
      hidden: isLiveView || delegateFees === 0,
      indent: true,
    },
    {
      sign: "−",
      label: "Repaid",
      amount: formatPrice(economics.position.totalRepaid),
      symbol: stableSymbol,
      hidden: isLiveView || economics.position.totalRepaid === 0,
      swatchStyle: REPAID_PATTERN,
    },
    {
      sign: "−",
      label: "Redeemed",
      amount: formatPrice(redemption?.totalDebtCleared ?? 0),
      symbol: stableSymbol,
      hidden: isLiveView || !redemption || redemption.totalDebtCleared === 0,
      swatchStyle: REDEMPTION_PATTERN,
    },
    {
      sign: "−",
      label: "Liquidated",
      amount: formatPrice(liquidation?.totalDebtCleared ?? 0),
      symbol: stableSymbol,
      hidden: isLiveView || !liquidation || liquidation.totalDebtCleared === 0,
      swatchStyle: LIQUIDATION_PATTERN,
    },
    {
      sign: "",
      label: "Current Debt",
      amount: formatPrice(entireDebt),
      symbol: stableSymbol,
      isResult: true,
      swatchClass: "bg-emerald-500",
    },
  ];

  // Collateral breakdown rows — striped lifetime rows hidden in live mode.
  const collBreakdownRows: BreakdownRow[] = effectivePrice
    ? [
        {
          sign: "",
          label: "Deposited",
          amount: economics.position.totalCollateralDeposited.toFixed(2),
          symbol: collateralSymbol,
          usdHint: `[${formatCompactUsd(economics.position.totalCollateralDeposited * effectivePrice)}]`,
          hidden: isLiveView,
          swatchStyle: { backgroundColor: "rgba(59, 130, 246, 0.25)" },
        },
        {
          sign: "−",
          label: "Withdrawn",
          amount: economics.position.totalCollateralWithdrawn.toFixed(2),
          symbol: collateralSymbol,
          usdHint: `[${formatCompactUsd(economics.position.totalCollateralWithdrawn * effectivePrice)}]`,
          hidden: isLiveView || economics.position.totalCollateralWithdrawn === 0,
          swatchStyle: WITHDRAWN_PATTERN,
        },
        {
          sign: "−",
          label: "Liquidated",
          amount: liquidatedSeized.toFixed(2),
          symbol: collateralSymbol,
          usdHint: `[${formatCompactUsd(liquidatedSeized * effectivePrice)}]`,
          hidden: isLiveView || liquidatedSeized === 0,
          swatchStyle: LIQUIDATION_PATTERN,
        },
        {
          sign: "−",
          label: "Redeemed",
          amount: (redemption?.totalCollateralLost ?? 0).toFixed(2),
          symbol: collateralSymbol,
          usdHint: `[${formatCompactUsd((redemption?.totalCollateralLost ?? 0) * effectivePrice)}]`,
          hidden: isLiveView || !redemption || redemption.totalCollateralLost === 0,
          swatchStyle: REDEMPTION_PATTERN,
        },
        {
          sign: "+",
          label: "Fees Received",
          amount: feesReceivedColl.toFixed(4),
          symbol: collateralSymbol,
          usdHint: `[${formatCompactUsd(feesReceivedColl * effectivePrice)}]`,
          hidden: feesReceivedColl === 0,
          swatchClass: "bg-cyan-800",
        },
        {
          sign: "",
          label: "Claimable",
          amount: claimableSurplus.toFixed(4),
          symbol: collateralSymbol,
          usdHint: `[${formatCompactUsd(claimableSurplus * effectivePrice)}]`,
          hidden: claimableSurplus === 0,
          swatchClass: "bg-blue-700 ring-1 ring-inset ring-green-400",
        },
        {
          sign: "",
          label: isZombie ? "Claimable" : "In Trove",
          amount: meta.collateralAmount.toFixed(2),
          symbol: collateralSymbol,
          usdHint: `[${formatCompactUsd(meta.collateralAmount * effectivePrice)}]`,
          isResult: true,
          swatchClass: isZombie ? "bg-blue-700 ring-1 ring-inset ring-green-400" : "bg-blue-500",
        },
      ]
    : [];

  // Collateral ratio
  const collRatio =
    effectivePrice && entireDebt > 0 ? ((meta.collateralAmount * effectivePrice) / entireDebt) * 100 : null;

  const statusLabel = meta.status === "open" ? "ACTIVE" : meta.status === "closed" ? "CLOSED" : "LIQUIDATED";
  const statusColor =
    meta.status === "open"
      ? "bg-rb-200 dark:bg-rb-800 text-foreground border-rb-300 dark:border-rb-700"
      : meta.status === "closed"
        ? "bg-rb-400/20 dark:bg-rb-600/20  border-rb-400/30 dark:border-rb-600/30"
        : "bg-rb-200 dark:bg-rb-800 text-foreground border-rb-300 dark:border-rb-700";

  // Batch manager name
  const batchManagerAddr = meta.isInBatch
    ? ((
        liquityEvents.find((e) => (e.context.data as LiquityContext).batchUpdate?.interestBatchManager)?.context
          .data as LiquityContext | undefined
      )?.batchUpdate?.interestBatchManager ??
      (
        liquityEvents.find((e) => (e.context.data as LiquityContext).batchManager)?.context.data as
          | LiquityContext
          | undefined
      )?.batchManager)
    : undefined;
  const batchManagerName = batchManagerAddr ? getBatchManagerName(batchManagerAddr) : undefined;

  // Opened date and age
  const openedTimestamp = liquityEvents.length > 0 ? Math.min(...liquityEvents.map((e) => e.timestamp)) : 0;
  const openedDate =
    openedTimestamp > 0
      ? new Date(openedTimestamp * 1000).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";
  const ageDays = openedTimestamp > 0 ? Math.floor((Date.now() / 1000 - openedTimestamp) / 86400) : 0;
  const eventCount = liquityEvents.length;

  // Pending interest breakdown
  const pendingInterest = entireDebt - meta.currentDebt;
  const pendingBase =
    mgmtRate > 0 && totalRate > 0 ? pendingInterest * ((totalRate - mgmtRate) / totalRate) : pendingInterest;
  const pendingMgmt = pendingInterest - pendingBase;

  // Interest rate cost projections
  const baseRate = totalRate - mgmtRate;
  const dailyCostBase = (entireDebt * baseRate) / 365;
  const yearlyCostBase = entireDebt * baseRate;
  const dailyCostMgmt = mgmtRate > 0 ? (entireDebt * mgmtRate) / 365 : 0;
  const yearlyCostMgmt = mgmtRate > 0 ? entireDebt * mgmtRate : 0;

  // Plain-language runway copy for the economics card's bottom-left (i) —
  // mirrors the conditions under which the price axis renders below.
  const runwayExplanation = (() => {
    if (
      !(
        meta.status === "open" &&
        meta.collateralAmount > 0 &&
        meta.currentDebt > 0 &&
        effectivePrice &&
        effectivePrice > 0
      )
    ) {
      return null;
    }
    const mcr = getLiquidationThreshold(meta.collateralType);
    const liqPrice = (meta.currentDebt * (mcr / 100)) / meta.collateralAmount;
    if (!(liqPrice > 0)) return null;
    return trovePriceRunwayExplanation({
      collateralSymbol,
      debtSymbol: stableSymbol,
      oraclePrice: effectivePrice,
      liquidationPrice: liqPrice,
    });
  })();

  // Plain-language economics footnote. Muted prose; figures that mirror the
  // breakdown tables above render foreground-bold (the same bold-only-on-
  // mirrored-values grammar the position panel uses). Covers what the position
  // panel deliberately doesn't: the lifetime tower decomposition, total costs,
  // the liquidation reserve, and how to read the price runway.
  const fig = (n: number) => (
    <span className="font-semibold text-foreground tabular-nums">
      {formatPrice(n)} {stableSymbol}
    </span>
  );
  const economicsItems: React.ReactNode[] = [];
  if (economics.position.totalBorrowed > 0) {
    economicsItems.push(
      <span key="debt-tower">
        Debt started from {fig(economics.position.totalBorrowed)} borrowed
        {totalCosts > 0 && <> plus {fig(totalCosts)} in costs</>}
        {economics.position.totalRepaid > 0 && <>, then {fig(economics.position.totalRepaid)} was repaid</>}
        {redemption && redemption.totalDebtCleared > 0 && (
          <>
            {economics.position.totalRepaid > 0 ? " and " : ", then "}
            {fig(redemption.totalDebtCleared)} redeemed
          </>
        )}
        {liquidation && liquidation.totalDebtCleared > 0 && <> and {fig(liquidation.totalDebtCleared)} liquidated</>},
        leaving {fig(entireDebt)} owed today.
      </span>,
    );
  }
  if (interestAccrued > 0 || economics.costs.totalUpfrontFees > 0) {
    economicsItems.push(
      <span key="costs">
        Costs are {fig(interestAccrued)} interest accrued over the trove&apos;s life
        {economics.costs.totalUpfrontFees > 0 && <> plus {fig(economics.costs.totalUpfrontFees)} in upfront fees</>}
        {delegateFees > 0 && <> and {fig(delegateFees)} in delegate fees</>}.
      </span>,
    );
  }
  if (meta.status === "open" && LIQUIDATION_RESERVE_ETH > 0) {
    economicsItems.push(
      <span key="liq-reserve">
        <span className="font-semibold text-foreground tabular-nums">{LIQUIDATION_RESERVE_ETH} ETH</span> is held in
        reserve and refunded when the trove is closed.
      </span>,
    );
  }
  if (runwayExplanation) {
    economicsItems.push(<span key="runway">{runwayExplanation}</span>);
  }

  return (
    <>
      {!hideHeader && (
        <div
          className={`rounded-lg overflow-hidden ${meta.status === "closed" ? "bg-rb-100/50 dark:bg-rb-850 opacity-60" : "bg-raised"}`}
        >
          {/* Position Summary Header */}
          <div className="px-5 pt-7 pb-4">
            {/* Row 1: Status + opened info */}
            <div className="flex items-center justify-between mb-2">
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${statusColor}`}>{statusLabel}</span>
              {openedDate && (
                <div className="flex items-center gap-2 text-xs ">
                  <span>Opened {openedDate}</span>
                  <span className="px-1.5 py-0.5 rounded bg-sunken  text-xs font-medium">{ageDays} days</span>
                  <span className=" flex items-center gap-0.5">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m16 3 4 4-4 4" />
                      <path d="M20 7H4" />
                      <path d="m8 21-4-4 4-4" />
                      <path d="M4 17h16" />
                    </svg>
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
                {pendingMgmt > 0.01 && <span className="text-pink-400"> + {pendingMgmt.toFixed(2)} delegate fee</span>}
              </div>
            )}

            {/* Row 4: Three-column metrics */}
            <div className="grid grid-cols-3 gap-4 mt-5">
              {/* Backed by */}
              <div>
                <div className=" text-xs">Backed by</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {meta.collateralAmount.toFixed(2)}
                  </span>
                  <TokenChipIcon symbol={collateralSymbol} size={16} />
                </div>
                {effectivePrice && (
                  <div className="text-sm text-foreground font-medium mt-0.5">
                    ({formatUsdValue(meta.collateralAmount * effectivePrice)})
                  </div>
                )}
              </div>

              {/* Collateral Ratio / LTV */}
              <div>
                <div className=" text-xs">{ratioLabel(ratioMode)}</div>
                {collRatio !== null && (
                  <div className={`text-2xl font-bold tabular-nums mt-1 ${crColor(collRatio, meta.collateralType)}`}>
                    {formatRatio(collRatio, ratioMode)}
                  </div>
                )}
              </div>

              {/* Interest Rate */}
              {meta.interestRate > 0 && (
                <div>
                  <div className=" text-xs flex items-center gap-1">
                    {meta.isInBatch && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    )}
                    Interest Rate
                  </div>
                  <div className="text-2xl font-bold text-foreground tabular-nums mt-1">
                    {(totalRate * 100).toFixed(1)}%
                  </div>
                  {entireDebt > 0 && (
                    <div className="text-[11px]  mt-1 space-y-0.5">
                      <div>
                        ~ {dailyCostBase.toFixed(2)} day / {formatPrice(yearlyCostBase)} year
                      </div>
                      {mgmtRate > 0 && batchManagerName && (
                        <>
                          <div className="text-pink-400">
                            + {(mgmtRate * 100).toFixed(1)}% {batchManagerName}
                          </div>
                          <div className="text-pink-400">
                            ~ {dailyCostMgmt.toFixed(2)} day / {formatPrice(yearlyCostMgmt)} year
                          </div>
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
        <div
          className={`rounded-lg transition-colors ${
            hideHeader ? `${meta.status === "closed" ? "opacity-60" : ""}` : "p-3 border border-transparent"
          }`}
        >
          {hasLive && hasHistory && (
            <div className="flex items-center justify-end gap-2 mb-2 min-h-[28px]">
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
            </div>
          )}
          {debtPeak > 0 && (
            <>
              {/* Towers + breakdowns.
                    `collIsPending` keeps the chart in dual-tower layout
                    while currentPrice is still loading — without it, the
                    coll side computes empty and we'd briefly fall through
                    to single-tower-debt-on-left, then visibly snap back to
                    centered dual when price arrives. The skeleton holds
                    the left slot so the debt tower stays put. */}
              {(() => {
                const collIsPending = !effectivePrice && meta.status === "open";
                const keepDualLayout = collBreakdownRows.length > 0 || collIsPending;
                // Side-bar tooltips: the faded vertical bars encode the
                // lifetime gross totals. Direction arrow shows the flow at
                // the protocol boundary — coll lifetime deposits in (→),
                // debt lifetime borrows out (←).
                const collSideBarTooltip =
                  collSideBar && effectivePrice ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span>Total</span>
                        {dirArrow("in")}
                        <span className="ml-auto tabular-nums">
                          {economics.position.totalCollateralDeposited.toFixed(4)} {collateralSymbol}
                        </span>
                      </div>
                      <div className="flex justify-end tabular-nums">
                        {formatCompactUsd(economics.position.totalCollateralDeposited * effectivePrice)}
                      </div>
                    </div>
                  ) : undefined;
                const debtSideBarTooltip = debtSideBar ? (
                  <div className="flex items-center gap-1.5">
                    <span>Total</span>
                    {dirArrow("out")}
                    <span className="ml-auto tabular-nums">
                      {formatPrice(economics.position.totalBorrowed)} {stableSymbol}
                    </span>
                  </div>
                ) : undefined;
                return (
                  <DualTowerChart
                    left={
                      keepDualLayout
                        ? {
                            segments: collSegments,
                            breakdownRows: collBreakdownRows,
                            sideBar: collSideBar,
                            placeholder: collIsPending ? <TowerBarSkeleton /> : undefined,
                            sideBarTooltip: collSideBarTooltip,
                          }
                        : {
                            segments: debtSegments,
                            breakdownRows: debtBreakdownRows,
                            sideBar: debtSideBar,
                            sideBarTooltip: debtSideBarTooltip,
                          }
                    }
                    right={
                      keepDualLayout
                        ? {
                            segments: debtSegments,
                            breakdownRows: debtBreakdownRows,
                            sideBar: debtSideBar,
                            sideBarTooltip: debtSideBarTooltip,
                          }
                        : undefined
                    }
                    maxValue={towerMax}
                  />
                );
              })()}
              {/* Liquidation-price axis — open troves only, requires a
                    current oracle price. Read-only: shows the current
                    oracle position relative to the trove's liquidation
                    price derived from current collateral/debt. */}
              {meta.status === "open" &&
                meta.collateralAmount > 0 &&
                meta.currentDebt > 0 &&
                effectivePrice &&
                effectivePrice > 0 &&
                (() => {
                  // MCR varies per collateral branch — 110% on WETH, 120% on
                  // wstETH/rETH. Always derive from the trove's collateralType.
                  const mcr = getLiquidationThreshold(meta.collateralType);
                  const liqPrice = (meta.currentDebt * (mcr / 100)) / meta.collateralAmount;
                  if (!(liqPrice > 0)) return null;

                  return (
                    <div className="mt-4">
                      <PriceRunway currentPrice={effectivePrice} liqPrice={liqPrice} />
                    </div>
                  );
                })()}
              {/* Reserve the runway's footprint while the oracle price is still
                    pending, so the real runway slots in without shifting the
                    footer/disclosure below. Mirrors the collateral tower's
                    TowerBarSkeleton — hold the space, don't pop. Heights match
                    PriceRunway: 6px pad + 10px bar + (8px + 16px) label strip. */}
              {meta.status === "open" &&
                meta.collateralAmount > 0 &&
                meta.currentDebt > 0 &&
                !(effectivePrice && effectivePrice > 0) && (
                  <div className="mt-4" aria-hidden="true">
                    <div style={{ paddingTop: 6 }}>
                      <div className="rounded-full bg-skeleton animate-pulse" style={{ height: 10 }} />
                      <div className="mt-2 h-4" />
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
        {/* Footer: redemption / gas summary. The live collateral price rides
                above the TrovePriceAxis marker (and the page price strip) — no
                need to duplicate it here. */}
        <div className="mt-3 space-y-1">
          {redemption && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs mb-1 font-semibold">
              <span className="">Borrower&apos;s net outcome from redemptions was</span>
              <span className={`text-foreground`}>
                {redemption.realizedPL >= 0 ? "+" : "−"}
                {formatUsdValue(Math.abs(redemption.realizedPL))}
              </span>
              {opportunityPL !== null && (
                <>
                  <span className=""> or </span>
                  <span className={` text-foreground`}>
                    {opportunityPL >= 0 ? "+" : "−"}
                    {formatUsdValue(Math.abs(opportunityPL))}
                  </span>
                  <span className="text-xs ">at today&apos;s value</span>
                </>
              )}
            </div>
          )}
          {economics.gas.totalGasCostEth > 0 && (
            <p className="text-xs  flex items-center gap-0.5">
              A total of {economics.gas.totalGasCostEth.toFixed(4)} <TokenChipIcon symbol="ETH" size={16} /> (
              {formatUsdValue(economics.gas.totalGasCostUsd)}) has been spent on gas fees
            </p>
          )}
        </div>
        {/* Standard bottom-left (i): plain-language economics help — the tower
                decomposition, lifetime costs, liquidation reserve, and price
                runway. Muted prose; foreground figures mirror the breakdown
                tables. Distinct from the position panel's "position" (i), which
                explains the headline stats this panel doesn't restate. */}
        {economicsItems.length > 0 && (
          <div className="mt-3">
            <InfoDisclosure open={runwayInfoOpen} onToggle={setRunwayInfoOpen} label="economics">
              <div className="space-y-2 text-sm text-rb-500">
                {economicsItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="select-none text-rb-500">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </InfoDisclosure>
          </div>
        )}
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
