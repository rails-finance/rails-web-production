"use client";

import { AaveV4PriceRunway } from "./aave-v4-price-runway";
import type { AaveSpokeCardInfo } from "@/lib/aave-v4/spoke-cards";
import { TOKEN_ADDR } from "@/lib/aave/prices";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { fmtPrice } from "@/components/shared/price-pill";

/**
 * Runway row for a collateral asset with no finite liquidation price — it can't
 * trip a liquidation on its own, so there's nothing to anchor a bar on. Rather
 * than leave the row blank (which reads as broken), draw an explicit "covered"
 * state: a price marker, an unbounded neutral runway, and NO liquidation zone,
 * with a one-line readout.
 *
 *   - `overCovered` (liqPrice === 0): debt exists, but the rest of the collateral
 *     already covers it — this asset could fall to zero without liquidation.
 *   - otherwise (liqPrice === null): the asset isn't enabled as collateral, so it
 *     doesn't back the debt or affect the liquidation point at all.
 */
function CoveredRunway({ overCovered }: { overCovered: boolean }) {
  return (
    <div style={{ paddingTop: 6 }}>
      {/* Live-price marker nub + an unbounded neutral runway. No red segment —
          there is no price at which this asset liquidates the position, so a
          liquidation zone would be a lie. */}
      <div className="flex" style={{ height: 10, gap: 1 }}>
        <div className="bg-blue-500 rounded-full" style={{ flexGrow: 4, flexBasis: 0 }} />
        <div className="bg-rb-200 dark:bg-rb-500/30 rounded-full" style={{ flexGrow: 96, flexBasis: 0 }} />
      </div>
      <div className="relative mt-2 h-4 text-[11px] tabular-nums text-rb-500">
        <span className="absolute left-0">
          {overCovered ? "Can fall to $0 — other collateral covers the debt" : "Not used as collateral"}
        </span>
        <span className="absolute right-0">no liquidation price</span>
      </div>
    </div>
  );
}

/**
 * Stacked price-runway view for the active Aave V4 spoke. One runway row per
 * collateral asset, showing how far each asset's price can drop before the
 * spoke's HF would hit 1 (with all other assets held constant). Read-only —
 * no simulator inputs in this pass; that's gated behind a future "Simulate"
 * toggle.
 *
 * Each bar is anchored on its asset's liquidation price (see `AaveV4PriceRunway`).
 * Assets with no finite liq price (the rest of the collateral over-covers the
 * debt, or the asset isn't collateral) render an explicit `CoveredRunway` row
 * rather than a blank. Hidden entirely when the spoke has no debt.
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
            {row.liqPrice != null && row.liqPrice > 0 ? (
              <AaveV4PriceRunway currentPrice={row.currentPrice} liqPrice={row.liqPrice} />
            ) : (
              <CoveredRunway overCovered={row.liqPrice === 0} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
