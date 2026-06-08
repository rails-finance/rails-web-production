"use client";

import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { formatNum } from "@/lib/shared/format-event";
import { useHeaderValueHideClass } from "@/lib/shared/header-values";
import { EventTime } from "@/components/shared/event-time";
import { useTimelineDisplay } from "@/components/shared/timeline-display-context";
import { aaveV4DisplaySymbol } from "@/lib/aave-v4/pt-tokens";
import type { AaveV4Context } from "@/lib/shared/types/protocols/aave-v4";

/** 1-based position + total within a shared tx_hash. `count > 1` triggers
 * the "X OF Y" group chip on the left of the header. */
export interface AaveV4TxGroup {
  index: number;
  count: number;
}

// USD value lives in the expanded detail (next to the after-balance and as
// a single asset-price pill in the footer), not in the header. Mirrors the
// Liquity V2 card structure — the header stays as "action · amount · icon"
// and the dollar number surfaces alongside the state transition where the
// context (before, after, ratio) explains what the value actually represents.

type OperationStyle = { label: string; color: string; bg: string; badge: boolean };

const STYLES: Record<string, OperationStyle> = {
  supply:            { label: "Supply",             color: "", bg: "", badge: false },
  withdraw:          { label: "Withdraw",           color: "", bg: "", badge: false },
  borrow:            { label: "Borrow",             color: "", bg: "", badge: false },
  repay:             { label: "Repay",              color: "", bg: "", badge: false },
  liquidation:       { label: "Liquidation",        color: "text-red-400",   bg: "bg-red-500/20", badge: true },
  collateral_toggle: { label: "Collateral Toggle",  color: "", bg: "", badge: false },
};

export interface AaveV4EventHeaderProps {
  ctx: AaveV4Context;
  timestamp: number;
  /** Composite-tx grouping — when count > 1, the "X OF Y" chip renders. */
  txGroup?: AaveV4TxGroup;
  /** 1-based chronological position within the spoke's event list. Stable
   * across asc/desc display order. */
  eventNumber?: number;
}

export function AaveV4EventHeader({ ctx, timestamp, txGroup, eventNumber }: AaveV4EventHeaderProps) {
  const style = STYLES[ctx.eventType] ?? { label: ctx.eventType, color: "", bg: "", badge: false };
  const amount = parseFloat(ctx.amount ?? "0") || 0;
  const hideVal = useHeaderValueHideClass({ isPassive: ctx.eventType === "liquidation" });
  const { showEventNumbers, showInterestRates } = useTimelineDisplay();

  // For collateral toggle, show enable/disable
  const label = ctx.eventType === "collateral_toggle"
    ? (ctx.enabled ? "Enable Collateral" : "Disable Collateral")
    : style.label;

  const groupChip = txGroup && txGroup.count > 1 ? (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-sunken text-rb-500"
      title={`Operation ${txGroup.index} of ${txGroup.count} in this transaction`}
    >
      {txGroup.index} of {txGroup.count}
    </span>
  ) : null;

  const counter = eventNumber != null && showEventNumbers ? (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] bg-sunken text-rb-500"
      aria-label={`Event ${eventNumber}`}
    >
      {eventNumber}
    </span>
  ) : null;

  return (
    <div className="px-5 pt-4 pb-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {groupChip}
        {ctx.alsoToggledCollateral ? (
          <>
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">Enable Collateral</span>
            <span className="text-sm text-rb-500">Supply</span>
          </>
        ) : style.badge ? (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${style.bg} ${style.color}`}>
            {label}
          </span>
        ) : (
          <span className="text-sm text-rb-500">{label}</span>
        )}
        {amount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className={`font-bold text-foreground ${hideVal}`}>{formatNum(amount)}</span>
            <TokenChipIcon symbol={ctx.reserveSymbol ?? "???"} size={16} />
          </span>
        )}
        {ctx.eventType === "collateral_toggle" && ctx.reserveSymbol && (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <TokenChipIcon symbol={ctx.reserveSymbol} size={16} />
            <span className="">{aaveV4DisplaySymbol(ctx.reserveSymbol)}</span>
          </span>
        )}
        {showInterestRates && (ctx.supplyAPR || ctx.borrowAPR) && (
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-rb-300/60 dark:bg-rb-800/60 ">
            {((parseFloat(ctx.supplyAPR ?? ctx.borrowAPR ?? "0")) * 100).toFixed(2)}%
          </span>
        )}
        {ctx.eventType === "liquidation" && ctx.debtToCover && (
          <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
            <span>Debt covered: {formatNum(ctx.debtToCover)} {aaveV4DisplaySymbol(ctx.reserveSymbol)}</span>
          </span>
        )}
        {ctx.eventType === "liquidation" && ctx.liquidatedCollateralAmount && ctx.collateralSymbol && (
          <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
            <span>Seized: {formatNum(ctx.liquidatedCollateralAmount)} {ctx.collateralSymbol}</span>
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-2">
          {timestamp > 0 && (
            <span className="text-xs ">
              <EventTime ts={timestamp} />
            </span>
          )}
          {counter}
        </span>
      </div>
    </div>
  );
}
