"use client";

import { fmtPrice, niceReferencePrice } from "@/components/shared/price-pill";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";

/**
 * Per-asset price runway for an Aave V4 spoke.
 *
 * A single neutral bar that turns red at the liquidation point (b1), mirroring
 * the shape used on Liquity V2's trove pages. Three bar positions anchor the
 * scale internally: a rounded reference price (b0), the live price (the moving
 * caret), and the liquidation price (b1, where the red begins). The b0 anchor
 * comes from a global "headroom %" preference: thresholdPrice =
 * liqPrice × (1 + headroom/100), snapped to a clean round number for display.
 *
 * Marker placement uses one of two modes:
 *   • **Threshold-based** (preferred) — caller passes `thresholdPrice`. Caret
 *     pins to 0% while price ≥ the reference, slides between reference (b0) and
 *     liqPrice (b1), then pushes past b1 into the red if underwater.
 *   • **Linear fallback** — when `thresholdPrice` is omitted, the caret maps
 *     linearly between currentPrice (0%) and liqPrice (b1). Used by callsites
 *     that haven't wired up a threshold yet.
 *
 * Read-only — renders current oracle-derived state. Hypothetical price
 * simulation deferred per the truth principle (see migration/phase-2-mono-explorers.md).
 */

// Bar styling. The bar is a single neutral track that turns red at the
// liquidation point — Rails doesn't editorialize the "safe → worrying" gradient
// before that (a personal risk-tolerance call, deferred to a future
// user-defined risk-profile feature). The red is the one deliberate exception:
// being at or below the liquidation price is a hard on-chain fact, not an
// opinion. It stays muted until the live price is actually in it, then deepens.
// The boundary prices and the "% from liquidation" readout state the facts
// numerically around the bar.
const BAR_FILL_NEUTRAL = "bg-rb-200 dark:bg-rb-800";
const BAR_FILL_LIQ = "bg-red-400/60 dark:bg-red-500/40";
const BAR_FILL_LIQ_ACTIVE = "bg-red-500 dark:bg-red-500";

export interface AaveV4PriceRunwayProps {
  collateralSymbol: string;
  collateralAddress?: string;
  currentPrice: number;
  liqPrice: number | null;
  /** Conservative→Caution boundary price. Activates the piecewise marker
   *  mapping; price ≥ this → Conservative (marker pins at 0%). Defaults to
   *  `liqPrice × 1.25` when omitted — matches the global default headroom. */
  thresholdPrice?: number;
  showZoneLabels?: boolean;
  /** Bar-position (% from left) at which each zone ends. Last value is also
   *  where the liquidation marker sits. Default = [25, 75] — Conservative
   *  and Liquidation caps each take 25%, Caution interior takes 50%. */
  zoneBoundaries?: [number, number];
}

