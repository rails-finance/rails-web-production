// Pure-logic helpers for building Aave V4 spoke selector cards. Adapted from
// rails-explorer's lib/aave/spoke-cards.ts — web-mig only ships aave-v4 (no
// aave-v3 / spark surface yet), so the multi-protocol guard collapses to an
// aave-v4 check, the AaveContext import becomes AaveV4Context, and the event
// type uses BaseActivityEvent's shape.
//
// Crucially, every datapoint here (HF, liq price, borrowing power, net APY,
// dominant-asset headroom %) derives from the events the API already returns
// plus the static LT lookup table — no on-chain reads are needed.

import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import type { AaveV4Context } from "@/lib/shared/types/protocols/aave-v4";
import { type PriceEntry, resolvePrice } from "@/lib/aave/prices";
import { SPOKE_HUB, type HubTier } from "@/components/protocol/aave-v4/aave-v4-spoke-constants";
import { getLiquidationThreshold } from "@/lib/aave-v4/liquidation-thresholds";
import { simulateAaveV4Position } from "@/lib/aave-v4/utils/simulate";

// ---- Types ----

interface DebtPoint { timestamp: number; debt: number; eventIndex: number }
interface FlowEvent {
  timestamp: number;
  amount: number;
  side: "supply" | "borrow";
  direction: "in" | "out";
  label: string;
  eventIndex: number;
}

export interface ReserveStats {
  symbol: string;
  supplied: number;
  withdrawn: number;
  borrowed: number;
  repaid: number;
  liquidatedDebt: number;
  liquidatedCollateral: number;
  liquidationCount: number;
  eventCount: number;
  collateralEnabled?: boolean;
  debtSeries: DebtPoint[];
  peakDebt: number;
  peakDebtTimestamp: number;
  peakSupply: number;
  flowEvents: FlowEvent[];
  /** Chain-truth current balance for this reserve, when an on-chain read has
   *  been applied (see `patchReservesWithChain`). When absent, consumers
   *  derive current state from `supplied − withdrawn − liquidatedCollateral`.
   *  Keeping this separate from `supplied`/`withdrawn` preserves the lifetime
   *  totals the historical tower chart needs. */
  currentSupplied?: number;
  /** Chain-truth current debt balance for this reserve. See `currentSupplied`. */
  currentBorrowed?: number;
}

export interface AaveEconomicsResult {
  reserves: ReserveStats[];
  totalGasCostEth: number;
  totalGasCostUsd: number;
  eventCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
}

export interface SpokeGroup {
  name: string;
  hub: HubTier;
  events: BaseActivityEvent[];
  result: AaveEconomicsResult;
  totalSupplyUsd: number;
  totalDebtUsd: number;
  collRatio: number | null;
  isClosed: boolean;
  eventCount: number;
}

export interface AaveSpokeCardInfo {
  name: string;
  hub: HubTier;
  totalSupplyUsd: number;
  totalDebtUsd: number;
  peakSupplyUsd: number;
  peakDebtUsd: number;
  collRatio: number | null;
  isClosed: boolean;
  eventCount: number;
  supplyingSymbols: string[];
  borrowingSymbols: string[];
  latestBorrowRate: number | null;
  /** Aave-native HF = weightedCollateralUsd / totalDebtUsd. null when no debt. */
  healthFactor: number | null;
  /** Liq price for the dominant collateral asset (largest USD share). null when
   *  no debt, single-asset can't reach liq, or there's no priced collateral. */
  liqPrice: { symbol: string; currentPrice: number; liqPrice: number; headroomPct: number } | null;
  /** Per-collateral-asset liq prices (full output of the simulator). Drives the
   *  stacked price-runway view below the active spoke card. Sorted by USD share
   *  desc so the runway stack reads dominant → minor. */
  assetLiqPrices: { symbol: string; address?: string; currentPrice: number; liqPrice: number | null; headroomPct: number | null; usdShare: number }[];
  /** Remaining USD that can be borrowed before HF=1. */
  borrowingPowerUsd: number;
  /** Blended supply yield − borrow cost, as a % of equity (collateral − debt).
   *  Positive = position earning net; negative = leverage cost outweighs yield. */
  netApy: number | null;
  /** True when the wallet has ever been liquidated on this spoke. Surfaces
   *  a red LIQUIDATED indicator alongside the status pill — the position may
   *  still be active afterwards, but the history is permanent. */
  wasLiquidated: boolean;
}

