"use client";

import { AaveV4PriceRunway } from "./aave-v4-price-runway";
import type { AaveSpokeCardInfo } from "@/lib/aave-v4/spoke-cards";
import { TOKEN_ADDR } from "@/lib/aave/prices";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { fmtPrice } from "@/components/shared/price-pill";

/**
 * Stacked price-runway view for the active Aave V4 spoke. One runway row per
 * collateral asset, showing how far each asset's price can drop before the
 * spoke's HF would hit 1 (with all other assets held constant). Read-only —
 * no simulator inputs in this pass; that's gated behind a future "Simulate"
 * toggle.
 *
 * Each bar is anchored on its asset's liquidation price (see
 * `AaveV4PriceRunway`). Hidden when the spoke has no debt (no liquidation risk
 * to plot) or no priced collateral assets reach a finite liq price.
 */
export function AaveV4SpokeRunwayStack({ spoke }: { spoke: AaveSpokeCardInfo }) {
  if (spoke.totalDebtUsd <= 0) return null;
  const rows = spoke.assetLiqPrices.filter((a) => a.usdShare > 1 && a.currentPrice > 0);
  if (rows.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="mb-3 text-[11px] uppercase tracking-wider text-rb-500">Collateral price runways</div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.symbol} className="grid grid-cols-[110px_1fr] items-center gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                <TokenChipIcon symbol={row.symbol} address={TOKEN_ADDR[row.symbol]} size={18} filterable={false} />
                {row.symbol}
              </span>
              <span className="text-[12px] tabular-nums text-rb-500">{fmtPrice(row.currentPrice)}</span>
            </div>
            <AaveV4PriceRunway currentPrice={row.currentPrice} liqPrice={row.liqPrice} />
          </div>
        ))}
      </div>
    </div>
  );
}
