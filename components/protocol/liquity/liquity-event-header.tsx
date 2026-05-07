"use client";

import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { EventTime } from "@/components/shared/event-time";
import { useTimelineDisplay } from "@/components/shared/timeline-display-context";
import type { LiquityContext } from "@/lib/shared/types/protocols/liquity";
import { getBatchManagerName } from "@/lib/liquity/batch-managers";
import { usePreferences } from "@/lib/shared/preferences-context";
import { formatRatio, ratioLabelShort, ratioColorClass } from "@/lib/shared/ratio-format";
import { useHeaderValueHideClass } from "@/lib/shared/header-values";

const crColor = (cr: number) => ratioColorClass(cr);

type OperationStyle = { label: string; color: string; bg: string; badge: boolean };

function getOperationStyle(operation: string, ctx?: LiquityContext): OperationStyle {
  switch (operation) {
    case "openTrove":
    case "openTroveAndJoinBatch":
      return { label: "Open", color: "text-green-700 dark:text-green-400", bg: "bg-green-500/20", badge: true };
    case "closeTrove":
      return { label: "Close", color: "", bg: "bg-rb-500/20 dark:bg-rb-500/20", badge: true };
    case "liquidate":
      return { label: "Liquidated", color: "text-red-700 dark:text-red-400", bg: "bg-red-500/20", badge: true };
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
      return { label: "Redemption", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/20", badge: true };
    case "adjustZombieTrove":
    case "adjustUnredeemableZombieTrove":
      return { label: "Redeemed", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/20", badge: true };
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

const ACTOR_ROLE_STYLES: Record<string, { label: string; color: string }> = {
  owner: { label: "Owner", color: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30" },
  redeemer: { label: "Redeemer", color: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  liquidator: { label: "Liquidator", color: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30" },
  batch_manager: { label: "Delegate", color: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30" },
};

export interface LiquityEventHeaderProps {
  ctx: LiquityContext;
  timestamp: number;
  protocolId?: string;
}

export function LiquityEventHeader({ ctx, timestamp, protocolId }: LiquityEventHeaderProps) {
  const style = getOperationStyle(ctx.operation, ctx);
  const { stateBefore, stateAfter, troveOperation } = ctx;
  const { showTimestamps } = useTimelineDisplay();
  const { prefs } = usePreferences();
  const ratioMode = prefs.ratioMode;

  if (!stateAfter || !stateBefore) {
    return (
      <div className="flex items-center gap-2">
        {style.badge ? (
          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>{style.label}</span>
        ) : (
          <span className={`text-sm font-medium ${style.color || 'text-rb-500'}`}>{style.label}</span>
        )}
        {showTimestamps && (
          <span className="text-xs ">{new Date(timestamp * 1000).toLocaleDateString()}</span>
        )}
      </div>
    );
  }

  const debtChange = troveOperation
    ? troveOperation.debtChangeFromOperation + troveOperation.debtIncreaseFromRedist + troveOperation.debtIncreaseFromUpfrontFee
    : stateAfter.debt - stateBefore.debt;
  const collChange = troveOperation
    ? troveOperation.collChangeFromOperation + troveOperation.collIncreaseFromRedist
    : stateAfter.coll - stateBefore.coll;

  const hasDebtChange = Math.abs(debtChange) >= 0.01;
  const hasCollChange = Math.abs(collChange) >= 0.01;
  const rateChanged = Math.abs(stateAfter.annualInterestRate - stateBefore.annualInterestRate) >= 0.0001;
  const PASSIVE_OPS = new Set(["liquidate", "redeemCollateral", "applyPendingDebt", "adjustZombieTrove", "adjustUnredeemableZombieTrove"]);
  const hideVal = useHeaderValueHideClass({ isPassive: PASSIVE_OPS.has(ctx.operation) });

  return (
    <>
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Actor role badge (trove-centric view) */}
          {ctx.actorRole && ACTOR_ROLE_STYLES[ctx.actorRole] && (
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${ACTOR_ROLE_STYLES[ctx.actorRole].color}`}>
              {ACTOR_ROLE_STYLES[ctx.actorRole].label}
            </span>
          )}
          {ctx.operation === "setBatchManagerAnnualInterestRate" && stateAfter ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-400 text-xs font-bold">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                {(stateAfter.annualInterestRate * 100).toFixed(1)}%
              </span>
              {ctx.batchUpdate?.annualManagementFee != null && ctx.batchUpdate.annualManagementFee > 0 && (
                <span className="inline-block px-2 py-0.5 rounded-full border border-rb-400 dark:border-rb-600  text-xs font-medium">
                  + {(ctx.batchUpdate.annualManagementFee * 100).toFixed(1)} %
                </span>
              )}
              {ctx.batchManager && (
                <span className="text-sm ">{getBatchManagerName(ctx.batchManager)}</span>
              )}
            </>
          ) : ctx.operation === "setInterestBatchManager" ? (
            <>
              <span className="text-sm text-rb-500">{style.label}</span>
              {stateAfter.annualInterestRate > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-400 text-xs font-bold">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  {(stateAfter.annualInterestRate * 100).toFixed(2)}%
                </span>
              )}
              {ctx.batchUpdate?.annualManagementFee != null && ctx.batchUpdate.annualManagementFee > 0 && (
                <span className="inline-block px-2 py-0.5 rounded-full border border-rb-400 dark:border-rb-600  text-xs font-medium">
                  + {(ctx.batchUpdate.annualManagementFee * 100).toFixed(1)} %
                </span>
              )}
              {ctx.batchManager && (
                <span className="text-sm ">{getBatchManagerName(ctx.batchManager)}</span>
              )}
            </>
          ) : (ctx.operation === "openTrove" || ctx.operation === "openTroveAndJoinBatch") ? (
            <>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${style.bg} ${style.color}`}>
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
          ) : style.badge ? (
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${style.bg} ${style.color}`}>
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
                      <span className={`font-bold text-foreground ${hideVal}`}>{formatNumber(Math.abs(collChange))}</span>
                    )}
                    <TokenChipIcon symbol={ctx.collateralType} size={16} />
                    <span className="text-rb-500">{debtAction}</span>
                    {hasDebtChange && (
                      <span className={`font-bold text-foreground ${hideVal}`}>{formatNumber(Math.abs(debtChange))}</span>
                    )}
                    <TokenChipIcon symbol={ctx.assetType ?? "BOLD"} size={16} />
                  </span>
                );
              })()}
            </>
          ) : (
            <span className="text-sm text-rb-500">
              {style.label}
            </span>
          )}

          {/* Debt change (skip for open trove and combined — already shown inline) */}
          {hasDebtChange && !style.label.includes(" + ") && ctx.operation !== "openTrove" && ctx.operation !== "openTroveAndJoinBatch" && (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span className={`font-bold text-foreground ${hideVal}`}>
                {formatNumber(Math.abs(debtChange))}
              </span>
              <TokenChipIcon symbol={ctx.assetType ?? "BOLD"} size={16} />
            </span>
          )}

          {/* Collateral change (skip for open trove and combined) */}
          {hasCollChange && !style.label.includes(" + ") && ctx.operation !== "openTrove" && ctx.operation !== "openTroveAndJoinBatch" && (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span className={`font-bold text-foreground ${hideVal}`}>
                {formatNumber(Math.abs(collChange))}
              </span>
              <TokenChipIcon symbol={ctx.collateralType} size={16} />
            </span>
          )}

          {/* Rate change value for interest rate operations */}
          {rateChanged && !hasDebtChange && !hasCollChange && ctx.operation !== "setBatchManagerAnnualInterestRate" && (
            <span className="text-sm font-bold text-foreground">
              {(stateAfter.annualInterestRate * 100).toFixed(1)}%
            </span>
          )}

          {/* Right side: CR (rate only on rate-change operations) */}
          <span className="inline-flex items-center gap-1.5">
            {stateAfter.collateralRatio > 0 && (
              <span className={`text-xs ${crColor(stateAfter.collateralRatio)}`}>
                {formatRatio(stateAfter.collateralRatio, ratioMode, 0)} {ratioLabelShort(ratioMode)}
              </span>
            )}
            {rateChanged && (ctx.operation === "adjustTroveInterestRate" || ctx.operation === "setBatchManagerAnnualInterestRate" || ctx.operation === "setInterestBatchManager" || ctx.operation === "removeFromBatch") && (
              <span className="text-sm ">
                {(stateAfter.annualInterestRate * 100).toFixed(1)}% APR
              </span>
            )}
          </span>
          {timestamp > 0 && (
            <span className="ml-auto text-xs ">
              <EventTime ts={timestamp} />
            </span>
          )}
        </div>
      </div>
    </>
  );
}