// ---- Guard ----

function isAaveV4Event(
  e: BaseActivityEvent,
): e is BaseActivityEvent & { context: { protocol: "aave-v4"; data: AaveV4Context } } {
  return e.context?.protocol === "aave-v4" && !!e.context?.data;
}

// ---- Calculation ----

export function calculateAaveEconomics(
  events: BaseActivityEvent[],
  eventIndexMap?: Map<string, number>,
): AaveEconomicsResult | null {
  const aaveEvents = events.filter(isAaveV4Event);
  if (aaveEvents.length === 0) return null;

  const sorted = [...aaveEvents].sort((a, b) => a.timestamp - b.timestamp);

  const reserveMap = new Map<string, ReserveStats>();
  let totalGasCostEth = 0;
  let totalGasCostUsd = 0;

  const runningDebt = new Map<string, number>();
  const runningSupply = new Map<string, number>();
  let fallbackSeq = 0;

  for (const event of sorted) {
    const ctx = event.context.data;
    const amount = parseFloat(ctx.amount ?? "0");
    const symbol = ctx.reserveSymbol ?? "?";
    fallbackSeq++;
    const eventSeq = eventIndexMap?.get(event.id) ?? fallbackSeq;

    if (event.gas) {
      totalGasCostEth += event.gas.gasCostEth || 0;
      totalGasCostUsd += event.gas.gasCostUsd || 0;
    }

    let stats = reserveMap.get(symbol);
    if (!stats) {
      stats = {
        symbol, supplied: 0, withdrawn: 0, borrowed: 0, repaid: 0,
        liquidatedDebt: 0, liquidatedCollateral: 0, liquidationCount: 0,
        eventCount: 0,
        debtSeries: [], peakDebt: 0, peakDebtTimestamp: 0, peakSupply: 0, flowEvents: [],
      };
      reserveMap.set(symbol, stats);
      runningDebt.set(symbol, 0);
      runningSupply.set(symbol, 0);
    }
    stats.eventCount++;

    switch (ctx.eventType) {
      case "supply": {
        stats.supplied += amount;
        const supply = (runningSupply.get(symbol) ?? 0) + amount;
        runningSupply.set(symbol, supply);
        if (supply > stats.peakSupply) stats.peakSupply = supply;
        if (amount > 0) stats.flowEvents.push({ timestamp: event.timestamp, amount, side: "supply", direction: "in", label: "Supply", eventIndex: eventSeq });
        break;
      }
      case "withdraw": {
        stats.withdrawn += amount;
        runningSupply.set(symbol, Math.max(0, (runningSupply.get(symbol) ?? 0) - amount));
        if (amount > 0) stats.flowEvents.push({ timestamp: event.timestamp, amount, side: "supply", direction: "out", label: "Withdraw", eventIndex: eventSeq });
        break;
      }
      case "borrow":
        stats.borrowed += amount;
        runningDebt.set(symbol, (runningDebt.get(symbol) ?? 0) + amount);
        if (amount > 0) stats.flowEvents.push({ timestamp: event.timestamp, amount, side: "borrow", direction: "in", label: "Borrow", eventIndex: eventSeq });
        break;
      case "repay":
        stats.repaid += amount;
        runningDebt.set(symbol, (runningDebt.get(symbol) ?? 0) - amount);
        if (amount > 0) stats.flowEvents.push({ timestamp: event.timestamp, amount, side: "borrow", direction: "out", label: "Repay", eventIndex: eventSeq });
        break;
      case "liquidation": {
        // V4 liquidation events carry two assets:
        //   reserveSymbol  → the debt that was covered     (debtToCover)
        //   collateralSymbol → the collateral that was seized (liquidatedCollateralAmount)
        // The two amounts are denominated in different tokens, so they must
        // land on different ReserveStats records.
        const debtCovered = parseFloat(ctx.debtToCover ?? "0");
        const collSeized = parseFloat(ctx.liquidatedCollateralAmount ?? "0");
        const collSym = ctx.collateralSymbol;

        stats.liquidatedDebt += debtCovered;
        stats.liquidationCount++;
        runningDebt.set(symbol, (runningDebt.get(symbol) ?? 0) - debtCovered);
        if (debtCovered > 0) stats.flowEvents.push({ timestamp: event.timestamp, amount: debtCovered, side: "borrow", direction: "out", label: "Liquidate", eventIndex: eventSeq });

        if (collSeized > 0) {
          // Collateral side lands on the seized asset's stats. When the
          // event omits collateralSymbol (older data), fall back to the
          // debt-side stats so the seizure isn't lost.
          let collStats = stats;
          if (collSym && collSym !== symbol) {
            let cs = reserveMap.get(collSym);
            if (!cs) {
              cs = {
                symbol: collSym, supplied: 0, withdrawn: 0, borrowed: 0, repaid: 0,
                liquidatedDebt: 0, liquidatedCollateral: 0, liquidationCount: 0,
                eventCount: 0,
                debtSeries: [], peakDebt: 0, peakDebtTimestamp: 0, peakSupply: 0, flowEvents: [],
              };
              reserveMap.set(collSym, cs);
              runningDebt.set(collSym, 0);
              runningSupply.set(collSym, 0);
            }
            collStats = cs;
          }
          collStats.liquidatedCollateral += collSeized;
          runningSupply.set(collStats.symbol, Math.max(0, (runningSupply.get(collStats.symbol) ?? 0) - collSeized));
          collStats.flowEvents.push({ timestamp: event.timestamp, amount: collSeized, side: "supply", direction: "out", label: "Liquidate", eventIndex: eventSeq });
        }
        break;
      }
      default:
        if (ctx.eventType === "collateral_toggle") {
          stats.collateralEnabled = !!ctx.enabled;
        }
        break;
    }

    if (ctx.eventType === "borrow" || ctx.eventType === "repay" || ctx.eventType === "liquidation") {
      const debt = Math.max(0, runningDebt.get(symbol) ?? 0);
      stats.debtSeries.push({ timestamp: event.timestamp, debt, eventIndex: eventSeq });
      if (debt > stats.peakDebt) {
        stats.peakDebt = debt;
        stats.peakDebtTimestamp = event.timestamp;
      }
    }
  }

  return {
    reserves: [...reserveMap.values()],
    totalGasCostEth,
    totalGasCostUsd,
    eventCount: aaveEvents.length,
    firstTimestamp: sorted[0].timestamp,
    lastTimestamp: sorted[sorted.length - 1].timestamp,
  };
}

