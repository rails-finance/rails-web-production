"use client";

import { fmtPrice, niceReferencePrice } from "@/components/shared/price-pill";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";

/**
 * Price-runway bar for a Liquity V2 trove.
 *
 * A single neutral bar that turns red at the liquidation point (b1). Three bar
 * positions anchor the scale: a rounded reference price (b0), the live oracle
 * price (the moving caret), and the liquidation price (b1, where the red
 * begins). The interior between b0 and b1 is where the caret actually travels;
 * the bar geometry stays fixed across positions — only the caret moves.
 *
 * Marker placement uses one of two modes:
 *   • **Threshold-based** (preferred) — caller passes `thresholdPrice` (snapped
 *     to a round reference for b0). The caret pins to 0% while the price is at
 *     or above the reference, slides between reference (b0) and liquidationPrice
 *     (b1), then pushes past b1 into the red if underwater.
 *   • **Linear fallback** — when `thresholdPrice` is omitted but
 *     `referenceOraclePrice` is provided, the caret maps linearly between
 *     refPrice (0%) and liquidationPrice (b1). Used by callers without a
 *     threshold concept.
 *
 * Read-only — renders current oracle-derived state. Hypothetical price
 * simulation deferred per the truth principle (see migration/phase-2-mono-explorers.md).
 */

export interface TrovePriceAxisProps {
  collateralSymbol: string;
  collateralAddress?: string;
  debtSymbol: string;
  /** Price to plot — current live oracle price. */
  oraclePrice: number;
  liquidationPrice: number;
  /** Anchor for the bar's left edge in the linear-fallback mode. Ignored
   *  when `thresholdPrice` is supplied. */
  referenceOraclePrice?: number;
  /** Conservative→Caution boundary price. Activates the piecewise marker
   *  mapping; below this price the marker enters the Caution interior. */
  thresholdPrice?: number;
  /** Bar-position (% from left) at which each zone ends. Last value is also
   *  where the liquidation marker sits. Default = [25, 75] — Conservative
   *  and Liquidation caps each take 25%, Caution interior takes 50%. */
  zoneBoundaries?: [number, number];
}

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

export function TrovePriceAxis({
  collateralSymbol,
  collateralAddress,
  debtSymbol,
  oraclePrice,
  liquidationPrice,
  referenceOraclePrice,
  thresholdPrice,
  zoneBoundaries = [25, 75],
}: TrovePriceAxisProps) {
  if (!(oraclePrice > 0) || !(liquidationPrice > 0)) return null;

  const liqBoundary = zoneBoundaries[1]; // bar % at which liq sits (Caution→Liquidation boundary)
  // Upper gridline price — snap the supplied threshold to a clean round number
  // (e.g. 4,706 → 5,000) so it reads as a scale mark rather than a derived
  // "caution" figure. Doubles as the Conservative→Caution marker anchor.
  const niceThreshold =
    thresholdPrice && thresholdPrice > liquidationPrice
      ? niceReferencePrice(thresholdPrice, liquidationPrice)
      : undefined;
  const usePiecewise = !!niceThreshold && niceThreshold > liquidationPrice;
  const refPrice = referenceOraclePrice && referenceOraclePrice > 0 ? referenceOraclePrice : oraclePrice;
  // Skip drawing when the linear fallback can't form a valid runway.
  if (!usePiecewise && !(refPrice > liquidationPrice)) return null;

  const priceToPct = (p: number): number => {
    if (usePiecewise && niceThreshold) {
      // Three zones — Conservative [0, b0], Caution [b0, b1], Liquidation
      // [b1, 100]. Marker pins to 0 while price ≥ the round reference,
      // slides through the bounded Caution interior price-proportionally,
      // then pushes into the Liquidation cap once underwater.
      const pCons = niceThreshold;
      const pLiq = liquidationPrice;
      const [b0, b1] = zoneBoundaries;
      if (p >= pCons) return 0;
      if (p >= pLiq) return b0 + ((pCons - p) / (pCons - pLiq)) * (b1 - b0);
      // Underwater — push toward 100% as price → 0.
      const t = Math.min(1, (pLiq - p) / pLiq);
      return Math.min(100, b1 + t * (100 - b1));
    }
    // Linear fallback: refPrice → 0%, liquidationPrice → liqBoundary%.
    const consumedFrac = (refPrice - p) / (refPrice - liquidationPrice);
    return Math.max(0, Math.min(100, consumedFrac * liqBoundary));
  };

  const oraclePct = priceToPct(oraclePrice);
  const liqPct = liqBoundary;

  // Active zone for highlight + label colour.
  const activeZoneIdx = oraclePct < zoneBoundaries[0] ? 0 : oraclePct < zoneBoundaries[1] ? 1 : 2;

  // Vertical layout — the live price rides above the bar in a tooltip pill (tail
  // pointing down at the marker); the reference and liquidation prices live
  // inside the taller bar, each with a small dot marker. Matches Aave V4.
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
              <span className="text-[12px] font-semibold tabular-nums text-foreground">{fmtPrice(oraclePrice)}</span>
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
            <div
              className={`absolute bottom-0 right-0 top-0 transition-colors ${
                activeZoneIdx === 2 ? BAR_FILL_LIQ_ACTIVE : BAR_FILL_LIQ
              }`}
              style={{ left: `${liqPct}%` }}
            />
            {usePiecewise && niceThreshold && (
              <div
                className="absolute flex -translate-y-1/2 items-center gap-1 whitespace-nowrap"
                style={{ left: `${zoneBoundaries[0]}%`, top: "50%" }}
              >
                <span className="h-[5px] w-[5px] rounded-full bg-foreground/50" />
                <span className="text-[12px] font-semibold tabular-nums text-foreground/70">
                  {fmtPrice(niceThreshold)}
                </span>
              </div>
            )}
            <div
              className="absolute flex -translate-y-1/2 items-center gap-1 whitespace-nowrap"
              style={{ left: `${liqPct}%`, top: "50%" }}
            >
              <span className="h-[5px] w-[5px] rounded-full bg-red-700 dark:bg-red-300" />
              <span className="text-[12px] font-semibold tabular-nums text-red-900 dark:text-red-50">
                {fmtPrice(liquidationPrice)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Plain-language explanation for the trove's liquidation runway. Lives on the
 * economics card's standard bottom-left (i) disclosure rather than inline on
 * the bar, so help has a single consistent home.
 */
export function trovePriceRunwayExplanation({
  collateralSymbol,
  debtSymbol,
  oraclePrice,
  liquidationPrice,
}: {
  collateralSymbol: string;
  debtSymbol: string;
  oraclePrice: number;
  liquidationPrice: number;
}): React.ReactNode {
  const underwater = oraclePrice <= liquidationPrice;
  if (underwater) {
    return (
      <>
        Oracle price is <span className="font-semibold text-foreground">at or below the liquidation threshold</span>.
        This trove can be liquidated — any keeper hitting the contract repays the debt in {debtSymbol} and claims the
        collateral at a 10% bonus.
      </>
    );
  }
  const headroomPct = ((oraclePrice - liquidationPrice) / oraclePrice) * 100;
  return (
    <>
      {collateralSymbol} price would need to drop{" "}
      <span className="font-semibold text-foreground">{headroomPct.toFixed(1)}%</span> (to {fmtPrice(liquidationPrice)})
      before this trove is liquidated. Liquity V2 uses a 110% minimum collateral ratio across branches.
    </>
  );
}
