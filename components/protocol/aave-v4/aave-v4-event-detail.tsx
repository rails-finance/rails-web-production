"use client";

import type { AaveV4Context } from "@/lib/shared/types/protocols/aave-v4";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { shortAddr } from "@/lib/shared/format-event";
import { usePreferences } from "@/lib/shared/preferences-context";
import { formatRatio, ratioLabel, ratioColorClass } from "@/lib/shared/ratio-format";
import { TransitionArrow as SharedTransitionArrow } from "@/components/shared/state-transition";
import { resolvePrice } from "@/lib/aave/prices";
import { usePrices } from "@/lib/shared/prices-context";
import { useTimelineDisplay } from "@/components/shared/timeline-display-context";

function fmt(v: string | number | undefined): string {
  if (!v) return "0";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "0";
  if (Math.abs(n) < 0.0001) return "0";
  if (Math.abs(n) >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

const TransitionArrow = () => <SharedTransitionArrow size="sm" />;

export interface AaveV4EventDetailProps {
  ctx: AaveV4Context;
  txHash: string;
  wallet: string;
}

/** Render a single position row — with before→after if this asset changed, static otherwise.
 *  Icon trails the value; ticker text only renders when the display toggle is on. */
function PositionRow({ symbol, amount, before, isChanged }: { symbol: string; amount: string; before?: string; isChanged: boolean }) {
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

export function AaveV4EventDetail({ ctx }: AaveV4EventDetailProps) {
  const { prefs } = usePreferences();
  const ratioMode = prefs.ratioMode;
  const prices = usePrices();
  const token = ctx.reserveSymbol ?? "???";
  const isLiq = ctx.eventType === "liquidation";
  const isToggle = ctx.eventType === "collateral_toggle";

  const isSupplySide = ctx.eventType === "supply" || ctx.eventType === "withdraw";
  const isDebtSide = ctx.eventType === "borrow" || ctx.eventType === "repay";

  const supplyBeforeVal = parseFloat(ctx.supplyBefore ?? "0");
  const supplyAfterVal = parseFloat(ctx.supplyAfter ?? "0");
  const debtBeforeVal = parseFloat(ctx.debtBefore ?? "0");
  const debtAfterVal = parseFloat(ctx.debtAfter ?? "0");
  const hasOldSupply = (supplyBeforeVal > 0.0001 || supplyAfterVal > 0.0001);
  const hasOldDebt = (debtBeforeVal > 0.0001 || debtAfterVal > 0.0001);
  const baseSupplies = ctx.allSupplies?.length
    ? ctx.allSupplies
    : (isSupplySide || isLiq) && hasOldSupply
      ? [{ symbol: isLiq ? (ctx.collateralSymbol ?? token) : token, amount: ctx.supplyAfter ?? "0" }]
      : [];
  const baseDebts = ctx.allDebts?.length
    ? ctx.allDebts
    : (isDebtSide || isLiq) && hasOldDebt
      ? [{ symbol: token, amount: ctx.debtAfter ?? "0" }]
      : [];

  const supplyChangeSym = isLiq ? ctx.collateralSymbol : token;
  const supplyZeroOut = (isSupplySide || isLiq) && supplyChangeSym && supplyAfterVal <= 0.0001 && supplyBeforeVal > 0.0001
    && !baseSupplies.some(s => s.symbol === supplyChangeSym);
  const supplies = supplyZeroOut
    ? [...baseSupplies, { symbol: supplyChangeSym!, amount: ctx.supplyAfter ?? "0" }]
    : baseSupplies;

  const debtZeroOut = (isDebtSide || isLiq) && debtAfterVal <= 0.0001 && debtBeforeVal > 0.0001
    && !baseDebts.some(d => d.symbol === token);
  const debts = debtZeroOut
    ? [...baseDebts, { symbol: token, amount: ctx.debtAfter ?? "0" }]
    : baseDebts;
  const hasSupplies = supplies.length > 0;
  const hasDebts = debts.length > 0;

  const supplyBefore = ctx.supplyBefore;
  const debtBefore = ctx.debtBefore;

  // Without prices, totals come out 0 and the ratio panel hides. v1 ships
  // without live pricing — `usePrices()` is a stub returning {}.
  const getPrice = (sym: string) => resolvePrice(sym, prices) ?? 0;
  const totalSupplyUsd = supplies.reduce((s, p) => s + parseFloat(p.amount) * getPrice(p.symbol), 0);
  const totalDebtUsd = debts.reduce((s, p) => s + parseFloat(p.amount) * getPrice(p.symbol), 0);
  const collRatio = totalDebtUsd > 0 ? totalSupplyUsd / totalDebtUsd : 0;
  const showRatio = hasSupplies && hasDebts && totalDebtUsd > 0.01;

  return (
    <>
      {/* Collateral toggle status */}
      {isToggle && (
        <div className="px-5 py-2 text-sm">
          <span className={`font-bold ${ctx.enabled ? "text-green-400" : ""}`}>
            {ctx.enabled ? "Enabled as collateral" : "Disabled as collateral"}
          </span>
        </div>
      )}

      {/* Liquidation breakdown */}
      {isLiq && (
        <div className="grid grid-cols-2 gap-2 px-5 py-2 text-sm">
          {ctx.debtToCover && (
            <div className="flex flex-col">
              <span className="text-rb-500 text-xs font-semibold">Debt Covered</span>
              <span className="font-bold text-red-400">{fmt(ctx.debtToCover)} {token}</span>
            </div>
          )}
          {ctx.liquidatedCollateralAmount && ctx.collateralSymbol && (
            <div className="flex flex-col">
              <span className="text-rb-500 text-xs font-semibold">Collateral Seized</span>
              <span className="font-bold text-red-400">{fmt(ctx.liquidatedCollateralAmount)} {ctx.collateralSymbol}</span>
            </div>
          )}
          {ctx.liquidator && (
            <div className="flex flex-col col-span-2">
              <span className="">Liquidator</span>
              <span className="font-mono  text-xs">{shortAddr(ctx.liquidator)}</span>
            </div>
          )}
        </div>
      )}

      {/* Full position snapshot — supply, debt, and collateral ratio */}
      {(hasSupplies || hasDebts) && (
        <div className="px-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hasSupplies && (
              <div>
                <div className="text-rb-500 text-xs font-semibold mb-1.5">Collateral</div>
                <div className="flex flex-col gap-1">
                  {supplies.map(s => (
                    <PositionRow
                      key={s.symbol}
                      symbol={s.symbol}
                      amount={s.amount}
                      before={(isSupplySide || isLiq) && s.symbol === (isLiq ? ctx.collateralSymbol : token) ? supplyBefore : undefined}
                      isChanged={(isSupplySide || isLiq) && s.symbol === (isLiq ? ctx.collateralSymbol : token)}
                    />
                  ))}
                </div>
              </div>
            )}
            {hasDebts && (
              <div>
                <div className="text-rb-500 text-xs font-semibold mb-1.5">Debt</div>
                <div className="flex flex-col gap-1">
                  {debts.map(d => (
                    <PositionRow
                      key={d.symbol}
                      symbol={d.symbol}
                      amount={d.amount}
                      before={(isDebtSide || isLiq) && d.symbol === token ? debtBefore : undefined}
                      isChanged={(isDebtSide || isLiq) && d.symbol === token}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          {(showRatio || ctx.supplyAPR || ctx.borrowAPR) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3 pt-3 border-t border-rb-200/40 dark:border-rb-800/40">
              {showRatio && (
                <div>
                  <div className="text-rb-500 text-xs font-semibold mb-1">{ratioLabel(ratioMode)}</div>
                  <div className={`text-sm font-bold ${ratioColorClass(collRatio * 100, { danger: 120, warn: 150, warnClass: "text-amber-400", safeClass: "" })}`}>
                    {formatRatio(collRatio * 100, ratioMode, 0)}
                  </div>
                </div>
              )}
              {(ctx.supplyAPR || ctx.borrowAPR) && (
                <div>
                  <div className="text-rb-500 text-xs font-semibold mb-1">{ctx.supplyAPR ? "Supply Rate" : "Borrow Rate"}</div>
                  <div className="text-sm font-bold">
                    {((parseFloat(ctx.supplyAPR ?? ctx.borrowAPR ?? "0")) * 100).toFixed(2)}%
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
