"use client";

import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { EventTime } from "@/components/shared/event-time";
import { useTimelineDisplay } from "@/components/shared/timeline-display-context";
import type { LiquityContext } from "@/lib/shared/types/protocols/liquity";
import { getBatchManagerName } from "@/lib/liquity/batch-managers";
import { usePreferences } from "@/lib/shared/preferences-context";
import { formatRatio, ratioLabelShort, useLiquityRatioColorClass } from "@/lib/shared/ratio-format";
import { useHeaderValueHideClass } from "@/lib/shared/header-values";
import { fmtTokenAmount } from "@/lib/shared/format-event";
import { AlertTriangle } from "lucide-react";

type OperationStyle = { label: string; color: string; bg: string; badge: boolean };

function getOperationStyle(operation: string, ctx?: LiquityContext): OperationStyle {
  switch (operation) {
    case "openTrove":
    case "openTroveAndJoinBatch":
      // Soft-tint pill matching the Aave V4 "Enable" header badge — the two
      // "you opened a position" actions now share one visual grammar, on the
      // semantic `positive` token (color-grammar.md §5: the Open/active green).
      return { label: "Open", color: "text-positive", bg: "bg-positive/20", badge: true };
    case "closeTrove":
      return { label: "Close", color: "", bg: "bg-rb-500/20 dark:bg-rb-500/20", badge: true };
    case "liquidate":
      return { label: "Liquidated", color: "text-foreground", bg: "bg-rb-200 dark:bg-rb-800", badge: true };
    case "adjustTrove": {
      if (ctx?.troveOperation) {
        const debtOp = ctx.troveOperation.debtChangeFromOperation;
        const collOp = ctx.troveOperation.collChangeFromOperation;
        const hasDebt = Math.abs(debtOp) >= 0.01;
        const hasColl = Math.abs(collOp) >= 0.01;
        if (hasDebt && !hasColl) {
          return debtOp > 0
            ? { label: "Borrow", color: "", bg: "", badge: false }
            : { label: "Repay", color: "", bg: "", badge: false };
        }
        if (hasColl && !hasDebt) {
          return collOp > 0
            ? { label: "Add", color: "", bg: "", badge: false }
            : { label: "Withdraw", color: "", bg: "", badge: false };
        }
        // Combined: show both actions
        if (hasColl && hasDebt) {
          const collLabel = collOp > 0 ? "Add" : "Withdraw";
          const debtLabel = debtOp > 0 ? "Borrow" : "Repay";
          return { label: `${collLabel} + ${debtLabel}`, color: "", bg: "", badge: false };
        }
      }
      return { label: "Adjust", color: "", bg: "", badge: false };
    }
    case "adjustTroveInterestRate": {
      if (ctx?.stateBefore && ctx?.stateAfter) {
        return ctx.stateAfter.annualInterestRate > ctx.stateBefore.annualInterestRate
          ? { label: "Increase interest rate", color: "", bg: "", badge: false }
          : { label: "Decrease interest rate", color: "", bg: "", badge: false };
      }
      return { label: "Rate change", color: "", bg: "", badge: false };
    }
    case "applyPendingDebt":
      return { label: "Apply debt", color: "text-pink-700 dark:text-pink-400", bg: "bg-pink-500/20", badge: true };
    case "redeemCollateral":
      return { label: "Redemption", color: "text-white", bg: "bg-caution-500", badge: true };
    case "adjustZombieTrove":
    case "adjustUnredeemableZombieTrove":
      return { label: "Redeemed", color: "text-foreground", bg: "bg-rb-200 dark:bg-rb-800", badge: true };
    case "setInterestBatchManager":
      return { label: "Delegate", color: "", bg: "", badge: false };
    case "removeFromBatch":
      return { label: "Leave delegate", color: "", bg: "", badge: false };
    case "transferTrove":
      return { label: "Transfer", color: "", bg: "", badge: false };
    case "setBatchManagerAnnualInterestRate":
      return { label: "Interest rate", color: "", bg: "", badge: false };
    default:
      return { label: operation, color: "", bg: "", badge: false };
  }
}

/** Small "people" glyph used inside the pink delegate / batch rate pills, and
 *  reused as the event-filter suffix that marks the delegate-set "Interest
 *  rate" row apart from the owner's own. Stroke is currentColor so it inherits
 *  the surrounding text color (pink in the pill, muted in the filter menu). */
export function UsersGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** Interest-rate pill for individual (non-delegated) troves — a muted rb-500
 *  tint mirroring the visual weight of the pink delegate pill. */
function RatePill({ rate }: { rate: number }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rb-500/15 text-foreground">
      {rate.toFixed(1)}%
    </span>
  );
}

