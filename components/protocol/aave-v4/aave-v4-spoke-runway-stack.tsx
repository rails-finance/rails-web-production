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
 * Aggregate runway for the spoke when no single collateral asset is the binding
 * constraint — every per-asset row reads "can fall to $0 — other collateral
 * covers the debt", which is true asset-by-asset but reads as "nothing can
 * liquidate this" if you stop there. The honest joint scenario is a *correlated*
 * drop: every collateral asset falling together. That trips at the blended
 * liquidation point, which is exactly where HF hits 1, i.e. when collateral
 * value falls to `1 / HF` of today's — a uniform drop of `(1 − 1/HF)`.
 *
 * Drawn as one bar: a "now" marker at the left edge, neutral headroom across the
 * fall, and the red liquidation zone beyond the blended threshold. No per-asset
 * price axis (the move is a percentage applied to all collateral at once), so
 * the only readout is the drop the whole basket has to take.
 */
function BlendedRunway({ healthFactor }: { healthFactor: number }) {
  // Uniform fall (as a % of current value) that takes HF from its current value
  // down to 1.0. liqPos = where the threshold lands on a 100%(now) → 0%(wiped
  // out) axis; the red zone is everything past it.
  const dropPct = Math.max(0, Math.min(100, (1 - 1 / healthFactor) * 100));
  const liqPos = dropPct; // now sits at the left edge (0%), $0 collateral at the right (100%)

  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-foreground">All collateral</span>
        <span className="text-[12px] text-rb-500">falling together</span>
      </div>
      <div style={{ paddingTop: 6 }}>
        {/* now-marker nub → neutral headroom → red liquidation zone. The red is
            the one factual-liquidation colour, same as the per-asset bars. */}
        <div className="flex" style={{ height: 10, gap: 1 }}>
          <div className="bg-blue-500 rounded-full" style={{ flexGrow: 2, flexBasis: 0 }} />
          <div
            className="bg-rb-200 dark:bg-rb-500/30 rounded-full"
            style={{ flexGrow: Math.max(0, liqPos - 2), flexBasis: 0 }}
          />
          <div
            className="bg-red-400/60 dark:bg-red-500/40 rounded-full"
            style={{ flexGrow: 100 - liqPos, flexBasis: 0 }}
          />
        </div>
        <div className="relative mt-2 h-4 text-[11px] tabular-nums text-rb-500">
          <span className="absolute left-0">a correlated drop still liquidates</span>
          <span className="absolute right-0">liquidates at −{Math.round(dropPct)}%</span>
        </div>
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
 *
 * When *no* single asset is the binding constraint — every collateral row is
 * over-covered, so each one reads "can fall to $0" in isolation — the per-asset
 * stack is degenerate: read alone it implies the position can't be liquidated,
 * which is false. A `BlendedRunway` row is appended in that case to carry the one
 * honest figure the per-asset bars can't: the uniform, correlated drop across all
 * collateral that does trip liquidation (HF → 1, a fall to `1/HF` of today).
 */
export function AaveV4SpokeRunwayStack({ spoke }: { spoke: AaveSpokeCardInfo }) {
  if (spoke.totalDebtUsd <= 0) return null;
  const rows = spoke.assetLiqPrices.filter((a) => a.usdShare > 1 && a.currentPrice > 0);
  if (rows.length === 0) return null;

  // Degenerate case: not one displayed asset has a finite liquidation price, so
  // every bar is a "covered" row and the only real constraint is a joint drop.
  const noBindingAsset = rows.every((a) => !(a.liqPrice != null && a.liqPrice > 0));
  const showBlended = noBindingAsset && spoke.healthFactor != null && spoke.healthFactor > 1;

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

        {showBlended && (
          <div className="mt-1 border-t border-rb-200 pt-3 dark:border-rb-500/20">
            <BlendedRunway healthFactor={spoke.healthFactor!} />
          </div>
        )}
      </div>
    </div>
  );
}
