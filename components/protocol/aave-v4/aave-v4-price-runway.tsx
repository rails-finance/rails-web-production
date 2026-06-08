"use client";

import { fmtPrice, PricePill } from "@/components/shared/price-pill";

/**
 * Per-asset price runway for an Aave V4 spoke.
 *
 * Three zones across the bar — Conservative / Caution / Liquidation — mirroring
 * the shape used on Liquity V2's trove pages. The Conservative→Caution
 * boundary is set by a global "headroom %" preference: thresholdPrice =
 * liqPrice × (1 + headroom/100). The Caution interior is bounded between
 * thresholdPrice and liqPrice; Conservative and Liquidation get fixed visual
 * widths since both are open-ended in price space.
 *
 * Marker placement uses one of two modes:
 *   • **Threshold-based** (preferred) — caller passes `thresholdPrice`. Marker
 *     pins to 0% while price ≥ threshold, slides through the Caution interior
 *     between thresholdPrice (b0) and liqPrice (b1), then pushes into the
 *     Liquidation cap if underwater.
 *   • **Linear fallback** — when `thresholdPrice` is omitted, the marker maps
 *     linearly between currentPrice (0%) and liqPrice (b1). Used by callsites
 *     that haven't wired up a threshold yet.
 *
 * Read-only — renders current oracle-derived state. Hypothetical price
 * simulation deferred per the truth principle (see migration/phase-2-mono-explorers.md).
 */

// Neutral zone styling — Rails doesn't color-code liquidation distance with
// green/amber/red valence. Every band shares one muted neutral fill; only the
// band the price currently sits in is emphasized (stronger neutral). Position
// is read from the marker, the zone labels, and the numeric "% to liquidation"
// readout above the bar.
const ZONE_FILL_ACTIVE = "bg-rb-400 dark:bg-rb-500";
const ZONE_FILL_MUTED = "bg-rb-200 dark:bg-rb-800";

const ZONE_META = [
  { key: "conservative", label: "Conservative" },
  { key: "caution", label: "Caution" },
  { key: "liquidation", label: "Liquidation" },
] as const;

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
  const effectiveThreshold = hasLiq
    ? thresholdPrice && thresholdPrice > liqPrice!
      ? thresholdPrice
      : liqPrice! * 1.25
    : 0;
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

  // Numeric distance-to-liquidation — carries the meaning the flattened
  // (uncolored) bands used to convey at a glance.
  const headroomPct = hasLiq && currentPrice > 0 ? ((currentPrice - liqPrice!) / currentPrice) * 100 : null;

  const GAP = 1.5;
  const numZones = ZONE_META.length;
  const totalGap = (numZones - 1) * GAP;
  const shrink = (100 - totalGap) / 100;
  const intendedWidths = [zoneBoundaries[0], zoneBoundaries[1] - zoneBoundaries[0], 100 - zoneBoundaries[1]];
  const zoneWidths = intendedWidths.map((w) => Math.max(0, w * shrink));

  const H_BAR = 14;
  const H_TOP_LABEL = 26;
  const H_BAR_OFFSET = H_TOP_LABEL + 6;
  const HANDLE_SIZE = 18;
  const BAR_MID = H_BAR_OFFSET + H_BAR / 2;
  const ZONE_LABEL_TOP = H_BAR_OFFSET + H_BAR + 6;
  const H_TOTAL = showZoneLabels ? ZONE_LABEL_TOP + 14 : H_BAR_OFFSET + H_BAR;

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="relative flex-1 min-w-[220px]" style={{ height: H_TOTAL }}>
          {hasLiq && (
            <div
              className="absolute text-[11px] tabular-nums whitespace-nowrap pointer-events-none leading-tight text-foreground font-semibold"
              style={{ left: `${liqBoundary}%`, transform: "translateX(-50%)", top: 0 }}
            >
              {fmtPrice(liqPrice!)}
            </div>
          )}
          {headroomPct != null && (
            <div
              className="absolute text-[11px] tabular-nums whitespace-nowrap pointer-events-none leading-tight text-rb-500 font-medium"
              style={{ left: 0, top: 0 }}
            >
              {headroomPct > 0 ? `${headroomPct.toFixed(0)}% to liquidation` : "At liquidation price"}
            </div>
          )}
          <div className="absolute left-0 right-0 flex items-center" style={{ top: H_BAR_OFFSET, height: H_BAR }}>
            {ZONE_META.map((zone, i) => {
              const isActive = hasLiq && i === activeZoneIdx;
              const fill = (!hasLiq && i === 0) || isActive ? ZONE_FILL_ACTIVE : ZONE_FILL_MUTED;
              return (
                <div
                  key={zone.key}
                  className={`h-full rounded-md transition-colors ${fill}`}
                  style={{
                    width: `${zoneWidths[i]}%`,
                    marginLeft: i === 0 ? 0 : `${GAP}%`,
                  }}
                />
              );
            })}
          </div>

          <div
            className="absolute pointer-events-none flex items-center justify-center"
            style={{
              left: `calc(${Math.max(0, Math.min(100, oraclePct))}% - ${HANDLE_SIZE / 2}px)`,
              top: BAR_MID - HANDLE_SIZE / 2,
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
            }}
          >
            <span
              className="flex items-center justify-center w-full h-full rounded-full bg-white border-2 border-rb-300 dark:border-rb-700"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
            />
          </div>

          {showZoneLabels && (
            <div className="absolute left-0 right-0 flex items-center" style={{ top: ZONE_LABEL_TOP }}>
              {ZONE_META.map((zone, i) => {
                const isActive = hasLiq && i === activeZoneIdx;
                return (
                  <div
                    key={zone.key}
                    className={`text-[10px] text-center transition-colors ${
                      isActive ? "text-foreground font-semibold" : "text-rb-500"
                    }`}
                    style={{
                      width: `${zoneWidths[i]}%`,
                      marginLeft: i === 0 ? 0 : `${GAP}%`,
                    }}
                  >
                    {zone.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ marginTop: BAR_MID - 12 }}>
          <PricePill symbol={collateralSymbol} address={collateralAddress} price={currentPrice} />
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
        <span className="font-semibold text-foreground">{collateralSymbol} is below its liquidation price.</span> On-chain,
        this position would be liquidatable.
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
