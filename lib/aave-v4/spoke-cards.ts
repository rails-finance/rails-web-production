// Pure-logic helpers for building Aave V4 spoke selector cards. Adapted from
// rails-explorer's lib/aave/spoke-cards.ts — web-mig only ships aave-v4 (no
// aave-v3 / spark surface yet), so the multi-protocol guard collapses to an
// aave-v4 check, the AaveContext import becomes AaveV4Context, and the event
// type uses BaseActivityEvent's shape.
//
// Crucially, the risk datapoints here (HF, liq price, borrowing power,
// dominant-asset headroom %) derive from the events the API already returns
// plus the static LT lookup table — no on-chain reads are needed. Interest
// carry (computeAaveV4InterestPnl) additionally consumes chain-truth balances.

import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import type { AaveV4Context } from "@/lib/shared/types/protocols/aave-v4";
import { type PriceEntry, resolvePrice } from "@/lib/aave/prices";
import { SPOKE_HUB, type HubTier } from "@/components/protocol/aave-v4/aave-v4-spoke-constants";
import { AAVE_V4_FALLBACK_LT } from "@/lib/aave-v4/liquidation-thresholds";
import { simulateAaveV4Position } from "@/lib/aave-v4/utils/simulate";
import { effectiveBorrowAPR } from "@/lib/aave-v4/borrow-rate";

// ---- Types ----

interface DebtPoint {
  timestamp: number;
  debt: number;
  eventIndex: number;
}
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
  /** Chain-truth liquidation threshold for this (spoke, reserve), when an
   *  on-chain read has been applied (see `patchReservesWithChain`). Undefined
   *  on purely event-derived reserves — the simulator then falls back to
   *  `AAVE_V4_FALLBACK_LT`. */
  lt?: number;
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
  assetLiqPrices: {
    symbol: string;
    address?: string;
    currentPrice: number;
    liqPrice: number | null;
    headroomPct: number | null;
    usdShare: number;
  }[];
  /** Remaining USD that can be borrowed before HF=1. */
  borrowingPowerUsd: number;
  /** True when the wallet has ever been liquidated on this spoke. Surfaces
   *  a red LIQUIDATED indicator alongside the status pill — the position may
   *  still be active afterwards, but the history is permanent. */
  wasLiquidated: boolean;
  /** Chain-faithful lifetime interest carry — supply interest earned minus
   *  borrow interest paid. Present only when chain-truth balances have been
   *  applied (see computeAaveV4InterestPnl); null otherwise. */
  interestPnl?: AaveV4InterestPnl | null;
}

/** Per-asset realized interest for the position, derived as
 *  `chain-truth current balance − net principal moved`. Token figures are
 *  exact (no rate needed); USD is the token figure at the current price. */
export interface AaveV4AssetInterest {
  symbol: string;
  /** Supply interest earned, in underlying tokens (≥ 0 in normal operation). */
  supplyInterest: number;
  /** Borrow interest paid, in underlying tokens (≥ 0 in normal operation). */
  borrowInterest: number;
  supplyInterestUsd: number;
  borrowInterestUsd: number;
}

export interface AaveV4InterestPnl {
  /** Assets with a non-dust, reliable interest figure on at least one leg. */
  assets: AaveV4AssetInterest[];
  /** Σ supplyInterestUsd − Σ borrowInterestUsd across reliable assets — the
   *  net carry ("Total Earnings" analogue). Negative = paid more than earned. */
  netUsd: number;
  /** True when at least one priced asset produced a usable figure. */
  hasData: boolean;
}

// Below this token threshold an interest leg is treated as zero — share-rounding
// and dust make sub-threshold figures meaningless. A leg more negative than this
// signals the event-derived principal is missing deposits/repays (indexer drift
// the chain-truth balance can't repair), so we drop that leg as unreliable
// rather than show a nonsensical "negative interest earned".
const INTEREST_DUST_TOKENS = 1e-9;

/**
 * Interest on one leg (supply or borrow) of a reserve, with reliability gates.
 * `interest = current − netPrincipal` is exact only when we saw every flow
 * event for the leg; the gates drop the cases where we provably didn't:
 *
 *  - `current == null` → no chain-truth balance, can't isolate interest.
 *  - `grossIn <= 0` → we never indexed any deposit/borrow here, yet a balance
 *    exists (aggregator-wrapped open — CowSwap/1inch/Pendle). Attributing the
 *    whole balance to "interest" would be nonsense, so bail. This is the common
 *    drift case chain-truth exists for.
 *  - `interest < dust` → zero, or negative because principal events are missing.
 *  - `interest > grossIn` → more "interest" than total principal ever moved in:
 *    physically implausible (would need >100% cumulative yield), so it's missed
 *    principal, not interest — drop. Legit exited positions (withdrew principal
 *    + a little interest) stay well under this bound.
 */
