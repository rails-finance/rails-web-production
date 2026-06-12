"use client";

import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { EventTime } from "@/components/shared/event-time";
import { useTimelineDisplay } from "@/components/shared/timeline-display-context";
import type { LiquityContext } from "@/lib/shared/types/protocols/liquity";
import { getBatchManagerName } from "@/lib/liquity/batch-managers";
import { usePreferences } from "@/lib/shared/preferences-context";
import { formatRatio, ratioLabelShort, useLiquityRatioColorClass } from "@/lib/shared/ratio-format";
import { useHeaderValueHideClass } from "@/lib/shared/header-values";
import { AlertTriangle } from "lucide-react";

type OperationStyle = { label: string; color: string; bg: string; badge: boolean };

function getOperationStyle(operation: string, ctx?: LiquityContext): OperationStyle {
  switch (operation) {
    case "openTrove":
    case "openTroveAndJoinBatch":
      return { label: "Open", color: "text-foreground", bg: "bg-rb-200 dark:bg-rb-800", badge: true };
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
      return { label: "Redemption", color: "text-white", bg: "bg-orange-500", badge: true };
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
      return { label: "Batch rate", color: "", bg: "", badge: false };
    default:
      return { label: operation, color: "", bg: "", badge: false };
  }
}

function formatNumber(n: number): string {
  if (Math.abs(n) < 0.01) return "0";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatUsd(value: number): string {
  if (value < 0.01) return "< $0.01";
  if (value < 1) return `$${value.toFixed(2)}`;
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
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
  /** Live oracle price for this collateral — drives the "today" leg of the
   * redemption P/L. */
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
        {groupChip}
        {style.badge ? (
          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>
            {style.label}
          </span>
        ) : (
          <span className={`text-sm font-medium ${style.color || "text-rb-500"}`}>{style.label}</span>
        )}
        <span className="ml-auto inline-flex items-center gap-2">
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

  const hasDebtChange = Math.abs(debtChange) >= 0.01;
  const hasCollChange = Math.abs(collChange) >= 0.01;
  const rateChanged = Math.abs(stateAfter.annualInterestRate - stateBefore.annualInterestRate) >= 0.0001;
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
          {groupChip}
          {ctx.operation === "setBatchManagerAnnualInterestRate" && stateAfter ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-400 text-xs font-bold">
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
                {stateAfter.annualInterestRate.toFixed(1)}%
              </span>
              {ctx.batchUpdate?.annualManagementFee != null && ctx.batchUpdate.annualManagementFee > 0 && (
                <span className="inline-block px-2 py-0.5 rounded-full border border-rb-400 dark:border-rb-600  text-xs font-medium">
                  + {ctx.batchUpdate.annualManagementFee.toFixed(2)} %
                </span>
              )}
              {ctx.batchManager && <span className="text-sm ">{getBatchManagerName(ctx.batchManager)}</span>}
            </>
          ) : ctx.operation === "setInterestBatchManager" ? (
            <>
              <span className="text-sm text-rb-500">{style.label}</span>
              {stateAfter.annualInterestRate > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-400 text-xs font-bold">
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
                  {stateAfter.annualInterestRate.toFixed(2)}%
                </span>
              )}
              {ctx.batchUpdate?.annualManagementFee != null && ctx.batchUpdate.annualManagementFee > 0 && (
                <span className="inline-block px-2 py-0.5 rounded-full border border-rb-400 dark:border-rb-600  text-xs font-medium">
                  + {ctx.batchUpdate.annualManagementFee.toFixed(2)} %
                </span>
              )}
              {ctx.batchManager && <span className="text-sm ">{getBatchManagerName(ctx.batchManager)}</span>}
            </>
          ) : ctx.operation === "openTrove" || ctx.operation === "openTroveAndJoinBatch" ? (
            <>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${style.bg} ${style.color}`}
              >
                {style.label}
              </span>
              {hasCollChange && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="text-rb-500">Supply</span>
                  <span className={`font-bold text-foreground ${hideVal}`}>{formatNumber(Math.abs(collChange))}</span>
                  <TokenChipIcon symbol={ctx.collateralType} size={16} />
                </span>
              )}
              {hasDebtChange && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="text-rb-500">Borrow</span>
                  <span className={`font-bold text-foreground ${hideVal}`}>{formatNumber(Math.abs(debtChange))}</span>
                  <TokenChipIcon symbol={ctx.assetType ?? "BOLD"} size={16} />
                </span>
              )}
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
                  <span className="text-rb-500">Cleared</span>
                  <span className={`font-bold text-foreground ${hideVal}`}>{formatNumber(Math.abs(collChange))}</span>
                  <TokenChipIcon symbol={ctx.collateralType} size={16} />
                </span>
              )}
              {hasDebtChange && (
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className="text-rb-500">Reduced</span>
                  <span className={`font-bold text-foreground ${hideVal}`}>{formatNumber(Math.abs(debtChange))}</span>
                  <TokenChipIcon symbol={ctx.assetType ?? "BOLD"} size={16} />
                </span>
              )}
            </>
          ) : style.badge ? (
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${style.bg} ${style.color} ${ctx.operation === "liquidate" ? "sm:hidden" : ""}`}
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
                        {formatNumber(Math.abs(collChange))}
                      </span>
                    )}
                    <TokenChipIcon symbol={ctx.collateralType} size={16} />
                    <span className="text-rb-500">{debtAction}</span>
                    {hasDebtChange && (
                      <span className={`font-bold text-foreground ${hideVal}`}>
                        {formatNumber(Math.abs(debtChange))}
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

          {/* Debt change (skip for open trove, redemption, delegate, and combined — shown inline or n/a) */}
          {hasDebtChange &&
            !style.label.includes(" + ") &&
            ctx.operation !== "openTrove" &&
            ctx.operation !== "openTroveAndJoinBatch" &&
            ctx.operation !== "redeemCollateral" &&
            ctx.operation !== "setInterestBatchManager" && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className={`font-bold text-foreground ${hideVal}`}>{formatNumber(Math.abs(debtChange))}</span>
                <TokenChipIcon symbol={ctx.assetType ?? "BOLD"} size={16} />
              </span>
            )}

          {/* Collateral change (skip for open trove, redemption, delegate, and combined) */}
          {hasCollChange &&
            !style.label.includes(" + ") &&
            ctx.operation !== "openTrove" &&
            ctx.operation !== "openTroveAndJoinBatch" &&
            ctx.operation !== "redeemCollateral" &&
            ctx.operation !== "setInterestBatchManager" && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className={`font-bold text-foreground ${hideVal}`}>{formatNumber(Math.abs(collChange))}</span>
                <TokenChipIcon symbol={ctx.collateralType} size={16} />
              </span>
            )}

          {/* Rate change value for interest rate operations */}
          {rateChanged && !hasDebtChange && !hasCollChange && ctx.operation !== "setBatchManagerAnnualInterestRate" && (
            <span className="text-sm font-bold text-foreground">{stateAfter.annualInterestRate.toFixed(1)}%</span>
          )}

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
            {rateChanged &&
              (ctx.operation === "adjustTroveInterestRate" ||
                ctx.operation === "setBatchManagerAnnualInterestRate" ||
                ctx.operation === "removeFromBatch") && (
                <span className="text-sm ">{stateAfter.annualInterestRate.toFixed(1)}% APR</span>
              )}
          </span>
          <span className="ml-auto inline-flex items-center gap-2">
            {ctx.operation === "redeemCollateral" && ctx.isZombieTrove && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-bold rounded bg-amber-500/15 text-amber-600 dark:text-amber-400"
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
            {timestamp > 0 && (
              <span className="text-xs ">
                <EventTime ts={timestamp} />
              </span>
            )}
            {counter}
          </span>
        </div>

        {/* Second row (redemptions) — claimable collateral + P/L (net
            outcome), sitting quietly beneath the Cleared / Reduced action
            line. P/L reconciles with those figures: debt cleared minus the
            value of collateral given up, shown at the redemption-time price
            and (when available) at today's price. */}
        {ctx.operation === "redeemCollateral" &&
          (() => {
            const showClaimable = ctx.isZombieTrove && stateAfter.debt === 0 && stateAfter.coll > 0;
            const histPrice = ctx.collateralPrice ?? 0;
            const debtCleared = Math.abs(debtChange);
            const collLost = Math.abs(collChange);
            const plHistoric = debtCleared - collLost * histPrice;
            const plToday = currentPrice ? debtCleared - collLost * currentPrice : null;
            const showPl = histPrice > 0 && debtCleared > 0.01;
            // Only surface "today" when it diverges from the historic figure.
            const showToday = plToday != null && Math.abs(plToday - plHistoric) > 0.01;
            const plStr = (n: number) => `${n >= 0 ? "+" : "−"}${formatUsd(Math.abs(n))}`;
            if (!showClaimable && !showPl) return null;
            return (
              <div className="flex items-center gap-4 flex-wrap mt-1.5 text-xs">
                {showClaimable && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`font-bold text-foreground ${hideVal}`}>{stateAfter.coll.toFixed(4)}</span>
                    <TokenChipIcon symbol={ctx.collateralType} size={14} />
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">claimable</span>
                  </span>
                )}
                {showPl && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-rb-500">P/L</span>
                    <span className={`font-bold text-foreground ${hideVal}`}>{plStr(plHistoric)}</span>
                    {showToday && (
                      <>
                        <span className="text-rb-500">or</span>
                        <span className={`font-bold text-foreground ${hideVal}`}>{plStr(plToday!)}</span>
                        <span className="text-rb-500">today</span>
                      </>
                    )}
                  </span>
                )}
              </div>
            );
          })()}
      </div>
    </>
  );
}