// ---- Spoke grouping ----

export function groupBySpoke(
  events: BaseActivityEvent[],
  eventIndexMap?: Map<string, number>,
  prices?: Record<string, PriceEntry | number>,
): SpokeGroup[] {
  const spokeMap = new Map<string, BaseActivityEvent[]>();
  for (const e of events) {
    if (!isAaveV4Event(e)) continue;
    const spoke = e.context.data.spokeName ?? "Main";
    const list = spokeMap.get(spoke) ?? [];
    list.push(e);
    spokeMap.set(spoke, list);
  }

  const groups: SpokeGroup[] = [];
  for (const [name, spokeEvents] of spokeMap) {
    const result = calculateAaveEconomics(spokeEvents, eventIndexMap);
    if (!result) continue;
    const totalSupplyUsd = result.reserves.reduce(
      (s, r) => s + Math.max(0, r.supplied - r.withdrawn) * (resolvePrice(r.symbol, prices) ?? 1),
      0,
    );
    const totalDebtUsd = result.reserves.reduce(
      (s, r) => s + Math.max(0, r.borrowed - r.repaid) * (resolvePrice(r.symbol, prices) ?? 1),
      0,
    );
    groups.push({
      name,
      hub: SPOKE_HUB[name] ?? "Core",
      events: spokeEvents,
      result,
      totalSupplyUsd,
      totalDebtUsd,
      collRatio: totalDebtUsd > 0 && totalSupplyUsd > 0 ? (totalSupplyUsd / totalDebtUsd) * 100 : null,
      isClosed: totalSupplyUsd < 1 && totalDebtUsd < 1,
      eventCount: result.eventCount,
    });
  }

  return groups.sort((a, b) => {
    if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
    return b.totalSupplyUsd - a.totalSupplyUsd;
  });
}

