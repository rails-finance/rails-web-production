"use client";

// LlamaLend event detail panel — collateral / debt before→after rows, band
// range, and liquidation breakdown. Mirrors AaveV4EventDetail's layout so
// the universal EventCard chrome reads uniformly across protocols.
//
// Bands visualization (C2) renders in the header via the bars slot, not here.
// USD price chips are gated on the categorical-pricing pipeline landing for
// LlamaLend (no per-event price on the wire yet) — intentionally omitted.

import type { LlamalendContext } from "@/lib/shared/types/protocols/llamalend";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { shortAddr } from "@/lib/shared/format-event";
import { TransitionArrow as SharedTransitionArrow } from "@/components/shared/state-transition";
import { useTimelineDisplay } from "@/components/shared/timeline-display-context";

function fmt(v: string | number | undefined): string {
  if (v == null || v === "") return "0";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "0";
  if (Math.abs(n) < 0.0001) return "0";
  if (Math.abs(n) >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

const TransitionArrow = () => <SharedTransitionArrow size="sm" />;

export interface LlamalendEventDetailProps {
  ctx: LlamalendContext;
  txHash: string;
  wallet: string;
}

function PositionRow({
  symbol,
  amount,
  before,
  isChanged,
}: {
  symbol: string;
  amount: string;
  before?: string;
  isChanged: boolean;
}) {
  const { showTickerLabels } = useTimelineDisplay();
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {isChanged && before != null ? (
        <>
          <span className="text-rb-500">{fmt(before)}</span>
          <TransitionArrow />
          <span className="font-bold">{fmt(amount)}</span>
        </>
      ) : (
        <span className="font-bold">{fmt(amount)}</span>
      )}
      <TokenChipIcon symbol={symbol} size={16} />
      {showTickerLabels && <span className="text-xs">{symbol}</span>}
    </span>
  );
}

export function LlamalendEventDetail({ ctx }: LlamalendEventDetailProps) {
  const isLiquidated = ctx.eventType === "liquidated" || ctx.eventType === "liquidate";
  const isSoftLiq = ctx.eventType === "soft_liquidated";
  const collSym = ctx.collateralSymbol ?? "?";
  const debtSym = ctx.borrowedSymbol ?? "?";

  const collBefore = ctx.collateralBefore;
  const collAfter = ctx.collateralAfter;
  const debtBefore = ctx.debtBefore;
  const debtAfter = ctx.debtAfter;

  const collDelta = parseFloat(ctx.deltaCollateral ?? "0") || 0;
  const debtDelta = parseFloat(ctx.deltaDebt ?? "0") || 0;
  const collChanged = Math.abs(collDelta) > 0.0001 || isLiquidated;
  const debtChanged = Math.abs(debtDelta) > 0.0001 || isLiquidated;

  const collAfterVal = parseFloat(collAfter ?? "0");
  const debtAfterVal = parseFloat(debtAfter ?? "0");
  const collBeforeVal = parseFloat(collBefore ?? "0");
  const debtBeforeVal = parseFloat(debtBefore ?? "0");
  const hasColl = collAfterVal > 0.0001 || collBeforeVal > 0.0001;
  const hasDebt = debtAfterVal > 0.0001 || debtBeforeVal > 0.0001;

  return (
    <>
      {/* Liquidation breakdown */}
      {isLiquidated && (
        <div className="grid grid-cols-2 gap-2 px-5 py-2 text-sm">
          {ctx.debtCleared && (
            <div className="flex flex-col">
              <span className="text-rb-500 text-xs font-semibold">Debt Cleared</span>
              <span className="font-bold text-red-400">{fmt(ctx.debtCleared)} {debtSym}</span>
            </div>
          )}
          {ctx.collateralReceived && parseFloat(ctx.collateralReceived) > 0 && (
            <div className="flex flex-col">
              <span className="text-rb-500 text-xs font-semibold">Collateral Returned</span>
              <span className="font-bold">{fmt(ctx.collateralReceived)} {collSym}</span>
            </div>
          )}
          {ctx.stablecoinReceived && parseFloat(ctx.stablecoinReceived) > 0 && (
            <div className="flex flex-col">
              <span className="text-rb-500 text-xs font-semibold">Residual Stablecoin</span>
              <span className="font-bold">{fmt(ctx.stablecoinReceived)} {debtSym}</span>
            </div>
          )}
          {ctx.liquidator && (
            <div className="flex flex-col col-span-2">
              <span className="">Liquidator</span>
              <span className="font-mono text-xs">{shortAddr(ctx.liquidator)}</span>
            </div>
          )}
        </div>
      )}

      {/* Soft-liquidation summary (B2 will populate liquidationCount / range) */}
      {isSoftLiq && ctx.liquidationCount && ctx.liquidationCount > 0 && (
        <div className="px-5 py-2 text-sm">
          <span className="text-rb-500">Soft-liq events: </span>
          <span className="font-bold text-orange-400">{ctx.liquidationCount}</span>
        </div>
      )}

      {/* Position snapshot */}
      {(hasColl || hasDebt) && (
        <div className="px-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hasColl && (
              <div>
                <div className="text-rb-500 text-xs font-semibold mb-1.5">Collateral</div>
                <PositionRow
                  symbol={collSym}
                  amount={collAfter ?? "0"}
                  before={collChanged ? collBefore : undefined}
                  isChanged={collChanged}
                />
              </div>
            )}
            {hasDebt && (
              <div>
                <div className="text-rb-500 text-xs font-semibold mb-1.5">Debt</div>
                <PositionRow
                  symbol={debtSym}
                  amount={debtAfter ?? "0"}
                  before={debtChanged ? debtBefore : undefined}
                  isChanged={debtChanged}
                />
              </div>
            )}
          </div>
          {(ctx.n1 || ctx.n2) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3 pt-3 border-t border-rb-200/40 dark:border-rb-800/40">
              <div>
                <div className="text-rb-500 text-xs font-semibold mb-1">Band Range</div>
                <div className="text-sm font-bold tabular-nums">
                  {ctx.n1 ?? "?"} → {ctx.n2 ?? "?"}
                </div>
              </div>
              {ctx.n1Before && ctx.n2Before && (ctx.n1Before !== ctx.n1 || ctx.n2Before !== ctx.n2) && (
                <div>
                  <div className="text-rb-500 text-xs font-semibold mb-1">Bands Before</div>
                  <div className="text-sm tabular-nums text-rb-500">
                    {ctx.n1Before} → {ctx.n2Before}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
