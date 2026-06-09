import type { AaveV4Context } from "@/lib/shared/types/protocols/aave-v4";

/** The borrow rate to DISPLAY for an Aave V4 event.
 *
 *  Prefers the TRUE per-block variable borrow rate the server attaches to each
 *  held-debt snapshot item (`allDebts[].borrowAPR`, derived from the hub's
 *  on-chain `drawnRate`) over the MV's `ctx.borrowAPR`. The latter is an
 *  *inferred* rate — a realized average computed from this wallet's debt-index
 *  delta between its own events — which is noisy and runs ~0.5–0.7pp high for
 *  closely-spaced events (e.g. it reports 3.77% one minute after a 3.07% read of
 *  the same reserve). So `ctx.borrowAPR` is only a fallback for events the rate
 *  pipeline hasn't covered (e.g. a brand-new reserve with no rate row yet).
 *
 *  Picks the moved/primary debt asset first, then any held debt carrying a rate.
 *  Returns a decimal string (e.g. "0.0307") or undefined when no rate is known. */
export function effectiveBorrowAPR(ctx: AaveV4Context): string | undefined {
  const debts = ctx.allDebts ?? [];
  return (
    debts.find(d => d.symbol === ctx.reserveSymbol)?.borrowAPR ??
    debts.find(d => d.borrowAPR != null)?.borrowAPR ??
    ctx.borrowAPR
  );
}
