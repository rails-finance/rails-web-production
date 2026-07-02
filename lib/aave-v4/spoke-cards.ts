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
import {
  simulateAaveV4Position,
  computeSupplyBreakdown,
  type SupplyBreakdown,
  type BreakdownAsset,
} from "@/lib/aave-v4/utils/simulate";
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
  /** Hub (Core / Plus / Prime) this reserve draws from. A spoke can list the
   *  same asset under two reserve_ids — one per hub — so `symbol` alone is not
   *  a unique key; reserves are aggregated by (symbol, hub). Undefined on
   *  events whose hub wasn't indexed (older data) or on liquidation collateral
   *  rows (the event carries only the debt-side hub). */
  hub?: AaveV4Context["hub"];
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
  /** Lifetime OUTFLOW value in USD at PRICE-AT-THE-TIME — each event valued at
   *  its own block price (ctx.price / ctx.debtPrice / ctx.collateralPrice, from
   *  the MV's at-or-before historic price). The inflow "Deposited/Borrowed (all
   *  time)" totals are derived downstream as current holding + these outflows, so
   *  a settled position's flow totals stay fixed while Deposited − Withdrawn = In
   *  Protocol still reconciles. A reserve with no historic price contributes 0
   *  (omitted, per the pure-truth omission rule — never a live-price guess). */
  withdrawnUsd: number;
  repaidUsd: number;
  liquidatedDebtUsd: number;
  liquidatedCollateralUsd: number;
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
  /** Distinct non-liquidation transaction count (COUNT DISTINCT txHash over
   *  owner-driven events). The Liquity-faithful "transactions" metric the card
   *  surfaces: unlike raw `eventCount` it isn't inflated by the supply+enable
   *  merge (two event rows, one tx, one timeline card) and it matches the
   *  timeline's per-tx "X OF Y" grouping. Liquidations are excluded — they're a
   *  liquidator's transaction, shown separately on the liquidation triangle. */
  txCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
  /** Largest the spoke's combined collateral ever was at a SINGLE moment, in
   *  USD at PRICE-AT-THE-TIME — the running token balances across all reserves,
   *  summed and each valued at its event-block historic price, maxed over the
   *  timeline. This is a real high-water mark: unlike Σ(per-asset peak) it never
   *  exceeds a value the portfolio actually held, since per-asset peaks can occur
   *  at different times (and would sum to a moment that never existed). Valued at
   *  the money of its era rather than today's market; event-derived history —
   *  chain truth deliberately doesn't recompute it. */
  peakSupplyUsd: number;
  /** Peak combined debt at a single moment, in USD at price-at-the-time. See
   *  `peakSupplyUsd`. */
  peakDebtUsd: number;
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
  txCount: number;
}

