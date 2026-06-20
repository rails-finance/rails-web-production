"use client";

import { type AaveSpokeCardInfo, liquidationBuffer } from "@/lib/aave-v4/spoke-cards";
import { PriceRunway } from "@/components/shared/price-runway";

/**
 * Liquidation runway for the active Aave V4 spoke — one bar answering "how close
 * is this to liquidation?" at a glance. Two modes, set by how many assets are
 * enabled as collateral (see `liquidationBuffer`); both feed the shared
 * `PriceRunway`, so the scaling, live marker, fixed-position liquidation zone,
 * ruler and offscreen/underwater handling are identical between them.
 *
 *   • Single collateral asset → a true PRICE runway: the asset's live price
 *     falling toward its liquidation price (`currentPrice / HF`, chain-truth, no
 *     LT table). The right caption shows that concrete price — clearer than a %
 *     when there's one asset.
 *   • Two or more collateral assets → a HEALTH-FACTOR runway: value = HF, the
 *     liquidation line = HF 1.0. No single asset's price (which would overstate
 *     safety for a correlated basket); the "% from liquidation" readout is the
 *     `1 − 1/HF` buffer.
 *
 * Either way the "% from liquidation" works out to `1 − 1/HF`, so the bar agrees
 * with the card's stat. Hidden when there's no debt (HF null).
 */
export function AaveV4SpokeRunway({ spoke }: { spoke: AaveSpokeCardInfo }) {
  const hf = spoke.healthFactor;
  if (spoke.totalDebtUsd <= 0 || hf == null) return null;

  const buf = liquidationBuffer(spoke);

  if (buf.single) {
    return (
      <div className="mt-2">
        <div className="mb-3 text-[11px] uppercase tracking-wider text-rb-500">Collateral price runway</div>
        <PriceRunway currentPrice={buf.single.currentPrice} liqPrice={buf.single.liqPrice} />
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="mb-3 text-[11px] uppercase tracking-wider text-rb-500">Liquidation runway</div>
      <PriceRunway
        currentPrice={hf}
        liqPrice={1}
        liqCaption="liquidation · HF 1.0"
        underwaterCaption="below HF 1.0"
      />
    </div>
  );
}
