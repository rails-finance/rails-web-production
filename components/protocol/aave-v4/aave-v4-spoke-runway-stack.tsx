"use client";

import { AaveV4PriceRunway } from "./aave-v4-price-runway";
import type { AaveSpokeCardInfo } from "@/lib/aave-v4/spoke-cards";
import { TOKEN_ADDR } from "@/lib/aave/prices";

/**
 * Stacked price-runway view for the active Aave V4 spoke. One runway row per
 * collateral asset, showing how far each asset's price can drop before the
 * spoke's HF would hit 1 (with all other assets held constant). Read-only —
 * no simulator inputs in this pass; that's gated behind a future "Simulate"
 * toggle.
 *
 * Hidden when the spoke has no debt (no liquidation risk to plot) or no
 * priced collateral assets reach a finite liq price.
 */
export function AaveV4SpokeRunwayStack({ spoke }: { spoke: AaveSpokeCardInfo }) {
  if (spoke.totalDebtUsd <= 0) return null;
  const rows = spoke.assetLiqPrices.filter((a) => a.usdShare > 1 && a.currentPrice > 0);
  if (rows.length === 0) return null;

  return (
    <div className="mt-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-rb-500">
          Liquidation runway
        </h3>
        <span className="text-[10px] text-rb-500">{spoke.name} spoke</span>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((row, idx) => (
          <AaveV4PriceRunway
            key={row.symbol}
            collateralSymbol={row.symbol}
            collateralAddress={TOKEN_ADDR[row.symbol]}
            currentPrice={row.currentPrice}
            liqPrice={row.liqPrice}
            showZoneLabels={idx === rows.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
