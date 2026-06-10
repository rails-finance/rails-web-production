"use client";

import { fmtPrice } from "@/components/shared/price-pill";

// The per-asset runway bar is now the shared, cross-rail PriceRunway (see
// components/shared/price-runway.tsx). Re-exported here under the Aave name so
// existing call sites keep working; the Aave-specific plain-language copy
// (aaveV4RunwayExplanation) stays below.
export { PriceRunway as AaveV4PriceRunway } from "@/components/shared/price-runway";
export type { PriceRunwayProps as AaveV4PriceRunwayProps } from "@/components/shared/price-runway";

/**
 * Plain-language explanation for one collateral asset's runway. Lives on the
 * economics card's standard bottom-left (i) disclosure rather than inline on
 * the bar, so help has a single consistent home. Recomputes the same
 * underwater / over-covered / headroom states the bar visualises.
 */
export function aaveV4RunwayExplanation({
  collateralSymbol,
  currentPrice,
  liqPrice,
}: {
  collateralSymbol: string;
  currentPrice: number;
  liqPrice: number | null;
}): React.ReactNode {
  const hasLiq = liqPrice != null && liqPrice > 0;
  const underwater = hasLiq && currentPrice <= liqPrice!;
  const overCovered = liqPrice === 0;
  const headroomPct = hasLiq && currentPrice > 0 ? ((currentPrice - liqPrice!) / currentPrice) * 100 : null;

  if (underwater) {
    const recoverPct = currentPrice > 0 ? ((liqPrice! - currentPrice) / currentPrice) * 100 : null;
    return (
      <>
        <span className="font-semibold text-foreground">{collateralSymbol} is below its liquidation price</span> (
        <span className="font-semibold text-foreground">{fmtPrice(liqPrice!)}</span>) — on-chain, this position is
        liquidatable now.
        {recoverPct != null && (
          <>
            {" "}
            It would take roughly a <span className="font-semibold text-foreground">
              +{recoverPct.toFixed(0)}%
            </span>{" "}
            move in {collateralSymbol} to clear the threshold.
          </>
        )}
      </>
    );
  }
  if (overCovered) {
    return (
      <>
        The rest of the collateral already covers this spoke&apos;s debt — {collateralSymbol} can fall to zero without
        tripping a liquidation (other assets would need to fall too).
      </>
    );
  }
  if (hasLiq && headroomPct != null) {
    return (
      <>
        {collateralSymbol} would need to drop{" "}
        <span className="font-semibold text-foreground">{headroomPct.toFixed(1)}%</span> (to{" "}
        <span className="font-semibold text-foreground">{fmtPrice(liqPrice!)}</span>) before this spoke&apos;s health
        factor reaches 1.0 — holding every other asset at its current state.
      </>
    );
  }
  return <>No debt on this spoke, so there&apos;s no liquidation price to plot.</>;
}
