"use client";

// Composer: wires the Aave V4 header / detail / explainer into the universal
// EventCard shell. Mirrors LiquityEventCard's pattern. Bars slot is rendered
// via EventCard's `headerBars` so the change-bar / balance-bar pair sits
// inside the header panel directly under the action row.
//
// SpineColumn shares the universal event-card API, so the icon-column logic is
// identical across protocols.

import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import type { AaveV4Context } from "@/lib/shared/types/protocols/aave-v4";
import { EventCard } from "@/components/shared/event-card";
import { SpineColumn } from "@/components/shared/spine-column";
import { AaveV4EventHeader, type AaveV4TxGroup } from "./aave-v4-event-header";
import { AaveV4EventDetail } from "./aave-v4-event-detail";
import { AaveV4EventExplainer } from "./aave-v4-event-explainer";
import { AaveV4BarsSlot } from "./aave-v4-bars-slot";
import { fmtTokenAmount } from "@/lib/aave-v4/format";
import type { AaveV4Migration } from "@/lib/aave-v4/cross-spoke-moves";

export interface AaveV4EventCardProps {
  event: BaseActivityEvent & { context: { protocol: "aave-v4"; data: AaveV4Context } };
  isFirst?: boolean;
  isLast?: boolean;
  /** Position + total within shared tx_hash. Drives the "X OF Y" chip. */
  txGroup?: AaveV4TxGroup;
  /** 1-based chronological position within the spoke's event list. */
  eventNumber?: number;
  /** Set when this event is one leg of a same-tx cross-spoke migration. */
  migration?: AaveV4Migration;
}

export function AaveV4EventCard({ event, isFirst, isLast, txGroup, eventNumber, migration }: AaveV4EventCardProps) {
  const ctx = event.context.data;
  const isLiquidation = ctx.eventType === "liquidation";
  const isCollateralToggle = ctx.eventType === "collateral_toggle";
  const isIncoming = ctx.eventType === "withdraw" || ctx.eventType === "borrow";
  const alsoToggled = ctx.alsoToggledCollateral;

  const amt = ctx.amount ? parseFloat(ctx.amount) : undefined;
  const sym = ctx.reserveSymbol ?? "?";
  // Canonical amount string — identical to the header's, so the spine value and
  // the header amount (which swap between locations via `showTimelineValues`)
  // never disagree. Price-anchored precision lives in one place: fmtTokenAmount.
  const amtDisplay = amt != null ? fmtTokenAmount(amt, ctx.price?.usd) : undefined;

  const iconSlot = isLiquidation ? (
    <SpineColumn
      icon="warning"
      warningTone="critical"
      warningLabel="Liquidation"
      spine="dotted"
      isFirst={isFirst}
      isLast={!!isLast}
    />
  ) : isCollateralToggle ? (
    <SpineColumn
      tokens={[{ symbol: sym, badge: ctx.enabled ? "check" : "cross" }]}
      isFirst={isFirst}
      isLast={!!isLast}
    />
  ) : alsoToggled ? (
    <SpineColumn
      tokens={[{ symbol: sym, badge: "check", direction: "right", value: amt, valueDisplay: amtDisplay }]}
      isFirst={isFirst}
      isLast={!!isLast}
    />
  ) : (
    <SpineColumn
      tokens={[{ symbol: sym, direction: isIncoming ? "left" : "right", value: amt, valueDisplay: amtDisplay }]}
      isFirst={isFirst}
      isLast={!!isLast}
    />
  );

  return (
    <EventCard
      avatar={null}
      iconColumn={iconSlot}
      header={
        <AaveV4EventHeader
          ctx={ctx}
          timestamp={event.timestamp}
          txGroup={txGroup}
          eventNumber={eventNumber}
          migration={migration}
          wallet={event.wallet}
        />
      }
      headerBars={<AaveV4BarsSlot eventId={event.id} />}
      detail={<AaveV4EventDetail ctx={ctx} txHash={event.txHash} wallet={event.wallet} />}
      detailLabel="Aave V4 Details"
      explainer={<AaveV4EventExplainer ctx={ctx} gas={event.gas} />}
      explainerLabel="Plain English"
      txHash={event.txHash}
      persistKey={`aave-v4:${event.id}`}
    />
  );
}