export interface AaveSpokeCardInfo {
  name: string;
  hub: HubTier;
  totalSupplyUsd: number;
  /** Collateral value after each asset is weighted by its liquidation threshold
   *  — the portion that actually backs borrowing and the health factor (Σ
   *  coll×price×LT). Always ≤ totalSupplyUsd; the gap is the LT haircut. Other
   *  dashboards label THIS figure "Collateral"; Rails' headline "Collateral"
   *  shows the gross totalSupplyUsd, so the explanation panel states both. */
  weightedCollateralUsd: number;
  /** Collateral-only blended liquidation threshold — Σ(collateralUsd × lt) /
   *  Σ(collateralUsd) over collateral-enabled reserves, on the chain-truth
   *  balance basis. Computed with the IDENTICAL formula `describeCollateral
   *  Exposure` uses (lib/aave-v4/position-exposure), so the exposure sentence
   *  ("…% blended liquidation threshold") and the position-explanation panel
   *  ("each asset counts only up to its liquidation threshold, ~…%") state the
   *  same number rather than two same-looking-but-differently-derived figures.
   *  null when there's no priced collateral. */
  blendedLt: number | null;
  totalDebtUsd: number;
  peakSupplyUsd: number;
  peakDebtUsd: number;
  collRatio: number | null;
  isClosed: boolean;
  eventCount: number;
  /** Distinct non-liquidation transaction count — see AaveEconomicsResult.txCount.
   *  This is what the card's activity tally renders (the "transactions" metric),
   *  matching Liquity's transactionCount and the timeline's per-tx grouping. */
  txCount: number;
  supplyingSymbols: BreakdownAsset[];
  borrowingSymbols: BreakdownAsset[];
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
   *  a red liquidation indicator alongside the status pill — the position may
   *  still be active afterwards, but the history is permanent. */
  wasLiquidated: boolean;
  /** Lifetime count of liquidation events on this spoke (summed across
   *  reserves). Drives the red triangle + count indicator; >0 ⟺ wasLiquidated.
   *  Aave positions can be partially liquidated repeatedly, so the count is
   *  meaningful — mirrors Liquity's redemption-count indicator (different tier:
   *  red critical here, orange caution there). */
  liquidationCount: number;
  /** Supplies split into collateral-enabled vs not. The headline "Collateral"
   *  uses `collateralUsd`; non-collateral supplies are shown separately and never
   *  counted as collateral (they can't be seized and don't move HF). */
  supplyBreakdown: SupplyBreakdown;
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
  /** Hub the reserve draws from (Core/Plus/Prime). The same asset borrowed from
   *  two hubs is two reserves with independent carry, so `symbol` alone doesn't
   *  identify the row — callers disambiguate with the hub. Undefined when the
   *  reserve's hub wasn't indexed. */
  hub?: AaveV4Context["hub"];
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
  /** True when the position holds a chain-truth balance whose principal isn't in
   *  the event record — a position opened via a swap aggregator / transfer-in
   *  (CowSwap / 1inch / Pendle) that skipped the standard Supply/Borrow event.
   *  Interest can't be computed for that leg; the UI surfaces a one-line reason
   *  rather than a confusing blank. May be true alongside hasData (a position
   *  that's partly aggregator-opened, partly indexed). */
  unattributed: boolean;
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
  let unattributed = false;

  for (const r of reserves) {
    const price = resolvePrice(r.symbol, prices) ?? 0;

    const netSupplyPrincipal = r.supplied - r.withdrawn - r.liquidatedCollateral;
    const netBorrowPrincipal = r.borrowed - r.repaid - r.liquidatedDebt;

    const supplyInterest = legInterest(r.currentSupplied, netSupplyPrincipal, r.supplied);
    const borrowInterest = legInterest(r.currentBorrowed, netBorrowPrincipal, r.borrowed);

    // Aggregator / transfer-in open: a chain-truth balance exists on a leg but
    // we indexed no deposit/borrow for it, so its principal — and thus its
    // interest — is unknowable. Flag the clear-cut case (zero indexed principal,
    // non-dust balance) so the UI can explain the gap.
    if (r.currentSupplied != null && r.currentSupplied > INTEREST_DUST_TOKENS && r.supplied <= INTEREST_DUST_TOKENS) {
      unattributed = true;
    }
    if (r.currentBorrowed != null && r.currentBorrowed > INTEREST_DUST_TOKENS && r.borrowed <= INTEREST_DUST_TOKENS) {
      unattributed = true;
    }

    if (supplyInterest === 0 && borrowInterest === 0) continue;

    const supplyInterestUsd = supplyInterest * price;
    const borrowInterestUsd = borrowInterest * price;
    netUsd += supplyInterestUsd - borrowInterestUsd;
    if (price > 0) hasData = true;

    assets.push({ symbol: r.symbol, hub: r.hub, supplyInterest, borrowInterest, supplyInterestUsd, borrowInterestUsd });
  }

  // Nothing reliable to show and no gap to explain → let callers render nothing.
  if (assets.length === 0 && !unattributed) return null;
  return { assets, netUsd, hasData, unattributed };
}

// ---- Guard ----

