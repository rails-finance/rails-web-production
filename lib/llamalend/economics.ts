// LlamaLend economics aggregator.
//
// Walks an asc-sorted event timeline and computes per-asset bucket totals for
// the dual-tower chart on /llamalend/[wallet]. The shape mirrors what
// `LlamalendTowerChart` consumes:
//
//   collateral side: deposited / withdrawn / hard-liquidated / soft-liq
//                    (reserved, gated on B2) / current
//   debt side:       borrowed / repaid / debt-cleared (liq) / current
//
// Sign convention from `mv_llamalend_events.deltaCollateral` /
// `.deltaDebt` (set by the processor): positive = entering the position
// (deposit / borrow), negative = leaving (withdraw / repay).
//
// Liquidations contribute to dedicated buckets so the tower visually
// distinguishes "you withdrew this" from "this was seized". The
// per-event payload carries `debtCleared` / `collateralReceived` /
// `stablecoinReceived` on the borrower-side `liquidated` arm; the
// liquidator-side `liquidate` arm is for a different wallet's events
// so won't appear here.

import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isLlamalendEvent } from "@/lib/shared/types/event-shape";

export interface AssetBucket {
  symbol: string;
  /** Lifetime amount entering this side of the position. */
  inflow: number;
  /** Lifetime user-initiated outflow (withdraw / repay). */
  outflow: number;
  /** Lifetime hard-liquidation outflow (seized collateral / cleared debt). */
  liqOutflow: number;
  /** Lifetime soft-liquidation outflow — reserved-but-empty until B2 lands. */
  softLiqOutflow: number;
  /** Currently held in the position (from the latest event's after-balance). */
  current: number;
}

export interface LlamalendEconomics {
  collateral: AssetBucket[];
  debt: AssetBucket[];
}

interface Mutable {
  symbol: string;
  inflow: number;
  outflow: number;
  liqOutflow: number;
  softLiqOutflow: number;
  current: number;
}

function ensure(map: Map<string, Mutable>, symbol: string): Mutable {
  let row = map.get(symbol);
  if (!row) {
    row = { symbol, inflow: 0, outflow: 0, liqOutflow: 0, softLiqOutflow: 0, current: 0 };
    map.set(symbol, row);
  }
  return row;
}

export function buildLlamalendEconomics(events: BaseActivityEvent[]): LlamalendEconomics {
  const coll = new Map<string, Mutable>();
  const debt = new Map<string, Mutable>();

  // Events arrive in asc order; the last event for each (controller,
  // positionEpoch) lifecycle's collateralAfter / debtAfter is the current
  // residual on that lifecycle. Multiple lifecycles on the same asset add up.
  const lastByLifecycle = new Map<string, { collSym: string; debtSym: string; collAfter: number; debtAfter: number }>();

  for (const event of events) {
    if (!isLlamalendEvent(event)) continue;
    const ctx = event.context.data;
    const collSym = ctx.collateralSymbol;
    const debtSym = ctx.borrowedSymbol;
    if (!collSym || !debtSym) continue;

    const dColl = parseFloat(ctx.deltaCollateral ?? "0") || 0;
    const dDebt = parseFloat(ctx.deltaDebt ?? "0") || 0;

    const isLiquidated = ctx.eventType === "liquidated" || ctx.eventType === "liquidate";
    const isSoftLiq = ctx.eventType === "soft_liquidated";

    if (isLiquidated) {
      // Collateral seized: collateralBefore - collateralAfter - collateralReceived.
      // We don't have an explicit "seized" field on the wire, but the
      // borrower side's `collateralReceived` is what was returned to the
      // wallet, so seized = (collBefore - collAfter) - collateralReturned.
      // Use `Math.max(0, ...)` because in some edge cases (e.g. dust)
      // imprecision can yield a tiny negative.
      const collBefore = parseFloat(ctx.collateralBefore ?? "0") || 0;
      const collAfter = parseFloat(ctx.collateralAfter ?? "0") || 0;
      const returned = parseFloat(ctx.collateralReceived ?? "0") || 0;
      const seized = Math.max(0, collBefore - collAfter - returned);
      if (seized > 0) ensure(coll, collSym).liqOutflow += seized;
      if (returned > 0) ensure(coll, collSym).outflow += returned;

      const cleared = parseFloat(ctx.debtCleared ?? "0") || 0;
      if (cleared > 0) ensure(debt, debtSym).liqOutflow += cleared;
    } else if (isSoftLiq) {
      // B2 placeholder: soft-liq events synthesize collateral→debt swaps from
      // the indexer's LLAMMA exchange stream. Until B2 lands, the wire shape
      // carries no per-event amounts on soft_liquidated events. The bucket
      // stays empty here; the chart still renders a reserved row so the
      // user knows the bucket exists.
      void isSoftLiq;
    } else {
      if (dColl > 0) ensure(coll, collSym).inflow += dColl;
      else if (dColl < 0) ensure(coll, collSym).outflow += -dColl;
      if (dDebt > 0) ensure(debt, debtSym).inflow += dDebt;
      else if (dDebt < 0) ensure(debt, debtSym).outflow += -dDebt;
    }

    // Track the latest state per lifecycle so we can sum current across
    // open positions on the same asset pair.
    const key = `${ctx.controller}:${ctx.positionEpoch ?? 1}`;
    lastByLifecycle.set(key, {
      collSym,
      debtSym,
      collAfter: parseFloat(ctx.collateralAfter ?? "0") || 0,
      debtAfter: parseFloat(ctx.debtAfter ?? "0") || 0,
    });
  }

  // Roll latest-snapshot residuals into `current` buckets. Lifecycles that
  // closed cleanly will already have zeros from the close event, so this
  // naturally only contributes when something is still open.
  for (const last of lastByLifecycle.values()) {
    if (last.collAfter > 0) ensure(coll, last.collSym).current += last.collAfter;
    if (last.debtAfter > 0) ensure(debt, last.debtSym).current += last.debtAfter;
  }

  const toArr = (m: Map<string, Mutable>): AssetBucket[] => [...m.values()];
  return { collateral: toArr(coll), debt: toArr(debt) };
}
