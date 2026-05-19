"use client";

// LlamaLend event header — action pill + amount(s) + family tag + timestamp.
// Mirrors AaveV4EventHeader / LiquityEventHeader shape so the universal
// EventCard chrome stays visually consistent across protocols.

import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { formatNum } from "@/lib/shared/format-event";
import { useHeaderValueHideClass } from "@/lib/shared/header-values";
import { EventTime } from "@/components/shared/event-time";
import type { LlamalendContext } from "@/lib/shared/types/protocols/llamalend";

type OperationStyle = { label: string; color: string; bg: string; badge: boolean };

const STYLES: Record<string, OperationStyle> = {
  open:              { label: "Open",              color: "text-emerald-400", bg: "bg-emerald-500/20", badge: true  },
  close:             { label: "Close",             color: "", bg: "", badge: false },
  borrow:            { label: "Borrow",            color: "", bg: "", badge: false },
  repay:             { label: "Repay",             color: "", bg: "", badge: false },
  remove_collateral: { label: "Remove Collateral", color: "", bg: "", badge: false },
  liquidate:         { label: "Liquidation",       color: "text-red-400",     bg: "bg-red-500/20",     badge: true  },
  liquidated:        { label: "Liquidated",        color: "text-red-400",     bg: "bg-red-500/20",     badge: true  },
  soft_liquidated:   { label: "Soft Liquidated",   color: "text-orange-400",  bg: "bg-orange-500/20",  badge: true  },
};

export interface LlamalendEventHeaderProps {
  ctx: LlamalendContext;
  timestamp: number;
}

export function LlamalendEventHeader({ ctx, timestamp }: LlamalendEventHeaderProps) {
  const style = STYLES[ctx.eventType] ?? { label: ctx.eventType, color: "", bg: "", badge: false };
  const isPassive = ctx.eventType === "liquidated" || ctx.eventType === "soft_liquidated";
  const hideVal = useHeaderValueHideClass({ isPassive });

  // Choose the primary amount + symbol to surface in the header. For mixed
  // borrow/repay flows we prefer the debt side; for collateral-only flows
  // (remove_collateral, open without borrow) we surface the collateral side.
  const collDelta = parseFloat(ctx.deltaCollateral ?? "0") || 0;
  const debtDelta = parseFloat(ctx.deltaDebt ?? "0") || 0;
  const useDebt = Math.abs(debtDelta) >= 0.0001;
  const useColl = Math.abs(collDelta) >= 0.0001;
  const primaryAmt = useDebt ? Math.abs(debtDelta) : useColl ? Math.abs(collDelta) : 0;
  const primarySym = useDebt
    ? (ctx.borrowedSymbol ?? "?")
    : useColl
      ? (ctx.collateralSymbol ?? "?")
      : (ctx.borrowedSymbol ?? ctx.collateralSymbol ?? "?");
  const familyTag = ctx.family === "mint" ? "crvUSD mint" : "LlamaLend";

  return (
    <div className="px-5 pt-4 pb-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {style.badge ? (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${style.bg} ${style.color}`}>
            {style.label}
          </span>
        ) : (
          <span className="text-sm text-rb-500">{style.label}</span>
        )}
        {primaryAmt > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className={`font-bold text-foreground ${hideVal}`}>{formatNum(primaryAmt)}</span>
            <TokenChipIcon symbol={primarySym} size={16} />
          </span>
        )}
        {ctx.collateralSymbol && ctx.borrowedSymbol && (
          <span className="text-xs text-rb-500">
            ·&nbsp;{ctx.collateralSymbol} / {ctx.borrowedSymbol}
          </span>
        )}
        <span className="text-xs text-rb-500/70">·&nbsp;{familyTag}</span>
        {ctx.positionEpoch && ctx.positionEpoch > 1 ? (
          <span className="text-xs text-rb-500/70">·&nbsp;epoch {ctx.positionEpoch}</span>
        ) : null}
        {timestamp > 0 && (
          <span className="ml-auto text-xs">
            <EventTime ts={timestamp} />
          </span>
        )}
      </div>
    </div>
  );
}