function isAaveV4Event(
  e: BaseActivityEvent,
): e is BaseActivityEvent & { context: { protocol: "aave-v4"; data: AaveV4Context } } {
  return e.context?.protocol === "aave-v4" && !!e.context?.data;
}

// ---- Calculation ----

/** Composite reserve key. The same asset can be drawn from two hubs in one
 *  spoke (distinct reserves, independent balances), so (symbol, hub) — not
 *  symbol alone — uniquely identifies a reserve. Hub-less events (older data)
 *  fall back to symbol, preserving the previous collapse behaviour. */
function reserveKey(symbol: string, hub: AaveV4Context["hub"]): string {
  return hub ? `${symbol} ${hub}` : symbol;
}

/** First reserve in the map matching `symbol` regardless of hub. Used for the
 *  liquidation collateral side, which carries no hub on the event — so a
 *  seizure reuses the entry the asset's supply events already created (which
 *  do carry a hub) instead of spawning a hub-less duplicate row. */
function findReserveBySymbol(map: Map<string, ReserveStats>, symbol: string): ReserveStats | undefined {
  for (const s of map.values()) if (s.symbol === symbol) return s;
  return undefined;
}

export function calculateAaveEconomics(
  events: BaseActivityEvent[],
  eventIndexMap?: Map<string, number>,
  prices?: Record<string, PriceEntry | number>,
): AaveEconomicsResult | null {
  const aaveEvents = events.filter(isAaveV4Event);
  if (aaveEvents.length === 0) return null;

  const sorted = [...aaveEvents].sort((a, b) => a.timestamp - b.timestamp);

  // Distinct owner transactions: count unique txHashes excluding liquidations
  // (a liquidator's tx, surfaced on the triangle, not the owner's activity).
  // Counting transactions — not raw event rows — makes the tally immune to the
  // supply+enable merge (two rows, one tx, one card) and aligns it with the
  // timeline's per-tx "X OF Y" grouping. Fall back to event id when a row has
  // no txHash so it still counts once.
  const txSet = new Set<string>();
  for (const e of aaveEvents) {
    if (e.context.data.eventType === "liquidation") continue;
    txSet.add(e.txHash ?? e.id);
  }

  // Reserves are aggregated by (symbol, hub): the same asset can be borrowed
  // from two hubs in one spoke (e.g. USDT from Prime AND Core), and those are
  // distinct on-chain reserves with independent balances. Keying by symbol
  // alone would merge them into one (wrong) row. The map key is this composite;
  // `symbol`/`hub` are carried on the value for display and price lookup.
  const reserveMap = new Map<string, ReserveStats>();
  let totalGasCostEth = 0;
  let totalGasCostUsd = 0;

  const runningDebt = new Map<string, number>();
  const runningSupply = new Map<string, number>();
  // Per-symbol price at that reserve's most-recent event ("price-at-the-time").
  // Populated from the historic price plumbed on each event's context
  // (ctx.price / ctx.collateralPrice / ctx.debtPrice, sourced from the MV's
  // at-or-before lookup). The peaks and lifetime outflows below are valued from
  // this map so a settled record stays fixed in the money of its era. Keyed by
  // display symbol (price is a per-asset fact — hub doesn't change it), matching
  // the peak loop's `resolvePrice(st.symbol, …)` lookup.
  const reservePrice = new Map<string, number>();
  // Portfolio-wide high-water marks: the largest the SUMMED running balances
  // (priced at the time — see reservePrice) ever reached at a single moment.
  // Tracked across the whole timeline rather than per-reserve so two assets that
  // peaked at different times don't add up to a portfolio value that never existed.
  let peakSupplyUsd = 0;
  let peakDebtUsd = 0;
  let fallbackSeq = 0;

  for (const event of sorted) {
    const ctx = event.context.data;
    const amount = parseFloat(ctx.amount ?? "0");
    const symbol = ctx.reserveSymbol ?? "?";
    const hub = ctx.hub;
    const key = reserveKey(symbol, hub);
    fallbackSeq++;
    const eventSeq = eventIndexMap?.get(event.id) ?? fallbackSeq;

    // Capture the moved asset's price at THIS event's block. Non-liquidation
    // rows carry it on ctx.price; liquidation rows carry ctx.collateralPrice /
    // ctx.debtPrice and are handled in the liquidation case below.
    const movedPrice = ctx.price?.usd;
    if (movedPrice != null && movedPrice > 0) reservePrice.set(symbol, movedPrice);
    // Price for the moved asset AT THIS event, used to value lifetime outflows at
    // price-at-the-time. Prefer this event's historic price, else the reserve's
    // most-recent historic price. NO current-price fallback — per the pure-truth
    // omission rule a historic figure must not be back-filled with a live-market
    // guess; an unpriceable event contributes 0 (omitted).
    const priceNow = movedPrice ?? reservePrice.get(symbol) ?? 0;

    if (event.gas) {
      totalGasCostEth += event.gas.gasCostEth || 0;
      totalGasCostUsd += event.gas.gasCostUsd || 0;
    }

    let stats = reserveMap.get(key);
    if (!stats) {
      stats = {
        symbol,
        hub,
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
        withdrawnUsd: 0,
        repaidUsd: 0,
        liquidatedDebtUsd: 0,
        liquidatedCollateralUsd: 0,
      };
      reserveMap.set(key, stats);
      runningDebt.set(key, 0);
      runningSupply.set(key, 0);
    }
    stats.eventCount++;

    switch (ctx.eventType) {
      case "supply": {
        stats.supplied += amount;
        const supply = (runningSupply.get(key) ?? 0) + amount;
        runningSupply.set(key, supply);
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
        stats.withdrawnUsd += amount * priceNow;
        runningSupply.set(key, Math.max(0, (runningSupply.get(key) ?? 0) - amount));
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
        runningDebt.set(key, (runningDebt.get(key) ?? 0) + amount);
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
        stats.repaidUsd += amount * priceNow;
        runningDebt.set(key, (runningDebt.get(key) ?? 0) - amount);
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
        // Price-at-the-time for the debt leg (ctx.price is null on liquidation rows).
        if (ctx.debtPrice?.usd != null && ctx.debtPrice.usd > 0) reservePrice.set(symbol, ctx.debtPrice.usd);

        stats.liquidatedDebt += debtCovered;
        stats.liquidatedDebtUsd +=
          debtCovered * (ctx.debtPrice?.usd != null && ctx.debtPrice.usd > 0 ? ctx.debtPrice.usd : priceNow);
        stats.liquidationCount++;
        runningDebt.set(key, (runningDebt.get(key) ?? 0) - debtCovered);
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
            // The event carries no hub for the collateral side, so reuse the
            // entry the asset's supply events created (which do carry a hub)
            // rather than spawning a hub-less duplicate. Only create a fresh
            // (hub-less) row when the collateral was never supplied in-window.
            let cs = findReserveBySymbol(reserveMap, collSym);
            if (!cs) {
              cs = {
                symbol: collSym,
                hub: undefined,
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
                withdrawnUsd: 0,
                repaidUsd: 0,
                liquidatedDebtUsd: 0,
                liquidatedCollateralUsd: 0,
              };
              reserveMap.set(reserveKey(collSym, undefined), cs);
              runningDebt.set(reserveKey(collSym, undefined), 0);
              runningSupply.set(reserveKey(collSym, undefined), 0);
            }
            collStats = cs;
          }
          const collKey = reserveKey(collStats.symbol, collStats.hub);
          // Price-at-the-time for the seized collateral leg.
          if (ctx.collateralPrice?.usd != null && ctx.collateralPrice.usd > 0)
            reservePrice.set(collStats.symbol, ctx.collateralPrice.usd);
          collStats.liquidatedCollateral += collSeized;
          collStats.liquidatedCollateralUsd +=
            collSeized *
            (ctx.collateralPrice?.usd != null && ctx.collateralPrice.usd > 0
              ? ctx.collateralPrice.usd
              : (reservePrice.get(collStats.symbol) ?? 0));
          runningSupply.set(collKey, Math.max(0, (runningSupply.get(collKey) ?? 0) - collSeized));
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
      const debt = Math.max(0, runningDebt.get(key) ?? 0);
      stats.debtSeries.push({ timestamp: event.timestamp, debt, eventIndex: eventSeq });
      if (debt > stats.peakDebt) {
        stats.peakDebt = debt;
        stats.peakDebtTimestamp = event.timestamp;
      }
    }

    // Portfolio-wide high-water marks. Recompute the priced sum across all
    // reserves after each event (reserve counts are tiny) and keep the max —
    // this is a true single-instant peak, not a sum of per-asset peaks.
    // Iterate reserveMap (not the composite-keyed running maps) so price
    // resolves by the reserve's symbol, not the "symbol hub" key. Each reserve is
    // valued at its price-at-the-time (reservePrice); a reserve with no historic
    // price contributes 0 (omitted, not valued at a live price) per the pure-truth
    // omission rule.
    const priceFor = (sym: string): number => reservePrice.get(sym) ?? 0;
    let supplyUsdNow = 0;
    for (const [k, st] of reserveMap)
      supplyUsdNow += Math.max(0, runningSupply.get(k) ?? 0) * priceFor(st.symbol);
    if (supplyUsdNow > peakSupplyUsd) peakSupplyUsd = supplyUsdNow;
    let debtUsdNow = 0;
    for (const [k, st] of reserveMap)
      debtUsdNow += Math.max(0, runningDebt.get(k) ?? 0) * priceFor(st.symbol);
    if (debtUsdNow > peakDebtUsd) peakDebtUsd = debtUsdNow;
  }

  return {
    reserves: [...reserveMap.values()],
    totalGasCostEth,
    totalGasCostUsd,
    eventCount: aaveEvents.length,
    txCount: txSet.size,
    firstTimestamp: sorted[0].timestamp,
    lastTimestamp: sorted[sorted.length - 1].timestamp,
    peakSupplyUsd,
    peakDebtUsd,
  };
}

