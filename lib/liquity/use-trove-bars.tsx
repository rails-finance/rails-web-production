"use client";

/**
 * Per-trove bar data for the inline collateral/debt bars in event card headers.
 *
 * Walks the event list, groups by trove, and for each owner-event emits the
 * current and previous state of the position in **native units** (collateral
 * in ETH/wstETH/rETH, debt in BOLD), plus a per-bar scale = trove lifetime
 * max. Native units are used because the live Sieve loader sets
 * collateralPrice/collateralInUsd to 0 — those fields are only populated by
 * an offline enrichment script. Switching to USD with a shared scale would
 * require threading live collateral prices into the provider.
 *
 * Third-party events (wallet acting as redeemer/liquidator on someone else's
 * trove) are skipped: those troves have no `openTrove` event from this wallet,
 * so the whole trove is excluded from the map. The hook returns null for any
 * event without bar data, and the visual component renders nothing in that case.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { BaseActivityEvent } from "@/lib/shared/types/activity";
import type { LiquityContext } from "@/lib/shared/types/protocols/liquity";
import { FORK_ALL_IDS } from "@/lib/shared/fork-config";
import type { PositionBarData } from "@/components/shared/position-bar";

export type TroveBarData = PositionBarData;

const LiquityTroveBarsContext = createContext<Map<string, PositionBarData> | null>(null);

type LiquityTroveEvent = BaseActivityEvent & {
  context: { protocol: string; data: LiquityContext };
};

function isLiquityTroveEvent(e: BaseActivityEvent): e is LiquityTroveEvent {
  const p = e.context?.protocol;
  if (p !== "liquity-v2-troves" && !FORK_ALL_IDS.has(p as string)) return false;
  return !!e.context?.data && typeof (e.context.data as LiquityContext).troveId === "string";
}

/**
 * Whether an event represents the trove owner acting on their own position.
 * The rails-server-mig transformer always sets `actorRole` on Liquity events
 * (one of "owner" / "redeemer" / "liquidator" / "batch_manager"), so it's the
 * authoritative signal. Falls back to comparing wallet to troveOwner for
 * legacy events that pre-date the actorRole field.
 */
function isOwnerEvent(ctx: LiquityContext, wallet: string): boolean {
  if (ctx.actorRole) return ctx.actorRole === "owner";
  if (ctx.troveOwner && ctx.troveOwner.toLowerCase() !== wallet.toLowerCase()) return false;
  return true;
}

function buildBarMap(events: BaseActivityEvent[]): Map<string, PositionBarData> {
  const map = new Map<string, PositionBarData>();

  // Group by (protocol, troveId) — fork troves can collide on troveId across protocols
  const byTrove = new Map<string, LiquityTroveEvent[]>();
  for (const e of events) {
    if (!isLiquityTroveEvent(e)) continue;
    const key = `${e.context.protocol}:${e.context.data.troveId}`;
    let arr = byTrove.get(key);
    if (!arr) {
      arr = [];
      byTrove.set(key, arr);
    }
    arr.push(e);
  }

  for (const [, troveEvents] of byTrove) {
    troveEvents.sort((a, b) => a.blockNumber - b.blockNumber || a.timestamp - b.timestamp);

    // Walk chronologically and resolve each event's post-state. The Sieve
    // loader populates stateAfter from a TroveUpdated snapshot lookup, but
    // some events fall through to ZERO_STATE when neither the snapshot nor
    // the loader's synthetic reconstruction catches them. We derive forward
    // by applying troveOperation deltas to a running tally — this matches
    // what the loader does internally and gives correct bars even when the
    // snapshot data is missing.
    type StateRow = { id: string; coll: number; debt: number; isOwner: boolean; debtFromOp: number | null };
    const states: StateRow[] = [];
    let collScale = 0;
    let debtScale = 0;
    let runningColl = 0;
    let runningDebt = 0;
    for (const e of troveEvents) {
      const ctx = e.context.data;
      const owner = isOwnerEvent(ctx, e.wallet);
      const isClose = ctx.operation === "closeTrove" || ctx.operation === "liquidate";

      let coll = ctx.stateAfter?.coll ?? 0;
      let debt = ctx.stateAfter?.debt ?? 0;
      const stateLooksMissing = coll === 0 && debt === 0 && !isClose;

      if (stateLooksMissing) {
        // Re-derive from running state + this event's deltas
        const op = ctx.troveOperation;
        if (op) {
          coll = Math.max(0, runningColl + (op.collChangeFromOperation || 0) + (op.collIncreaseFromRedist || 0));
          debt = Math.max(0, runningDebt + (op.debtChangeFromOperation || 0) + (op.debtIncreaseFromRedist || 0) + (op.debtIncreaseFromUpfrontFee || 0));
        } else {
          // No operation deltas (e.g. rate-only adjustment) — carry forward
          coll = runningColl;
          debt = runningDebt;
        }
      } else if (isClose) {
        coll = 0;
        debt = 0;
      }

      // Capture the owner-initiated debt change (excludes passive interest accrual)
      const debtFromOp = ctx.troveOperation?.debtChangeFromOperation ?? null;

      states.push({ id: e.id, coll, debt, isOwner: owner, debtFromOp });
      runningColl = coll;
      runningDebt = debt;

      if (owner) {
        if (coll > collScale) collScale = coll;
        if (debt > debtScale) debtScale = debt;
      }
    }

    if (collScale <= 0 && debtScale <= 0) continue;

    // Walk forward, computing per-event signed deltas from the previous
    // running state. prev advances on every event (including third-party)
    // so an external redemption that shrank the trove is visible as a
    // delta on the next owner event.
    let prevColl = 0;
    for (const s of states) {
      if (s.isOwner) {
        // Use the operation-level debt delta (excludes passive interest
        // accrual between events). Falls back to 0 when missing.
        const debtDelta = s.debtFromOp ?? 0;
        map.set(s.id, {
          coll: s.coll,
          debt: s.debt,
          collDelta: s.coll - prevColl,
          debtDelta,
          collScale,
          debtScale,
        });
      }
      prevColl = s.coll;
    }
  }

  return map;
}

export function LiquityTroveBarsProvider({
  events,
  children,
}: {
  events: BaseActivityEvent[];
  children: ReactNode;
}) {
  const map = useMemo(() => buildBarMap(events), [events]);
  return <LiquityTroveBarsContext.Provider value={map}>{children}</LiquityTroveBarsContext.Provider>;
}

export function useLiquityTroveBars(eventId: string): PositionBarData | null {
  const map = useContext(LiquityTroveBarsContext);
  if (!map) return null;
  return map.get(eventId) ?? null;
}
