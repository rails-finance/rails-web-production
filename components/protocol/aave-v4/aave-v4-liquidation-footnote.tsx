"use client";

import type { LiquidationBuffer } from "@/lib/aave-v4/spoke-cards";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { fmtLiqPrice } from "@/lib/aave-v4/format";

/**
 * Compact liquidation read shown directly beneath the Health Factor stat — the
 * tangible restatement of HF, not a peer of it (the buffer is `1 − 1/HF`, the
 * single-asset price is `currentPrice / HF`). Single collateral asset → its
 * liquidation price (the token icon carries the asset identity, since the column
 * is labelled "Health Factor"); two or more → the `1 − 1/HF` combined-collateral
 * drop. Renders nothing when there's no debt or the position is already
 * liquidatable (the red HF value already says so).
 */
export function AaveV4LiquidationFootnote({ buf }: { buf: LiquidationBuffer }) {
  if (buf.dropPct == null || buf.liquidatable) return null;

  if (buf.single) {
    return (
      <div className="text-xs mt-0.5 text-rb-500 inline-flex items-center gap-1">
        Liquidates at
        <TokenChipIcon symbol={buf.single.symbol} size={14} filterable={false} />
        {fmtLiqPrice(buf.single.liqPrice)}
      </div>
    );
  }

  return <div className="text-xs mt-0.5 text-rb-500">Liquidates on a {buf.dropPct.toFixed(0)}% drop</div>;
}