/** Interest-rate pill for delegated troves — pink with the people glyph,
 *  matching the Delegate / Batch rate header treatment (pink = external party). */
function DelegateRatePill({ rate }: { rate: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-700 dark:text-pink-400 text-xs font-bold">
      <UsersGlyph />
      {rate.toFixed(2)}%
    </span>
  );
}

// Actor role (owner / redeemer / liquidator / batch_manager) is still threaded
// through ctx.actorRole — the bars provider and other downstream logic depend
// on it — but the trove view no longer renders a pill for it; the row's
// operation badge already conveys whether the wallet is acting on its own
// position or a third-party one.

export interface LiquityEventHeaderProps {
  ctx: LiquityContext;
  timestamp: number;
  protocolId?: string;
  /** 1-based chronological position of this event in the trove timeline.
   * Stable regardless of asc/desc display order — event #1 is always the
   * trove's openTrove. */
  eventNumber?: number;
  /** Live oracle price for this collateral — anchors the collateral amount's
   * display precision so it matches the timeline spine (see fmtTokenAmount).
   * BOLD debt anchors to $1. Falls back to magnitude scaling when absent. */
  currentPrice?: number;
}

export function LiquityEventHeader({ ctx, timestamp, eventNumber, currentPrice }: LiquityEventHeaderProps) {
  const style = getOperationStyle(ctx.operation, ctx);
  const { stateBefore, stateAfter, troveOperation } = ctx;
  const { showTimestamps, showEventNumbers, showCollateralRatio } = useTimelineDisplay();
  const { prefs } = usePreferences();
  const ratioMode = prefs.ratioMode;
  const crColor = useLiquityRatioColorClass();

  const groupChip = ctx.blockGrouping?.isGrouped ? (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-sunken text-rb-500"
      title={`Operation ${ctx.blockGrouping.sameBlockIndex} of ${ctx.blockGrouping.sameBlockCount} in this transaction`}
    >
      {ctx.blockGrouping.sameBlockIndex} of {ctx.blockGrouping.sameBlockCount}
    </span>
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

  if (!stateAfter || !stateBefore) {
    return (
      <div className="flex items-center gap-2">
        {style.badge ? (
          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>
            {style.label}
          </span>
        ) : (
          <span className={`text-sm font-medium ${style.color || "text-rb-500"}`}>{style.label}</span>
        )}
        <span className="ml-auto inline-flex items-center gap-2">
          {groupChip}
          {showTimestamps && <span className="text-xs ">{new Date(timestamp * 1000).toLocaleDateString()}</span>}
          {counter}
        </span>
      </div>
    );
  }

  const debtChange = troveOperation
    ? troveOperation.debtChangeFromOperation +
      troveOperation.debtIncreaseFromRedist +
      troveOperation.debtIncreaseFromUpfrontFee
    : stateAfter.debt - stateBefore.debt;
  const collChange = troveOperation
    ? troveOperation.collChangeFromOperation + troveOperation.collIncreaseFromRedist
    : stateAfter.coll - stateBefore.coll;

  // Headline amount for owner-initiated (active) rows = the operation principal,
  // matching the timeline spine — what the owner actually borrowed/repaid/added/
  // withdrew. The upfront fee / redistribution / accrued interest is folded into
  // `debtChange`/`collChange` above (used by the passive redemption & liquidation
  // rows and by the detail's before→after + arrow tooltip), but the active
  // header row shows the principal so header == spine. Falls back to the net
  // change when there's no troveOperation.
  const debtOpAmount = troveOperation ? troveOperation.debtChangeFromOperation : debtChange;
  const collOpAmount = troveOperation ? troveOperation.collChangeFromOperation : collChange;

  const hasDebtChange = Math.abs(debtChange) >= 0.01;
  const hasCollChange = Math.abs(collChange) >= 0.01;
  const PASSIVE_OPS = new Set([
    "liquidate",
    "redeemCollateral",
    "applyPendingDebt",
    "adjustZombieTrove",
    "adjustUnredeemableZombieTrove",
  ]);
  const hideVal = useHeaderValueHideClass({ isPassive: PASSIVE_OPS.has(ctx.operation) });

  return (
    <>
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {ctx.operation === "setBatchManagerAnnualInterestRate" && stateAfter ? (
            <>
              <DelegateRatePill rate={stateAfter.annualInterestRate} />
              {ctx.batchManager && (
                <span className="text-sm font-bold text-pink-500">{getBatchManagerName(ctx.batchManager)}</span>
              )}
            </>
          ) : ctx.operation === "setInterestBatchManager" ? (
            <>
              <span className="text-sm text-rb-500">{style.label}</span>
              {stateAfter.annualInterestRate > 0 && <DelegateRatePill rate={stateAfter.annualInterestRate} />}
              {ctx.batchManager && (
                <span className="text-sm font-bold text-pink-500">{getBatchManagerName(ctx.batchManager)}</span>
              )}
            </>
          ) : ctx.operation === "openTrove" || ctx.operation === "openTroveAndJoinBatch" ? (
            <>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${style.bg} ${style.color}`}>
                {style.label}
              </span>
              {hasCollChange && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="text-rb-500">Supply</span>
                  <span className={`font-bold text-foreground ${hideVal}`}>
                    {fmtTokenAmount(Math.abs(collOpAmount), currentPrice)}
                  </span>
                  <TokenChipIcon symbol={ctx.collateralType} size={16} />
                </span>
              )}
              {hasDebtChange && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="text-rb-500">Borrow</span>
                  <span className={`font-bold text-foreground ${hideVal}`}>
                    {fmtTokenAmount(Math.abs(debtOpAmount), 1)}
                  </span>
                  <TokenChipIcon symbol={ctx.assetType ?? "BOLD"} size={16} />
                </span>
              )}
              {stateAfter.annualInterestRate > 0 &&
                (ctx.operation === "openTroveAndJoinBatch" ? (
                  <DelegateRatePill rate={stateAfter.annualInterestRate} />
                ) : (
                  <RatePill rate={stateAfter.annualInterestRate} />
                ))}
            </>
          ) : ctx.operation === "redeemCollateral" ? (
            // The dotted spine carries a "REDEMPTION" pill on desktop, so the
            // header badge is mobile-only here. The freed space lets the two
            // facts that matter read with labels — collateral cleared, debt
            // reduced — mirroring the Aave liquidation header grammar.
            <>
              <span
                className={`sm:hidden inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${style.bg} ${style.color}`}
              >
                {style.label}
              </span>
              {hasCollChange && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="text-caution-600 dark:text-caution-400">Cleared</span>
                  <span className={`font-bold text-foreground ${hideVal}`}>
                    {fmtTokenAmount(Math.abs(collChange), currentPrice)}
                  </span>
                  <TokenChipIcon symbol={ctx.collateralType} size={16} />
                </span>
              )}
              {hasDebtChange && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="text-caution-600 dark:text-caution-400">Reduced</span>
                  <span className={`font-bold text-foreground ${hideVal}`}>
                    {fmtTokenAmount(Math.abs(debtChange), 1)}
                  </span>
                  <TokenChipIcon symbol={ctx.assetType ?? "BOLD"} size={16} />
                </span>
              )}
            </>
          ) : ctx.operation === "liquidate" ? (
            // The dotted spine carries a critical "LIQUIDATION" pill on desktop,
            // so the header badge is mobile-only here. The freed space lets the
            // facts read with labels — collateral liquidated, debt cleared —
            // mirroring the redemption header grammar. Labels stay neutral
            // (rb-500); the red spine alone carries the critical valence.
            <>
              <span
                className={`sm:hidden inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${style.bg} ${style.color}`}
              >
                {style.label}
              </span>
              {hasCollChange && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="text-rb-500">Liquidated</span>
                  <span className={`font-bold text-foreground ${hideVal}`}>
                    {fmtTokenAmount(Math.abs(collChange), currentPrice)}
                  </span>
                  <TokenChipIcon symbol={ctx.collateralType} size={16} />
                </span>
              )}
              {hasDebtChange && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="text-rb-500">Cleared</span>
                  <span className={`font-bold text-foreground ${hideVal}`}>
                    {fmtTokenAmount(Math.abs(debtChange), 1)}
                  </span>
                  <TokenChipIcon symbol={ctx.assetType ?? "BOLD"} size={16} />
                </span>
              )}
            </>
          ) : style.badge ? (
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${style.bg} ${style.color}`}
            >
              {style.label}
            </span>
          ) : style.label.includes(" + ") ? (
            // Combined action: "Withdraw + Repay" etc — show with values and token icons
            <>
              {(() => {
                const [collAction, debtAction] = style.label.split(" + ");
                return (
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <span className="text-rb-500">{collAction}</span>
                    {hasCollChange && (
                      <span className={`font-bold text-foreground ${hideVal}`}>
                        {fmtTokenAmount(Math.abs(collOpAmount), currentPrice)}
                      </span>
                    )}
                    <TokenChipIcon symbol={ctx.collateralType} size={16} />
                    <span className="text-rb-500">{debtAction}</span>
                    {hasDebtChange && (
                      <span className={`font-bold text-foreground ${hideVal}`}>
                        {fmtTokenAmount(Math.abs(debtOpAmount), 1)}
                      </span>
                    )}
                    <TokenChipIcon symbol={ctx.assetType ?? "BOLD"} size={16} />
                  </span>
                );
              })()}
            </>
          ) : (
            <span className="text-sm text-rb-500">{style.label}</span>
          )}

          {/* Debt change (skip for open trove, redemption, liquidation, delegate, and combined — shown inline or n/a).
              Also skip rate changes: a rate adjustment moves no principal, so `debtOpAmount` is 0 and this block
              would print a bare "0". The upfront fee that makes `hasDebtChange` true (fee-inclusive) rides the
              detail's "incl. … fee" line instead — the header keeps the rate pill only. */}
          {hasDebtChange &&
            !style.label.includes(" + ") &&
            ctx.operation !== "openTrove" &&
            ctx.operation !== "openTroveAndJoinBatch" &&
            ctx.operation !== "redeemCollateral" &&
            ctx.operation !== "liquidate" &&
            ctx.operation !== "adjustTroveInterestRate" &&
            ctx.operation !== "setInterestBatchManager" && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className={`font-bold text-foreground ${hideVal}`}>
                  {fmtTokenAmount(Math.abs(debtOpAmount), 1)}
                </span>
                <TokenChipIcon symbol={ctx.assetType ?? "BOLD"} size={16} />
              </span>
            )}

          {/* Collateral change (skip for open trove, redemption, liquidation, delegate, combined, and rate change) */}
          {hasCollChange &&
            !style.label.includes(" + ") &&
            ctx.operation !== "openTrove" &&
            ctx.operation !== "openTroveAndJoinBatch" &&
            ctx.operation !== "redeemCollateral" &&
            ctx.operation !== "liquidate" &&
            ctx.operation !== "adjustTroveInterestRate" &&
            ctx.operation !== "setInterestBatchManager" && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className={`font-bold text-foreground ${hideVal}`}>
                  {fmtTokenAmount(Math.abs(collOpAmount), currentPrice)}
                </span>
                <TokenChipIcon symbol={ctx.collateralType} size={16} />
              </span>
            )}

          {/* Claimable collateral surplus — on a liquidation where the trove's
              collateral value exceeded its debt, the remainder is returned to
              the owner and remains claimable. Mirrors the prod liquidation
              header (and the redemption "claimable" treatment in the detail). */}
          {ctx.operation === "liquidate" && ctx.liquidation && ctx.liquidation.collSurplus > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-700 dark:text-green-400">
              <span>{ctx.liquidation.collSurplus.toFixed(4)}</span>
              <TokenChipIcon symbol={ctx.collateralType} size={16} />
              claimable
            </span>
          )}

          {/* Interest rate — single pill. The label already says it's a rate,
              so no second "% APR" is needed in the trailing cluster below. */}
          {(ctx.operation === "adjustTroveInterestRate" || ctx.operation === "removeFromBatch") &&
            stateAfter.annualInterestRate > 0 && <RatePill rate={stateAfter.annualInterestRate} />}

          {/* Right side: CR (rate only on rate-change operations). The delegate
              row keeps its header minimal (Delegate · rate · fee · manager),
              so the trailing CR/LTV + APR are suppressed there — the rate
              already shows in the delegate pill and CR lives in the grid. */}
          <span className="inline-flex items-center gap-1.5">
            {showCollateralRatio && stateAfter.collateralRatio > 0 && ctx.operation !== "setInterestBatchManager" && (
              <span className={`text-xs ${crColor(stateAfter.collateralRatio, ctx.collateralType)}`}>
                {formatRatio(stateAfter.collateralRatio, ratioMode, 0)} {ratioLabelShort(ratioMode)}
              </span>
            )}
          </span>
          <span className="ml-auto inline-flex items-center gap-2">
            {ctx.operation === "redeemCollateral" && ctx.isZombieTrove && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-bold rounded bg-caution-500/15 text-caution-600 dark:text-caution-400"
                title={
                  stateAfter.debt === 0
                    ? "Zombie trove fully redeemed — debt cleared, collateral now claimable"
                    : "Zombie trove — debt below the minimum, redeemable until restored"
                }
              >
                <AlertTriangle className="w-3 h-3" />
                <span className="hidden md:inline">Zombie</span>
              </span>
            )}
            {groupChip}
            {timestamp > 0 && (
              <span className="text-xs ">
                <EventTime ts={timestamp} />
              </span>
            )}
            {counter}
          </span>
        </div>
      </div>
    </>
  );
}
