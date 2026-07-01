"use client";

import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { fmtTokenAmount } from "@/lib/aave-v4/format";
import { useHeaderValueHideClass } from "@/lib/shared/header-values";
import { EventTime } from "@/components/shared/event-time";
import { useTimelineDisplay } from "@/components/shared/timeline-display-context";
import { aaveV4DisplaySymbol } from "@/lib/aave-v4/pt-tokens";
import { effectiveBorrowAPR } from "@/lib/aave-v4/borrow-rate";
import { slugifySpoke } from "@/lib/aave-v4/spoke-meta";
import type { AaveV4Migration } from "@/lib/aave-v4/cross-spoke-moves";
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
  supply: { label: "Supply", color: "", bg: "", badge: false },
  withdraw: { label: "Withdraw", color: "", bg: "", badge: false },
  borrow: { label: "Borrow", color: "", bg: "", badge: false },
  repay: { label: "Repay", color: "", bg: "", badge: false },
  liquidation: { label: "Liquidation", color: "text-red-400", bg: "bg-red-500/20", badge: true },
  collateral_toggle: { label: "Collateral Toggle", color: "", bg: "", badge: false },
};

export interface AaveV4EventHeaderProps {
  ctx: AaveV4Context;
  timestamp: number;
  /** Composite-tx grouping — when count > 1, the "X OF Y" chip renders. */
  txGroup?: AaveV4TxGroup;
  /** 1-based chronological position within the spoke's event list. Stable
   * across asc/desc display order. */
  eventNumber?: number;
  /** Present when this leg is one side of a same-tx cross-spoke migration —
   *  renders a linked "Moved to/from <spoke>" chip. */
  migration?: AaveV4Migration;
  /** Owner wallet — needed to build the cross-spoke link target. */
  wallet?: string;
}

export function AaveV4EventHeader({ ctx, timestamp, txGroup, eventNumber, migration, wallet }: AaveV4EventHeaderProps) {
  const style = STYLES[ctx.eventType] ?? { label: ctx.eventType, color: "", bg: "", badge: false };
  const amount = parseFloat(ctx.amount ?? "0") || 0;
  const hideVal = useHeaderValueHideClass({ isPassive: ctx.eventType === "liquidation" });
  const { showEventNumbers, showInterestRates } = useTimelineDisplay();

  // For collateral toggle, show enable/disable
  const label = ctx.eventType === "collateral_toggle" ? (ctx.enabled ? "Enable" : "Disable") : style.label;

  const groupChip =
    txGroup && txGroup.count > 1 ? (
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-sunken text-rb-500"
        title={`Operation ${txGroup.index} of ${txGroup.count} in this transaction`}
      >
        {txGroup.index} of {txGroup.count}
      </span>
    ) : null;

  // Cross-spoke migration chip — a linked breadcrumb to the other leg's spoke.
  // "Moved to <spoke> →" when the asset left this spoke this tx; "← Moved from
  // <spoke>" when it arrived. Neutral styling: it's a navigational fact, not a
  // cost/risk signal (house rule — no hue-coded meaning).
  const migrationSlug = migration ? slugifySpoke(migration.spokeName) : null;
  const migrationChip =
    migration && migrationSlug && wallet ? (
      <Link
        href={`/aave-v4/spoke/${migrationSlug}/${wallet}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sunken text-rb-500 hover:text-foreground transition-colors"
        title={
          migration.direction === "to"
            ? `Moved to the ${migration.spokeName} spoke in this transaction`
            : `Moved from the ${migration.spokeName} spoke in this transaction`
        }
      >
        {migration.direction === "from" && <ArrowLeft size={11} className="flex-shrink-0" />}
        <span>
          Moved {migration.direction} {migration.spokeName}
        </span>
        {migration.direction === "to" && <ArrowRight size={11} className="flex-shrink-0" />}
      </Link>
    ) : null;

  const counter =
    eventNumber != null && showEventNumbers ? (
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
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-positive/20 text-positive">
              Enable
            </span>
            <span className="text-sm text-rb-500">Supply</span>
          </>
        ) : style.badge ? (
          // The dotted spine now carries a "LIQUIDATION" pill on desktop, so the
          // header badge is redundant there — keep it only on mobile (no spine).
          <span
            className={`sm:hidden inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${style.bg} ${style.color}`}
          >
            {label}
          </span>
        ) : (
          <span className="text-sm text-rb-500">{label}</span>
        )}
        {ctx.eventType === "liquidation" ? (
          // Liquidation reads like Liquity's redemption header: the two facts
          // that matter — collateral cleared and debt reduced — each as
          // value + token icon. Mirrors "Cleared X ◊ Reduced Y ⬡".
          <>
            {ctx.liquidatedCollateralAmount && ctx.collateralSymbol && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="text-rb-500">Cleared</span>
                <span className={`font-bold text-foreground ${hideVal}`}>
                  {fmtTokenAmount(ctx.liquidatedCollateralAmount, ctx.collateralPrice?.usd)}
                </span>
                <TokenChipIcon symbol={ctx.collateralSymbol} size={16} />
              </span>
            )}
            {ctx.debtToCover && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="text-rb-500">Reduced</span>
                <span className={`font-bold text-foreground ${hideVal}`}>
                  {fmtTokenAmount(ctx.debtToCover, ctx.debtPrice?.usd)}
                </span>
                <TokenChipIcon symbol={ctx.reserveSymbol ?? "???"} size={16} />
              </span>
            )}
          </>
        ) : (
          <>
            {amount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className={`font-bold text-foreground ${hideVal}`}>{fmtTokenAmount(amount, ctx.price?.usd)}</span>
                <TokenChipIcon symbol={ctx.reserveSymbol ?? "???"} size={16} />
              </span>
            )}
            {ctx.eventType === "collateral_toggle" && ctx.reserveSymbol && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <TokenChipIcon symbol={ctx.reserveSymbol} size={16} />
                <span className="">{aaveV4DisplaySymbol(ctx.reserveSymbol)}</span>
              </span>
            )}
            {/* Rate pill only on borrow/repay — there it sits right after the
                moved asset's icon, so the number is unambiguously that asset's
                rate. On supply/withdraw it would float free as a held-debt rate
                with no asset context (the confusing case); the expanded card's
                asset-labelled Borrow Rate rows carry that instead. */}
            {showInterestRates &&
              (ctx.eventType === "borrow" || ctx.eventType === "repay") &&
              effectiveBorrowAPR(ctx) && (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-rb-300/60 dark:bg-rb-800/60 ">
                  {(parseFloat(effectiveBorrowAPR(ctx) ?? "0") * 100).toFixed(2)}%
                </span>
              )}
          </>
        )}
        <span className="ml-auto inline-flex items-center gap-2">
          {migrationChip}
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
