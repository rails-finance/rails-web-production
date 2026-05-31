"use client";

import { useState } from "react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { InfoIconButton } from "@/components/shared/info-icon-button";

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

const ZONE_META = [
  { key: "conservative", label: "Conservative", active: "bg-emerald-500/55", muted: "bg-emerald-500/20", text: "text-emerald-400" },
  { key: "caution",      label: "Caution",      active: "bg-amber-500/55",   muted: "bg-amber-500/20",   text: "text-amber-400" },
  { key: "liquidation",  label: "Liquidation",  active: "bg-red-500/55",     muted: "bg-red-500/20",     text: "text-red-400" },
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

function fmtPrice(v: number): string {
  if (!isFinite(v) || v <= 0) return "–";
  if (v < 1) return `$${v.toFixed(4)}`;
  if (v < 100) return `$${v.toFixed(2)}`;
  if (v < 10_000) return `$${Math.round(v).toLocaleString()}`;
  if (v < 1_000_000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${(v / 1_000_000).toFixed(2)}M`;
}

function PricePill({
  symbol,
  address,
  price,
}: {
  symbol: string;
  address?: string;
  price: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rb-200 dark:bg-rb-900 text-xs tabular-nums cursor-default">
      <TokenChipIcon symbol={symbol} address={address} size={14} />
      <span className="font-bold text-green-400">{fmtPrice(price)}</span>
    </span>
  );
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
  const [infoOpen, setInfoOpen] = useState(false);

  const hasLiq = liqPrice != null && liqPrice > 0;
  const underwater = hasLiq && currentPrice <= liqPrice!;
  const overCovered = liqPrice === 0;

  const liqBoundary = zoneBoundaries[1];
  const effectiveThreshold = hasLiq
    ? (thresholdPrice && thresholdPrice > liqPrice! ? thresholdPrice : liqPrice! * 1.25)
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
  const activeZoneIdx = oraclePct < zoneBoundaries[0] ? 0
    : oraclePct < zoneBoundaries[1] ? 1
    : 2;

  const GAP = 1.5;
  const numZones = ZONE_META.length;
  const totalGap = (numZones - 1) * GAP;
  const shrink = (100 - totalGap) / 100;
  const intendedWidths = [
    zoneBoundaries[0],
    zoneBoundaries[1] - zoneBoundaries[0],
    100 - zoneBoundaries[1],
  ];
  const zoneWidths = intendedWidths.map((w) => Math.max(0, w * shrink));

  const headroomPct = hasLiq && currentPrice > 0
    ? ((currentPrice - liqPrice!) / currentPrice) * 100
    : null;

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
        <div
          className="relative flex-1 min-w-[220px]"
          style={{ height: H_TOTAL }}
        >
          {hasLiq && (
            <div
              className="absolute text-[11px] tabular-nums whitespace-nowrap pointer-events-none leading-tight text-red-400 font-semibold"
              style={{ left: `${liqBoundary}%`, transform: "translateX(-50%)", top: 0 }}
            >
              {fmtPrice(liqPrice!)}
            </div>
          )}
          <div
            className="absolute left-0 right-0 flex items-center"
            style={{ top: H_BAR_OFFSET, height: H_BAR }}
          >
            {ZONE_META.map((zone, i) => {
              const isActive = hasLiq && i === activeZoneIdx;
              const fill = !hasLiq && i === 0
                ? zone.active
                : isActive ? zone.active : zone.muted;
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
              className={`flex items-center justify-center w-full h-full rounded-full bg-white border-2 ${
                underwater ? "border-red-500" : "border-rb-300 dark:border-rb-700"
              }`}
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
            />
          </div>

          {showZoneLabels && (
            <div
              className="absolute left-0 right-0 flex items-center"
              style={{ top: ZONE_LABEL_TOP }}
            >
              {ZONE_META.map((zone, i) => {
                const isActive = hasLiq && i === activeZoneIdx;
                return (
                  <div
                    key={zone.key}
                    className={`text-[10px] text-center transition-colors ${
                      isActive ? `${zone.text} font-semibold` : "text-rb-500"
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
          <PricePill
            symbol={collateralSymbol}
            address={collateralAddress}
            price={currentPrice}
          />
        </div>
        <div style={{ marginTop: BAR_MID - 10 }}>
          <InfoIconButton
            open={infoOpen}
            onClick={() => setInfoOpen((v) => !v)}
            warning={underwater}
          />
        </div>
      </div>
      {infoOpen && (
        <div className="mt-2 text-xs text-rb-500 leading-relaxed">
          {underwater ? (
            <>
              <span className="font-semibold text-red-400">{collateralSymbol} is below its liquidation price.</span>
              {" "}On-chain, this position would be liquidatable.
            </>
          ) : overCovered ? (
            <>
              The rest of the collateral already covers this spoke&apos;s debt — {collateralSymbol} can fall to zero without tripping a liquidation (other assets would need to fall too).
            </>
          ) : hasLiq && headroomPct != null ? (
            <>
              {collateralSymbol} would need to drop{" "}
              <span className="font-semibold text-emerald-400">{headroomPct.toFixed(1)}%</span>{" "}
              (to {fmtPrice(liqPrice!)}) before this spoke&apos;s health factor reaches 1 — holding every other asset at its current state.
            </>
          ) : (
            <>No debt on this spoke, so there&apos;s no liquidation price to plot.</>
          )}
        </div>
      )}
    </div>
  );
}