// USD threshold for asset-icon dust filtering — keeps the open-card icons
// consistent with the chart breakdown and prevents token-unit thresholds from
// stripping genuinely-valued dust on one asset while keeping rounding-zero on
// another.
const SPOKE_ICON_USD_MIN = 1;

export function buildSpokeCards(
  spokeGroups: SpokeGroup[],
  prices?: Record<string, PriceEntry | number>,
): AaveSpokeCardInfo[] {
  return spokeGroups.map((g) => {
    const peakSupplyUsd = g.result.reserves.reduce(
      (s, r) => s + r.peakSupply * (resolvePrice(r.symbol, prices) ?? 1),
      0,
    );
    const peakDebtUsd = g.result.reserves.reduce(
      (s, r) => s + r.peakDebt * (resolvePrice(r.symbol, prices) ?? 1),
      0,
    );
    const liveSupplying = g.result.reserves
      .map((r) => ({ symbol: r.symbol, usd: Math.max(0, r.supplied - r.withdrawn) * (resolvePrice(r.symbol, prices) ?? 1) }))
      .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
      .sort((a, b) => b.usd - a.usd)
      .map((r) => r.symbol);
    const liveBorrowing = g.result.reserves
      .map((r) => ({ symbol: r.symbol, usd: Math.max(0, r.borrowed - r.repaid) * (resolvePrice(r.symbol, prices) ?? 1) }))
      .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
      .sort((a, b) => b.usd - a.usd)
      .map((r) => r.symbol);
    const supplyingSymbols = liveSupplying.length > 0
      ? liveSupplying
      : g.result.reserves
          .map((r) => ({ symbol: r.symbol, usd: r.peakSupply * (resolvePrice(r.symbol, prices) ?? 1) }))
          .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
          .sort((a, b) => b.usd - a.usd)
          .map((r) => r.symbol);
    const borrowingSymbols = liveBorrowing.length > 0
      ? liveBorrowing
      : g.result.reserves
          .map((r) => ({ symbol: r.symbol, usd: r.peakDebt * (resolvePrice(r.symbol, prices) ?? 1) }))
          .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
          .sort((a, b) => b.usd - a.usd)
          .map((r) => r.symbol);

    let spokeBorrowRate: number | null = null;
    for (const e of [...g.events].reverse()) {
      if (!isAaveV4Event(e)) continue;
      const ctx = e.context.data;
      if (ctx.borrowAPR) {
        spokeBorrowRate = parseFloat(ctx.borrowAPR) * 100;
        break;
      }
    }

    const latestSupplyAprBySym = new Map<string, number>();
    const latestBorrowAprBySym = new Map<string, number>();
    for (const e of [...g.events].reverse()) {
      if (!isAaveV4Event(e)) continue;
      const ctx = e.context.data;
      const sym = ctx.reserveSymbol;
      if (!sym) continue;
      if (ctx.supplyAPR && !latestSupplyAprBySym.has(sym)) {
        latestSupplyAprBySym.set(sym, parseFloat(ctx.supplyAPR));
      }
      if (ctx.borrowAPR && !latestBorrowAprBySym.has(sym)) {
        latestBorrowAprBySym.set(sym, parseFloat(ctx.borrowAPR));
      }
    }

    const simSupplies = g.result.reserves
      .map((r) => {
        const netSupply = Math.max(0, r.supplied - r.withdrawn);
        if (netSupply <= 0.0001) return null;
        const price = resolvePrice(r.symbol, prices) ?? 1;
        const lt = getLiquidationThreshold(g.name, r.symbol);
        const collateralEnabled = r.collateralEnabled ?? true;
        return { symbol: r.symbol, amount: netSupply, price, lt, collateralEnabled };
      })
      .filter(Boolean) as { symbol: string; amount: number; price: number; lt: number; collateralEnabled: boolean }[];
    const simDebts = g.result.reserves
      .map((r) => {
        const netDebt = Math.max(0, r.borrowed - r.repaid);
        if (netDebt <= 0.0001) return null;
        const price = resolvePrice(r.symbol, prices) ?? 1;
        return { symbol: r.symbol, amount: netDebt, price };
      })
      .filter(Boolean) as { symbol: string; amount: number; price: number }[];

    const simResult = simulateAaveV4Position({ supplies: simSupplies, debts: simDebts });

    let liqPrice: AaveSpokeCardInfo["liqPrice"] = null;
    if (simResult.totalDebtUsd > 0 && simSupplies.length > 0) {
      const dominant = [...simSupplies].sort((a, b) => b.amount * b.price - a.amount * a.price)[0];
      const liq = simResult.assetLiqPrices.find((a) => a.symbol === dominant.symbol);
      if (liq && liq.liqPrice != null && liq.liqPrice > 0 && liq.headroomPct != null) {
        liqPrice = {
          symbol: liq.symbol,
          currentPrice: liq.currentPrice,
          liqPrice: liq.liqPrice,
          headroomPct: liq.headroomPct,
        };
      }
    }

    let netApy: number | null = null;
    let supplyYieldUsd = 0;
    let yieldKnownUsd = 0;
    for (const s of simSupplies) {
      if (!s.collateralEnabled) continue;
      const apr = latestSupplyAprBySym.get(s.symbol);
      const usd = s.amount * s.price;
      if (apr != null) {
        supplyYieldUsd += usd * apr;
        yieldKnownUsd += usd;
      }
    }
    let borrowCostUsd = 0;
    let costKnownUsd = 0;
    for (const d of simDebts) {
      const apr = latestBorrowAprBySym.get(d.symbol);
      const usd = d.amount * d.price;
      if (apr != null) {
        borrowCostUsd += usd * apr;
        costKnownUsd += usd;
      }
    }
    const totalSupplyUsd = simResult.totalCollateralUsd;
    const totalDebtUsd = simResult.totalDebtUsd;
    const equityUsd = totalSupplyUsd - totalDebtUsd;
    const supplyCovered = totalSupplyUsd <= 0 || yieldKnownUsd / totalSupplyUsd > 0.5;
    const borrowCovered = totalDebtUsd <= 0 || costKnownUsd / totalDebtUsd > 0.5;
    if (equityUsd > 0.0001 && supplyCovered && borrowCovered) {
      netApy = ((supplyYieldUsd - borrowCostUsd) / equityUsd) * 100;
    }

    const usdBySym = new Map<string, number>();
    for (const s of simSupplies) usdBySym.set(s.symbol, s.amount * s.price);
    const assetLiqPrices = simResult.assetLiqPrices
      .map((a) => ({
        symbol: a.symbol,
        currentPrice: a.currentPrice,
        liqPrice: a.liqPrice,
        headroomPct: a.headroomPct,
        usdShare: usdBySym.get(a.symbol) ?? 0,
      }))
      .sort((a, b) => b.usdShare - a.usdShare);

    const wasLiquidated = g.result.reserves.some((r) => r.liquidationCount > 0);

    return {
      name: g.name,
      hub: g.hub,
      totalSupplyUsd: g.totalSupplyUsd,
      totalDebtUsd: g.totalDebtUsd,
      peakSupplyUsd,
      peakDebtUsd,
      collRatio: g.collRatio,
      isClosed: g.isClosed,
      eventCount: g.eventCount,
      supplyingSymbols,
      borrowingSymbols,
      latestBorrowRate: spokeBorrowRate,
      healthFactor: simResult.healthFactor,
      liqPrice,
      assetLiqPrices,
      borrowingPowerUsd: simResult.borrowCapacityUsd,
      netApy,
      wasLiquidated,
    };
  });
}

export function buildAaveV4SpokeCards(
  events: BaseActivityEvent[],
  eventIndexMap: Map<string, number> | undefined,
  prices: Record<string, PriceEntry | number> | undefined,
): AaveSpokeCardInfo[] {
  const groups = groupBySpoke(events, eventIndexMap, prices);
  return buildSpokeCards(groups, prices);
}
