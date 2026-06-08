"use client";

import { AaveV4PriceRunway } from "./aave-v4-price-runway";
import type { AaveSpokeCardInfo } from "@/lib/aave-v4/spoke-cards";
import { TOKEN_ADDR } from "@/lib/aave/prices";
import { usePreferences } from "@/lib/shared/preferences-context";

/**
 * Stacked price-runway view for the active Aave V4 spoke. One runway row per
 * collateral asset, showing how far each asset's price can drop before the
 * spoke's HF would hit 1 (with all other assets held constant). Read-only —
 * no simulator inputs in this pass; that's gated behind a future "Simulate"
 * toggle.
 *
 * The Conservative→Caution boundary is driven by the user's global Aave V4
 * headroom preference (`aaveV4.headroomConservativeMin`) — the per-row
 * threshold is `liqPrice × (1 + headroom/100)`. Update the value via the cog
 * on the Aave V4 entry in the protocol menu; the runway recolours as you
 * tune it.
 *
 * Hidden when the spoke has no debt (no liquidation risk to plot) or no
 * priced collateral assets reach a finite liq price.
 */
export function AaveV4SpokeRunwayStack({ spoke }: { spoke: AaveSpokeCardInfo }) {
  const { prefs } = usePreferences();
  const headroomPct = prefs.aaveV4.headroomConservativeMin;

  if (spoke.totalDebtUsd <= 0) return null;
  const rows = spoke.assetLiqPrices.filter((a) => a.usdShare > 1 && a.currentPrice > 0);
  if (rows.length === 0) return null;

  return (
    <div className="mt-4 p-4">
      <div className="flex flex-col gap-3">
        {rows.map((row, idx) => {
          const thresholdPrice = row.liqPrice && row.liqPrice > 0 ? row.liqPrice * (1 + headroomPct / 100) : undefined;
          return (
            <AaveV4PriceRunway
              key={row.symbol}
              collateralSymbol={row.symbol}
              collateralAddress={TOKEN_ADDR[row.symbol]}
              currentPrice={row.currentPrice}
              liqPrice={row.liqPrice}
              thresholdPrice={thresholdPrice}
              showZoneLabels={idx === rows.length - 1}
            />
          );
        })}
      </div>
    </div>
  );
}