function legInterest(current: number | undefined, netPrincipal: number, grossIn: number): number {
  if (current == null || grossIn <= 0) return 0;
  const interest = current - netPrincipal;
  if (interest < INTEREST_DUST_TOKENS) return 0;
  if (interest > grossIn) return 0;
  return interest;
}

/**
 * Chain-faithful interest carry for a position, computed per reserve as
 * `current balance (chain-truth) − net principal (events)`:
 *
 *   supplyInterest = currentSupplied − (supplied − withdrawn − liquidatedCollateral)
 *   borrowInterest = currentBorrowed − (borrowed − repaid − liquidatedDebt)
 *
 * The token result is exact and needs no rate — it's literally "what you hold
 * now minus what you put in". USD is that token figure valued at the current
 * price (clearly a current-value view, not accrual-time). Requires reserves
 * that have been through `patchReservesWithChain` (so `currentSupplied` /
 * `currentBorrowed` are populated); without chain-truth it returns null.
 *
 * Caveat surfaced to callers via `hasData`: the principal legs are
 * event-derived, so a leg that comes out implausibly negative (missed
 * deposit/repay events) is dropped rather than shown.
 */
export function computeAaveV4InterestPnl(
  reserves: ReserveStats[],
  prices: Record<string, PriceEntry | number>,
): AaveV4InterestPnl | null {
  // No chain-truth applied → we can't separate interest from principal. Bail
  // so callers fall back to showing nothing rather than an event-only guess.
  const hasChainTruth = reserves.some((r) => r.currentSupplied != null || r.currentBorrowed != null);
  if (!hasChainTruth) return null;

  const assets: AaveV4AssetInterest[] = [];
  let netUsd = 0;
  let hasData = false;

  for (const r of reserves) {
    const price = resolvePrice(r.symbol, prices) ?? 0;

    const netSupplyPrincipal = r.supplied - r.withdrawn - r.liquidatedCollateral;
    const netBorrowPrincipal = r.borrowed - r.repaid - r.liquidatedDebt;

    const supplyInterest = legInterest(r.currentSupplied, netSupplyPrincipal, r.supplied);
    const borrowInterest = legInterest(r.currentBorrowed, netBorrowPrincipal, r.borrowed);

    if (supplyInterest === 0 && borrowInterest === 0) continue;

    const supplyInterestUsd = supplyInterest * price;
    const borrowInterestUsd = borrowInterest * price;
    netUsd += supplyInterestUsd - borrowInterestUsd;
    if (price > 0) hasData = true;

    assets.push({ symbol: r.symbol, supplyInterest, borrowInterest, supplyInterestUsd, borrowInterestUsd });
  }

  if (assets.length === 0) return null;
  return { assets, netUsd, hasData };
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
        symbol,
        supplied: 0,
        withdrawn: 0,
        borrowed: 0,
        repaid: 0,
        liquidatedDebt: 0,
        liquidatedCollateral: 0,
        liquidationCount: 0,
        eventCount: 0,
        debtSeries: [],
        peakDebt: 0,
        peakDebtTimestamp: 0,
        peakSupply: 0,
        flowEvents: [],
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
        if (amount > 0)
          stats.flowEvents.push({
            timestamp: event.timestamp,
            amount,
            side: "supply",
            direction: "in",
            label: "Supply",
            eventIndex: eventSeq,
          });
        break;
      }
      case "withdraw": {
        stats.withdrawn += amount;
        runningSupply.set(symbol, Math.max(0, (runningSupply.get(symbol) ?? 0) - amount));
        if (amount > 0)
          stats.flowEvents.push({
            timestamp: event.timestamp,
            amount,
            side: "supply",
            direction: "out",
            label: "Withdraw",
            eventIndex: eventSeq,
          });
        break;
      }
      case "borrow":
        stats.borrowed += amount;
        runningDebt.set(symbol, (runningDebt.get(symbol) ?? 0) + amount);
        if (amount > 0)
          stats.flowEvents.push({
            timestamp: event.timestamp,
            amount,
            side: "borrow",
            direction: "in",
            label: "Borrow",
            eventIndex: eventSeq,
          });
        break;
      case "repay":
        stats.repaid += amount;
        runningDebt.set(symbol, (runningDebt.get(symbol) ?? 0) - amount);
        if (amount > 0)
          stats.flowEvents.push({
            timestamp: event.timestamp,
            amount,
            side: "borrow",
            direction: "out",
            label: "Repay",
            eventIndex: eventSeq,
          });
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
        if (debtCovered > 0)
          stats.flowEvents.push({
            timestamp: event.timestamp,
            amount: debtCovered,
            side: "borrow",
            direction: "out",
            label: "Liquidate",
            eventIndex: eventSeq,
          });

        if (collSeized > 0) {
          // Collateral side lands on the seized asset's stats. When the
          // event omits collateralSymbol (older data), fall back to the
          // debt-side stats so the seizure isn't lost.
          let collStats = stats;
          if (collSym && collSym !== symbol) {
            let cs = reserveMap.get(collSym);
            if (!cs) {
              cs = {
                symbol: collSym,
                supplied: 0,
                withdrawn: 0,
                borrowed: 0,
                repaid: 0,
                liquidatedDebt: 0,
                liquidatedCollateral: 0,
                liquidationCount: 0,
                eventCount: 0,
                debtSeries: [],
                peakDebt: 0,
                peakDebtTimestamp: 0,
                peakSupply: 0,
                flowEvents: [],
              };
              reserveMap.set(collSym, cs);
              runningDebt.set(collSym, 0);
              runningSupply.set(collSym, 0);
            }
            collStats = cs;
          }
          collStats.liquidatedCollateral += collSeized;
          runningSupply.set(collStats.symbol, Math.max(0, (runningSupply.get(collStats.symbol) ?? 0) - collSeized));
          collStats.flowEvents.push({
            timestamp: event.timestamp,
            amount: collSeized,
            side: "supply",
            direction: "out",
            label: "Liquidate",
            eventIndex: eventSeq,
          });
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
    const peakDebtUsd = g.result.reserves.reduce((s, r) => s + r.peakDebt * (resolvePrice(r.symbol, prices) ?? 1), 0);
    const liveSupplying = g.result.reserves
      .map((r) => ({
        symbol: r.symbol,
        usd: Math.max(0, r.supplied - r.withdrawn) * (resolvePrice(r.symbol, prices) ?? 1),
      }))
      .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
      .sort((a, b) => b.usd - a.usd)
      .map((r) => r.symbol);
    const liveBorrowing = g.result.reserves
      .map((r) => ({
        symbol: r.symbol,
        usd: Math.max(0, r.borrowed - r.repaid) * (resolvePrice(r.symbol, prices) ?? 1),
      }))
      .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
      .sort((a, b) => b.usd - a.usd)
      .map((r) => r.symbol);
    const supplyingSymbols =
      liveSupplying.length > 0
        ? liveSupplying
        : g.result.reserves
            .map((r) => ({ symbol: r.symbol, usd: r.peakSupply * (resolvePrice(r.symbol, prices) ?? 1) }))
            .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
            .sort((a, b) => b.usd - a.usd)
            .map((r) => r.symbol);
    const borrowingSymbols =
      liveBorrowing.length > 0
        ? liveBorrowing
        : g.result.reserves
            .map((r) => ({ symbol: r.symbol, usd: r.peakDebt * (resolvePrice(r.symbol, prices) ?? 1) }))
            .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
            .sort((a, b) => b.usd - a.usd)
            .map((r) => r.symbol);

    // Most-recent borrow rate on this spoke — the true per-block on-chain rate
    // (effectiveBorrowAPR prefers allDebts[].borrowAPR, falls back to inferred).
    let spokeBorrowRate: number | null = null;
    for (const e of [...g.events].reverse()) {
      if (!isAaveV4Event(e)) continue;
      const apr = effectiveBorrowAPR(e.context.data);
      if (apr) {
        spokeBorrowRate = parseFloat(apr) * 100;
        break;
      }
    }

    const simSupplies = g.result.reserves
      .map((r) => {
        const netSupply = Math.max(0, r.supplied - r.withdrawn);
        if (netSupply <= 0.0001) return null;
        const price = resolvePrice(r.symbol, prices) ?? 1;
        // Chain-truth LT when the reserve has been chain-patched; otherwise the
        // conservative fallback (no per-spoke table any more — see liquidation-thresholds).
        const lt = r.lt ?? AAVE_V4_FALLBACK_LT;
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
