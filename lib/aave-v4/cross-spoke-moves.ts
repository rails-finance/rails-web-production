// Cross-spoke migration detection.
//
// Aave V4 users sometimes relocate a whole position from one spoke to another
// in a SINGLE transaction — e.g. withdraw WBTC + repay USDT on Main, then
// supply WBTC + borrow USDT on Bluechip (verified 2026-07-01; every real
// "asset moved between hubs" in prod is one of these, never an intra-spoke
// move — see memory aave-v4-hub-moves-are-cross-spoke). Because each spoke page
// is deliberately siloed (mono-rails: one rail stands alone), the two legs land
// on two different pages and each reads as an unexplained wind-down / fresh
// deposit.
//
// This helper reconstructs the link from the shared txHash — no server change:
// every leg already ships with its own spokeName + hub, and the spoke page
// already fetches the wallet's FULL timeline (all spokes) before filtering to
// one. A leg is a migration leg when its same-tx set contains an
// opposite-direction event for the SAME symbol on a DIFFERENT spoke.

import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isAaveV4Event } from "@/lib/shared/types/event-shape";

export interface AaveV4Migration {
  /** "to" = the asset left this spoke for another in the same tx; "from" = it
   *  arrived here from another spoke. Named from the perspective of the leg the
   *  annotation is attached to. */
  direction: "to" | "from";
  /** Display name of the OTHER spoke in the move (the link target). */
  spokeName: string;
}

const OUTFLOW = new Set(["withdraw", "repay"]);
const INFLOW = new Set(["supply", "borrow"]);

function legDirection(eventType: string): "out" | "in" | null {
  if (OUTFLOW.has(eventType)) return "out";
  if (INFLOW.has(eventType)) return "in";
  return null;
}

/** Map of event.id → migration annotation, built from a wallet's full timeline
 *  (all spokes). Events with no cross-spoke counterpart are simply absent. */
export function buildCrossSpokeMoves(events: BaseActivityEvent[]): Map<string, AaveV4Migration> {
  const out = new Map<string, AaveV4Migration>();

  const byTx = new Map<string, BaseActivityEvent[]>();
  for (const e of events) {
    if (!isAaveV4Event(e) || !e.txHash) continue;
    const bucket = byTx.get(e.txHash);
    if (bucket) bucket.push(e);
    else byTx.set(e.txHash, [e]);
  }

  for (const group of byTx.values()) {
    if (group.length < 2) continue;
    for (const e of group) {
      if (!isAaveV4Event(e)) continue;
      const ec = e.context.data;
      const eDir = legDirection(ec.eventType);
      if (!eDir) continue;

      const counterpart = group.find((o) => {
        if (o.id === e.id || !isAaveV4Event(o)) return false;
        const oc = o.context.data;
        if (oc.reserveSymbol !== ec.reserveSymbol) return false;
        if ((oc.spokeName ?? "") === (ec.spokeName ?? "")) return false;
        const oDir = legDirection(oc.eventType);
        return oDir != null && oDir !== eDir;
      });

      if (counterpart && isAaveV4Event(counterpart)) {
        out.set(e.id, {
          direction: eDir === "out" ? "to" : "from",
          spokeName: counterpart.context.data.spokeName ?? "Main",
        });
      }
    }
  }

  return out;
}