export function AaveV4PriceRunway({
  collateralSymbol,
  collateralAddress,
  currentPrice,
  liqPrice,
  thresholdPrice,
  showZoneLabels = true,
  zoneBoundaries = [25, 75],
}: AaveV4PriceRunwayProps) {
  const hasLiq = liqPrice != null && liqPrice > 0;

  const liqBoundary = zoneBoundaries[1];
  // Upper gridline price — a clean round number near the headroom-derived
  // threshold (e.g. 4,706 → 5,000) so it reads as a scale mark, not a derived
  // "caution" figure. Doubles as the Conservative→Caution anchor for the marker.
  const rawThreshold = hasLiq ? (thresholdPrice && thresholdPrice > liqPrice! ? thresholdPrice : liqPrice! * 1.25) : 0;
  const effectiveThreshold = hasLiq ? niceReferencePrice(rawThreshold, liqPrice!) : 0;
  const usePiecewise = hasLiq && effectiveThreshold > liqPrice!;

  const priceToPct = (p: number): number => {
    if (!hasLiq) return 0;
    if (usePiecewise) {
      const pCons = effectiveThreshold;
      const pLiq = liqPrice!;
      const [b0, b1] = zoneBoundaries;
      if (p >= pCons) return 0;
      if (p >= pLiq) return b0 + ((pCons - p) / (pCons - pLiq)) * (b1 - b0);
      const t = Math.min(1, (pLiq - p) / pLiq);
      return Math.min(100, b1 + t * (100 - b1));
    }
    // Linear fallback — currentPrice anchors 0%, liqPrice anchors liqBoundary.
    const consumedFrac = (currentPrice - p) / (currentPrice - liqPrice!);
    return Math.max(0, Math.min(100, consumedFrac * liqBoundary));
  };

  const oraclePct = hasLiq ? priceToPct(currentPrice) : 0;
  const activeZoneIdx = oraclePct < zoneBoundaries[0] ? 0 : oraclePct < zoneBoundaries[1] ? 1 : 2;

  const H_BAR = 28; // taller bar — holds the in-bar reference + liquidation prices
  const H_PILL_TOP = 0; // live-price tooltip pill, above the bar
  const H_BAR_TOP = 30; // bar top — room for the pill + its down-tail above
  const H_TOTAL = H_BAR_TOP + H_BAR;

  // The live-price pill tracks the marker; flip its anchor near the ends so it
  // never overflows the bar, and put the tail near the matching edge so it still
  // points at the marker.
  const markerLeft = Math.max(0, Math.min(100, oraclePct));
  const markerXform = markerLeft < 14 ? "translateX(0)" : markerLeft > 86 ? "translateX(-100%)" : "translateX(-50%)";
  const tailClass = markerLeft < 14 ? "left-2" : markerLeft > 86 ? "right-2" : "left-1/2 -translate-x-1/2";

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="relative flex-1 min-w-[220px]" style={{ height: H_TOTAL }}>
          {/* Live price — tooltip pill above the bar, tail pointing down at the
              marker. The distance-to-liquidation lives in the (i) info panel. */}
          <div
            className="absolute pointer-events-none"
            style={{ left: `${markerLeft}%`, transform: markerXform, top: H_PILL_TOP }}
          >
            <div className="relative inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-rb-200 bg-white px-1.5 py-0.5 shadow-sm dark:border-rb-700 dark:bg-rb-800">
              <TokenChipIcon symbol={collateralSymbol} address={collateralAddress} size={14} filterable={false} />
              <span className="text-[12px] font-semibold tabular-nums text-foreground">{fmtPrice(currentPrice)}</span>
              <span
                className={`absolute top-full h-0 w-0 border-x-4 border-x-transparent border-t-4 border-t-white dark:border-t-rb-800 ${tailClass}`}
              />
            </div>
          </div>

          {/* Tall bar — neutral up to the liquidation point, red beyond it. The
              reference and liquidation prices live inside the bar, each with a
              small dot marker at its exact position. */}
          <div className="absolute left-0 right-0 rounded-md overflow-hidden" style={{ top: H_BAR_TOP, height: H_BAR }}>
            <div className={`absolute inset-0 ${BAR_FILL_NEUTRAL}`} />
            {hasLiq && (
              <div
                className={`absolute bottom-0 right-0 top-0 transition-colors ${
                  activeZoneIdx === 2 ? BAR_FILL_LIQ_ACTIVE : BAR_FILL_LIQ
                }`}
                style={{ left: `${liqBoundary}%` }}
              />
            )}
            {usePiecewise && (
              <div
                className="absolute flex -translate-y-1/2 items-center gap-1 whitespace-nowrap"
                style={{ left: `${zoneBoundaries[0]}%`, top: "50%" }}
              >
                <span className="h-[5px] w-[5px] rounded-full bg-foreground/50" />
                <span className="text-[12px] font-semibold tabular-nums text-foreground/70">
                  {fmtPrice(effectiveThreshold)}
                </span>
              </div>
            )}
            {hasLiq && (
              <div
                className="absolute flex -translate-y-1/2 items-center gap-1 whitespace-nowrap"
                style={{ left: `${liqBoundary}%`, top: "50%" }}
              >
                <span className="h-[5px] w-[5px] rounded-full bg-red-700 dark:bg-red-300" />
                <span className="text-[12px] font-semibold tabular-nums text-red-900 dark:text-red-50">
                  {fmtPrice(liqPrice!)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
    return (
      <>
        <span className="font-semibold text-foreground">{collateralSymbol} is below its liquidation price.</span>{" "}
        On-chain, this position would be liquidatable.
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
        <span className="font-semibold text-foreground">{headroomPct.toFixed(1)}%</span> (to {fmtPrice(liqPrice!)})
        before this spoke&apos;s health factor reaches 1 — holding every other asset at its current state.
      </>
    );
  }
  return <>No debt on this spoke, so there&apos;s no liquidation price to plot.</>;
}
