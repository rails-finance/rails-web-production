"use client";

// Plain-language collateral-exposure line for the active Aave V4 position.
// Sits above the price runways in the economics band as a one-sentence read of
// what the collateral is made of (class shares, asset count, blended LT).
// Descriptive and neutral by design — see lib/aave-v4/position-exposure.

import { type PriceEntry, resolvePrice } from "@/lib/aave/prices";
import type { ReserveStats } from "@/lib/aave-v4/spoke-cards";
import { AAVE_V4_FALLBACK_LT } from "@/lib/aave-v4/liquidation-thresholds";
import { describeCollateralExposure, type ExposureInput } from "@/lib/aave-v4/position-exposure";

export function AaveV4PositionExposure({
  reserves,
  prices,
  blendedLt,
}: {
  reserves: ReserveStats[];
  prices?: Record<string, PriceEntry | number>;
  /** Canonical collateral-only blended LT from the spoke (AaveSpokeCardInfo.
   *  blendedLt). When provided, the sentence states this exact value instead of
   *  recomputing, so it can't drift from the position-explanation panel that
   *  reads the same field. Omit to compute locally. */
  blendedLt?: number | null;
}) {
  const inputs: ExposureInput[] = reserves
    .filter((r) => r.collateralEnabled ?? true)
    .map((r) => {
      const amount = r.currentSupplied ?? Math.max(0, r.supplied - r.withdrawn - r.liquidatedCollateral);
      const price = resolvePrice(r.symbol, prices) ?? 1;
      return { symbol: r.symbol, collateralUsd: amount * price, lt: r.lt ?? AAVE_V4_FALLBACK_LT };
    });

  const exposure = describeCollateralExposure(inputs, blendedLt);
  if (!exposure.sentence) return null;

  return (
    <div className="mb-4">
      <div className="mb-1 text-[11px] uppercase tracking-wider text-rb-500">Collateral exposure</div>
      <p className="text-[13px] leading-relaxed text-rb-500">{exposure.sentence}</p>
    </div>
  );
}
