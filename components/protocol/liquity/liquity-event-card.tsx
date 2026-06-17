"use client";

import Link from "next/link";
import type { BaseActivityEvent } from "@/lib/shared/types/activity";
import type { LiquityContext } from "@/lib/shared/types/protocols/liquity";
import { EventCard } from "@/components/shared/event-card";
import { SpineColumn } from "@/components/shared/spine-column";
import { Facehash } from "@/components/shared/facehash";
import { LiquityEventHeader } from "./liquity-event-header";
import { LiquityEventDetail } from "./liquity-event-detail";
import { LiquityEventExplainer, getLiquityExplainerTeaser } from "./liquity-event-explainer";
import { TroveBarsSlot } from "./trove-bar";

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

export interface LiquityEventCardProps {
  event: BaseActivityEvent & { context: { protocol: "liquity-v2-troves"; data: LiquityContext } };
  addressDisplay?: "full" | "compact" | "hidden";
  ensName?: string | null;
  hoveredAddress?: string | null;
  setHoveredAddress?: (addr: string | null) => void;
  isFirst?: boolean;
  isLast?: boolean;
  /** When provided, replaces the internally-built avatar slot */
  avatarOverride?: React.ReactNode;
  /** Previous event in the timeline for interest calculations */
  previousEvent?: BaseActivityEvent;
  /** 1-based chronological position; threaded through to the header chip. */
  eventNumber?: number;
  /** Live oracle price for this collateral — drives the "today" leg of the
   *  redemption P/L in the header and explainer. */
  currentPrice?: number;
}

