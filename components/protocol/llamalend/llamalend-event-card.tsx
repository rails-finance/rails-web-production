"use client";

// Composer: wires the LlamaLend header / detail / explainer into the universal
// EventCard shell. Mirrors AaveV4EventCard / LiquityEventCard so the timeline
// chrome (expand/collapse, footer with tx hash + gas, plain-English explainer,
// `headerBars` slot for the LLAMMA bands pill) is identical across protocols.
//
// `headerBars` is the architectural mount-point for the bands visualization
// (C2). Today it's a no-op stub; once C2 lands the band-range pill renders
// inside the header panel, in the same position as AaveV4's change/balance
// bars and Liquity's trove bar.

import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import type { LlamalendContext } from "@/lib/shared/types/protocols/llamalend";
import { EventCard } from "@/components/shared/event-card";
import { SpineColumn, type SpineTokenRow } from "@/components/shared/spine-column";
import { LlamalendEventHeader } from "./llamalend-event-header";
import { LlamalendEventDetail } from "./llamalend-event-detail";
import { LlamalendEventExplainer, getLlamalendExplainerTeaser } from "./llamalend-event-explainer";
import { LlamalendBarsSlot } from "./llamalend-bars-slot";

export interface LlamalendEventCardProps {
  event: BaseActivityEvent & { context: { protocol: "llamalend"; data: LlamalendContext } };
  isFirst?: boolean;
  isLast?: boolean;
}

const PASSIVE_TYPES = new Set(["liquidate", "liquidated", "soft_liquidated"]);

export function LlamalendEventCard({ event, isFirst, isLast }: LlamalendEventCardProps) {
  const ctx = event.context.data;
  const isPassive = PASSIVE_TYPES.has(ctx.eventType);
  const collSym = ctx.collateralSymbol ?? "?";
  const debtSym = ctx.borrowedSymbol ?? "?";

  // Column 2 — semantic icon column.
  //
  // Liquidation / soft-liq → warning glyph on a dotted spine (passive event).
  // Otherwise dual-token row showing the collateral + debt sides with
  // direction-encoded flow: debt outgoing on borrow, debt incoming on repay,
  // collateral incoming on deposit, collateral outgoing on remove.
  const collDelta = parseFloat(ctx.deltaCollateral ?? "0") || 0;
  const debtDelta = parseFloat(ctx.deltaDebt ?? "0") || 0;
  const showColl = Math.abs(collDelta) >= 0.0001;
  const showDebt = Math.abs(debtDelta) >= 0.0001;

  let iconSlot: React.ReactNode;
  if (isPassive) {
    iconSlot = <SpineColumn icon="warning" spine="dotted" isFirst={isFirst} isLast={!!isLast} />;
  } else {
    // Sign convention from the materialized view: deltaCollateral > 0 means
    // collateral entering the position (deposit, direction "right" = toward
    // protocol); deltaDebt > 0 means debt minted to the wallet (borrow,
    // direction "left" = toward wallet).
    const collDir: "left" | "right" = collDelta >= 0 ? "right" : "left";
    const debtDir: "left" | "right" = debtDelta >= 0 ? "left" : "right";
    const tokens: SpineTokenRow[] = [
      ...(showColl ? [{ symbol: collSym, direction: collDir, value: Math.abs(collDelta) }] : []),
      ...(showDebt ? [{ symbol: debtSym, direction: debtDir, value: Math.abs(debtDelta) }] : []),
    ];
    // Fallback: if neither side moved (e.g. a state-only event), at least
    // show the collateral icon so the row keeps the protocol's shape.
    if (tokens.length === 0) tokens.push({ symbol: collSym });
    iconSlot = <SpineColumn tokens={tokens} isFirst={isFirst} isLast={!!isLast} />;
  }

  const teaser = getLlamalendExplainerTeaser(ctx);

  return (
    <EventCard
      avatar={null}
      iconColumn={iconSlot}
      header={<LlamalendEventHeader ctx={ctx} timestamp={event.timestamp} />}
      headerBars={<LlamalendBarsSlot ctx={ctx} />}
      detail={<LlamalendEventDetail ctx={ctx} txHash={event.txHash} wallet={event.wallet} />}
      explainer={<LlamalendEventExplainer ctx={ctx} skipFirst />}
      explainerTeaser={teaser}
      txHash={event.txHash}
      wallet={event.wallet}
      gas={event.gas}
    />
  );
}
