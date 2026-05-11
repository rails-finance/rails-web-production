"use client";

import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { formatNum, formatUsd } from "@/lib/shared/format-event";
import { useHeaderValueHideClass } from "@/lib/shared/header-values";
import { EventTime } from "@/components/shared/event-time";
import type { AaveV4Context, AaveV4PriceSource } from "@/lib/shared/types/protocols/aave-v4";

/** Render an inline USD chip for a token flow. The number is `amount × usd`;
 *  source drives the qualifier — protocol-faithful prices show no prefix,
 *  approximations are marked `≈`. Returns null when there's nothing to show
 *  (no price row in the cache, or amount = 0). */
function UsdChip({
  amount,
  usd,
  source,
  symbol,
}: {
  amount: number;
  usd: number;
  source: AaveV4PriceSource;
  symbol: string;
}) {
  if (!(amount > 0) || !(usd > 0)) return null;
  const value = amount * usd;
  const approx = source !== "iaave-oracle";
  const sourceLabel =
    source === "iaave-oracle" ? "IAaveOracle at block"
    : source === "stablecoin" ? "stablecoin (pinned to $1)"
    : "DefiLlama at block";
  return (
    <span
      className="inline-flex items-center text-xs text-rb-500 tabular-nums"
      title={`${approx ? "Approx. " : ""}${formatUsd(value)} (${formatUsd(usd)} / ${symbol}, ${sourceLabel})`}
    >
      {approx ? "≈" : ""}{formatUsd(value)}
    </span>
  );
}

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
}

export function AaveV4EventHeader({ ctx, timestamp }: AaveV4EventHeaderProps) {
  const style = STYLES[ctx.eventType] ?? { label: ctx.eventType, color: "", bg: "", badge: false };
  const amount = parseFloat(ctx.amount ?? "0") || 0;
  const hideVal = useHeaderValueHideClass({ isPassive: ctx.eventType === "liquidation" });

  // For collateral toggle, show enable/disable
  const label = ctx.eventType === "collateral_toggle"
    ? (ctx.enabled ? "Enable Collateral" : "Disable Collateral")
    : style.label;

  return (
    <div className="px-5 pt-4 pb-3">
      <div className="flex items-center gap-1.5 flex-wrap">
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
            {ctx.price && (
              <UsdChip
                amount={amount}
                usd={ctx.price.usd}
                source={ctx.price.source}
                symbol={ctx.reserveSymbol ?? "???"}
              />
            )}
          </span>
        )}
        {ctx.eventType === "collateral_toggle" && ctx.reserveSymbol && (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <TokenChipIcon symbol={ctx.reserveSymbol} size={16} />
            <span className="">{ctx.reserveSymbol}</span>
          </span>
        )}
        {(ctx.supplyAPR || ctx.borrowAPR) && (
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-rb-300/60 dark:bg-rb-800/60 ">
            {((parseFloat(ctx.supplyAPR ?? ctx.borrowAPR ?? "0")) * 100).toFixed(2)}%
          </span>
        )}
        {ctx.eventType === "liquidation" && ctx.debtToCover && (
          <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
            <span>Debt covered: {formatNum(ctx.debtToCover)} {ctx.reserveSymbol}</span>
            {ctx.debtPrice && (
              <UsdChip
                amount={parseFloat(ctx.debtToCover)}
                usd={ctx.debtPrice.usd}
                source={ctx.debtPrice.source}
                symbol={ctx.reserveSymbol ?? "???"}
              />
            )}
          </span>
        )}
        {ctx.eventType === "liquidation" && ctx.liquidatedCollateralAmount && ctx.collateralSymbol && (
          <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
            <span>Seized: {formatNum(ctx.liquidatedCollateralAmount)} {ctx.collateralSymbol}</span>
            {ctx.collateralPrice && (
              <UsdChip
                amount={parseFloat(ctx.liquidatedCollateralAmount)}
                usd={ctx.collateralPrice.usd}
                source={ctx.collateralPrice.source}
                symbol={ctx.collateralSymbol}
              />
            )}
          </span>
        )}
        {ctx.spokeName && (
          <span className="text-xs text-rb-500">·&nbsp;{ctx.spokeName}</span>
        )}
        {timestamp > 0 && (
          <span className="ml-auto text-xs ">
            <EventTime ts={timestamp} />
          </span>
        )}
      </div>
    </div>
  );
}