/**
 * Harden a set of reserves for the no-chain-truth fallback (chain RPC overlay
 * failed → `chainStale`, or the chain fetch was skipped/errored → no
 * chainPosition at all). In that path the only collateral signal is the
 * indexed `collateral_toggle` events that set `collateralEnabled`. Aave V4
 * makes collateral an explicit opt-in that emits a toggle event, so a supplied
 * reserve we never saw an enable-toggle for (`collateralEnabled === undefined`)
 * is resolved to NOT collateral rather than assumed-enabled.
 *
 * This keeps the fallback HF / borrowing-power / liq-price from crediting
 * collateral we can't confirm — the conservative direction for a risk read.
 * Reserves carrying an explicit enable/disable toggle keep that observed value.
 *
 * Only the fallback uses this: when chain truth is available, the patch path
 * overwrites `collateralEnabled` with the on-chain `isCollateral` flag, which
 * is authoritative.
 */
export function resolveFallbackCollateral(reserves: ReserveStats[]): ReserveStats[] {
  return reserves.map((r) => ({ ...r, collateralEnabled: r.collateralEnabled ?? false }));
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
    const result = calculateAaveEconomics(spokeEvents, eventIndexMap, prices);
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
      txCount: result.txCount,
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
    // Portfolio-wide single-instant high-water marks (computed in
    // calculateAaveEconomics over the running balances) — NOT a sum of per-asset
    // peaks, which would overstate by combining peaks from different moments.
    const peakSupplyUsd = g.result.peakSupplyUsd;
    const peakDebtUsd = g.result.peakDebtUsd;
    const liveSupplying: BreakdownAsset[] = g.result.reserves
      .map((r) => ({
        symbol: r.symbol,
        hub: r.hub,
        usd: Math.max(0, r.supplied - r.withdrawn) * (resolvePrice(r.symbol, prices) ?? 1),
      }))
      .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
      .sort((a, b) => b.usd - a.usd)
      .map((r) => ({ symbol: r.symbol, hub: r.hub }));
    const liveBorrowing: BreakdownAsset[] = g.result.reserves
      .map((r) => ({
        symbol: r.symbol,
        hub: r.hub,
        usd: Math.max(0, r.borrowed - r.repaid) * (resolvePrice(r.symbol, prices) ?? 1),
      }))
      .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
      .sort((a, b) => b.usd - a.usd)
      .map((r) => ({ symbol: r.symbol, hub: r.hub }));
    const supplyingSymbols: BreakdownAsset[] =
      liveSupplying.length > 0
        ? liveSupplying
        : g.result.reserves
            .map((r) => ({ symbol: r.symbol, hub: r.hub, usd: r.peakSupply * (resolvePrice(r.symbol, prices) ?? 1) }))
            .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
            .sort((a, b) => b.usd - a.usd)
            .map((r) => ({ symbol: r.symbol, hub: r.hub }));
    const borrowingSymbols: BreakdownAsset[] =
      liveBorrowing.length > 0
        ? liveBorrowing
        : g.result.reserves
            .map((r) => ({ symbol: r.symbol, hub: r.hub, usd: r.peakDebt * (resolvePrice(r.symbol, prices) ?? 1) }))
            .filter((r) => r.usd > SPOKE_ICON_USD_MIN)
            .sort((a, b) => b.usd - a.usd)
            .map((r) => ({ symbol: r.symbol, hub: r.hub }));

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
        return { symbol: r.symbol, hub: r.hub, amount: netSupply, price, lt, collateralEnabled };
      })
      .filter(Boolean) as {
      symbol: string;
      hub?: AaveV4Context["hub"];
      amount: number;
      price: number;
      lt: number;
      collateralEnabled: boolean;
    }[];
    const simDebts = g.result.reserves
      .map((r) => {
        const netDebt = Math.max(0, r.borrowed - r.repaid);
        if (netDebt <= 0.0001) return null;
        const price = resolvePrice(r.symbol, prices) ?? 1;
        return { symbol: r.symbol, hub: r.hub, amount: netDebt, price };
      })
      .filter(Boolean) as { symbol: string; hub?: AaveV4Context["hub"]; amount: number; price: number }[];

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

    const liquidationCount = g.result.reserves.reduce((n, r) => n + r.liquidationCount, 0);
    const wasLiquidated = liquidationCount > 0;

    // Collateral-only blended LT on the chain-truth basis — same formula as the
    // exposure sentence (describeCollateralExposure) so the two readouts agree.
    // Σ(collateralUsd × lt) / Σ(collateralUsd) over collateral-enabled reserves,
    // using currentSupplied when chain-patched and the same net-supply fallback
    // and LT-fallback the exposure component uses.
    let collValueUsd = 0;
    let collWeightedLtUsd = 0;
    for (const r of g.result.reserves) {
      if (!(r.collateralEnabled ?? true)) continue;
      const amount = r.currentSupplied ?? Math.max(0, r.supplied - r.withdrawn - r.liquidatedCollateral);
      if (amount <= 0) continue;
      const usd = amount * (resolvePrice(r.symbol, prices) ?? 1);
      collValueUsd += usd;
      collWeightedLtUsd += usd * (r.lt ?? AAVE_V4_FALLBACK_LT);
    }
    const blendedLt = collValueUsd > 0 ? collWeightedLtUsd / collValueUsd : null;

    return {
      name: g.name,
      hub: g.hub,
      totalSupplyUsd: g.totalSupplyUsd,
      weightedCollateralUsd: simResult.weightedCollateralUsd,
      blendedLt,
      totalDebtUsd: g.totalDebtUsd,
      peakSupplyUsd,
      peakDebtUsd,
      collRatio: g.collRatio,
      isClosed: g.isClosed,
      eventCount: g.eventCount,
      txCount: g.txCount,
      supplyingSymbols,
      borrowingSymbols,
      latestBorrowRate: spokeBorrowRate,
      healthFactor: simResult.healthFactor,
      liqPrice,
      assetLiqPrices,
      borrowingPowerUsd: simResult.borrowCapacityUsd,
      wasLiquidated,
      liquidationCount,
      supplyBreakdown: computeSupplyBreakdown(simSupplies),
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

export interface LiquidationBuffer {
  /** Uniform collateral drop, as a %, that takes the spoke to a 1.0 health
   *  factor: `1 − 1/HF`. null when there's no debt / no HF. */
  dropPct: number | null;
  /** HF ≤ 1 — already liquidatable. */
  liquidatable: boolean;
  /** Present only when collateral is a SINGLE asset, where the buffer pins to a
   *  concrete liquidation price. Derived chain-truth from HF (`currentPrice /
   *  HF`) — no LT table — so it can't disagree with the health factor. */
  single: { symbol: string; currentPrice: number; liqPrice: number } | null;
}

/**
 * The one coherent liquidation read for an Aave V4 spoke, derived from the
 * chain health factor — used by the position card's stat, the liquidation
 * runway, and the explanation prose so all three tell the same story.
 *
 * Health factor is Aave's own liquidation trigger (liquidates at 1.0), so the
 * universal headroom is the uniform collateral drop that reaches it: `1 − 1/HF`.
 *
 * Mode is set by how many assets are ENABLED AS COLLATERAL — the only assets a
 * liquidation can seize, and the only ones that move the health factor:
 *   • exactly one → `single` is set: we surface that asset's concrete liquidation
 *     PRICE (clearer than a %). Derived chain-truth as `currentPrice / HF` — no LT
 *     table — so it can't disagree with the health factor. This also covers a
 *     position with one collateral asset plus other plain (non-collateral)
 *     supplies, since those don't back the loan or affect liquidation.
 *   • two or more → `single` is null: we show the `1 − 1/HF` percentage instead,
 *     because a single asset's solo liq price holds the others fixed and so
 *     systematically OVERSTATES safety for a correlated basket.
 *
 * Collateral-enabled is read off `assetLiqPrices`: a non-collateral supply has a
 * null `liqPrice` (the simulator returns null for assets that don't back debt).
 */
export function liquidationBuffer(spoke: AaveSpokeCardInfo): LiquidationBuffer {
  return liquidationBufferFrom(spoke.healthFactor, spoke.totalDebtUsd, spoke.assetLiqPrices);
}

/**
 * Primitive form of {@link liquidationBuffer} over the minimal inputs, so the
 * listing card (which holds a raw simulator result, not an AaveSpokeCardInfo)
 * gets identical behaviour. `assetLiqPrices` entries with a non-null `liqPrice`
 * are the collateral-enabled assets.
 */
export function liquidationBufferFrom(
  healthFactor: number | null,
  totalDebtUsd: number,
  assetLiqPrices: { symbol: string; currentPrice: number; liqPrice: number | null }[],
): LiquidationBuffer {
  if (healthFactor == null || totalDebtUsd <= 0) return { dropPct: null, liquidatable: false, single: null };
  if (healthFactor <= 1) return { dropPct: 0, liquidatable: true, single: null };

  const dropPct = (1 - 1 / healthFactor) * 100;
  const collateral = assetLiqPrices.filter((a) => a.liqPrice != null && a.currentPrice > 0);
  let single: LiquidationBuffer["single"] = null;
  if (collateral.length === 1) {
    const a = collateral[0];
    single = { symbol: a.symbol, currentPrice: a.currentPrice, liqPrice: a.currentPrice / healthFactor };
  }
  return { dropPct, liquidatable: false, single };
}