export function LiquityEventCard({
  event,
  addressDisplay = "full",
  ensName,
  hoveredAddress,
  setHoveredAddress,
  isFirst,
  isLast,
  avatarOverride,
  previousEvent,
  eventNumber,
  currentPrice,
}: LiquityEventCardProps) {
  const ctx = event.context.data;
  const wallet = event.wallet;

  // Column 1 — Avatar
  const avatarSlot =
    addressDisplay === "hidden" ? (
      <div className="hidden sm:block" />
    ) : addressDisplay === "compact" ? (
      <div className="flex items-center justify-center pt-4">
        <Link
          href={`/address/${wallet}`}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setHoveredAddress?.(wallet.toLowerCase())}
          onMouseLeave={() => setHoveredAddress?.(null)}
          className={`inline-flex items-center justify-center rounded-full border-2 p-1.5 bg-sunken transition-colors ${hoveredAddress === wallet.toLowerCase() ? "border-rb-500 dark:border-rb-500" : "border-rb-300 dark:border-rb-700"} hover:border-rb-500 dark:hover:border-rb-500`}
          title={ensName || wallet}
        >
          <Facehash address={wallet} size={20} />
        </Link>
      </div>
    ) : (
      <div className="flex items-center pt-4">
        <Link
          href={`/address/${wallet}`}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setHoveredAddress?.(wallet.toLowerCase())}
          onMouseLeave={() => setHoveredAddress?.(null)}
          className={`flex items-center rounded-full bg-sunken px-3 py-2 transition-colors ${hoveredAddress === wallet.toLowerCase() ? "text-blue-300 border-rb-500 dark:border-rb-500" : "text-blue-400"} hover:text-blue-500 hover:border-rb-500 dark:hover:border-rb-500`}
        >
          <span className="inline-flex items-center gap-1.5 w-[140px]">
            <Facehash address={wallet} size={16} />
            <span className="truncate font-mono text-xs">{ensName || shortenAddress(wallet)}</span>
          </span>
        </Link>
      </div>
    );

  // Column 2 — Spine column with semantic icon modes
  const PASSIVE_ACTIONS = new Set(["redeemCollateral", "liquidate", "applyPendingDebt"]);
  const RATE_ACTIONS = new Set(["adjustTroveInterestRate", "setBatchManagerAnnualInterestRate"]);
  const DELEGATE_ACTIONS = new Set(["setInterestBatchManager", "removeFromBatch"]);
  const isPassive = PASSIVE_ACTIONS.has(ctx.operation);
  const isRateChange = RATE_ACTIONS.has(ctx.operation);
  const isDelegate = DELEGATE_ACTIONS.has(ctx.operation);

  const rateUp = isRateChange
    ? (ctx.stateAfter?.annualInterestRate ?? 0) >= (ctx.stateBefore?.annualInterestRate ?? 0)
    : false;
  const isJoin = isDelegate ? ctx.operation === "setInterestBatchManager" : false;

  const iconSlot = isPassive ? (
    <SpineColumn
      icon="warning"
      warningTone={ctx.operation === "liquidate" ? "red" : ctx.operation === "redeemCollateral" ? "orange" : "amber"}
      warningLabel={
        ctx.operation === "liquidate" ? "Liquidation" : ctx.operation === "redeemCollateral" ? "Redemption" : undefined
      }
      spine="dotted"
      isFirst={isFirst}
      isLast={!!isLast}
    />
  ) : isDelegate ? (
    <SpineColumn
      icon="delegate"
      iconDirection={isJoin ? "up" : "down"}
      spine="dotted"
      color="purple"
      isFirst={isFirst}
      isLast={!!isLast}
    />
  ) : isRateChange ? (
    <SpineColumn
      icon="rate-change"
      iconDirection={rateUp ? "up" : "down"}
      spine="dotted"
      color={ctx.operation === "setBatchManagerAnnualInterestRate" ? "purple" : "default"}
      isFirst={isFirst}
      isLast={!!isLast}
    />
  ) : (
    (() => {
      const debtOp = ctx.troveOperation?.debtChangeFromOperation ?? 0;
      const collOp = ctx.troveOperation?.collChangeFromOperation ?? 0;
      const boldDir = debtOp < 0 ? ("right" as const) : ("left" as const);
      const collDir = collOp < 0 ? ("left" as const) : ("right" as const);
      const showBold = ctx.operation === "closeTrove" || Math.abs(debtOp) >= 0.01 || !ctx.troveOperation;
      const showColl = ctx.operation === "closeTrove" || Math.abs(collOp) >= 0.01 || !ctx.troveOperation;
      const isActiveOp = ![
        "redeemCollateral",
        "adjustZombieTrove",
        "adjustUnredeemableZombieTrove",
        "liquidate",
        "applyPendingDebt",
        "adjustTroveInterestRate",
        "setBatchManagerAnnualInterestRate",
        "setInterestBatchManager",
        "removeFromBatch",
        "transferTrove",
      ].includes(ctx.operation);
      const collVal = isActiveOp ? Math.abs(collOp) : undefined;
      const debtVal = isActiveOp ? Math.abs(debtOp) : undefined;

      const tokens = [
        ...(showColl ? [{ symbol: ctx.collateralType, direction: collDir, value: collVal }] : []),
        ...(showBold ? [{ symbol: "BOLD", direction: boldDir, value: debtVal }] : []),
      ] as import("@/components/shared/spine-column").SpineTokenRow[];

      return <SpineColumn tokens={tokens} isFirst={isFirst} isLast={!!isLast} />;
    })()
  );

  const liquityTeaser = getLiquityExplainerTeaser(ctx, previousEvent, event);

  return (
    <EventCard
      avatar={avatarOverride ?? avatarSlot}
      iconColumn={iconSlot}
      header={<LiquityEventHeader ctx={ctx} timestamp={event.timestamp} eventNumber={eventNumber} />}
      headerBars={<TroveBarsSlot eventId={event.id} />}
      detail={
        <LiquityEventDetail
          ctx={ctx}
          txHash={event.txHash}
          previousEvent={previousEvent}
          currentEvent={event}
          currentPrice={currentPrice}
        />
      }
      explainer={
        <LiquityEventExplainer
          ctx={ctx}
          previousEvent={previousEvent}
          currentEvent={event}
          currentPrice={currentPrice}
          skipFirst
        />
      }
      explainerTeaser={liquityTeaser}
      txHash={event.txHash}
      wallet={wallet}
      gas={event.gas}
      persistKey={`liquity-v2:${event.id}`}
    />
  );
}
