"use client";

import { useRef, useState } from "react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { InfoIconButton } from "@/components/shared/info-icon-button";

/**
 * Segmented price-runway bar for a Liquity V2 trove.
 *
 * Four equal-width zones — Conservative / Moderate / Aggressive /
 * Liquidation — with the liquidation price sitting at the boundary between
 * Aggressive and Liquidation (75% of the bar by default). Band widths stay
 * fixed across positions; only the dot marker moves.
 *
 * Marker placement uses one of two modes:
 *   • **Threshold-based** (preferred) — caller passes `thresholdPrices`
 *     (the prices at which Conservative→Moderate and Moderate→Aggressive
 *     boundaries sit). The marker pins to 0% while the price is at or above
 *     the Conservative threshold, then interpolates linearly between
 *     thresholds as the price falls. Each band keeps its visual width.
 *   • **Linear fallback** — when `thresholdPrices` is omitted but
 *     `referenceOraclePrice` is provided, the marker maps linearly between
 *     refPrice (0%) and liquidationPrice (75%). Used by callers without a
 *     threshold concept.
 *
 * Editing happens through the price pill on the right (click to enter a
 * value); when `onOraclePriceChange` is omitted the pill is read-only.
 */

export interface TrovePriceAxisProps {
  collateralSymbol: string;
  collateralAddress?: string;
  debtSymbol: string;
  /** Price to plot. Equals the live oracle price in read mode, the simulated
   *  price in simulator mode. */
  oraclePrice: number;
  liquidationPrice: number;
  /** Anchor for the bar's left edge in the linear-fallback mode. Ignored
   *  when `thresholdPrices` is supplied. */
  referenceOraclePrice?: number;
  /** Threshold prices in descending order — `[conservativeBoundaryPrice,
   *  moderateBoundaryPrice]`. Activates the piecewise marker mapping.
   *  Each band keeps a fixed visual width regardless of how far the price
   *  is from the thresholds. */
  thresholdPrices?: [number, number];
  onOraclePriceChange?: (price: number) => void;
  simulated?: boolean;
  priceMin?: number;
  priceMax?: number;
  /** Bar-position (% from left) at which each zone ends. Last value is also
   *  where the liquidation marker sits. Default = [25, 50, 75]. */
  zoneBoundaries?: [number, number, number];
}

function fmtPrice(v: number): string {
  if (!isFinite(v) || v <= 0) return "–";
  if (v < 1) return `$${v.toFixed(4)}`;
  if (v < 100) return `$${v.toFixed(2)}`;
  if (v < 10_000) return `$${Math.round(v).toLocaleString()}`;
  if (v < 1_000_000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${(v / 1_000_000).toFixed(2)}M`;
}

const ZONE_META = [
  { key: "conservative", label: "Conservative", active: "bg-emerald-500/55", muted: "bg-emerald-500/20", text: "text-emerald-400" },
  { key: "moderate",     label: "Moderate",     active: "bg-amber-500/55",   muted: "bg-amber-500/20",   text: "text-amber-400" },
  { key: "aggressive",   label: "Aggressive",   active: "bg-orange-500/55",  muted: "bg-orange-500/20",  text: "text-orange-400" },
  { key: "liquidation",  label: "Liquidation",  active: "bg-red-500/55",     muted: "bg-red-500/20",     text: "text-red-400" },
] as const;

function PricePill({
  symbol,
  address,
  price,
  simulated,
  onChange,
  min,
  max,
}: {
  symbol: string;
  address?: string;
  price: number;
  simulated: boolean;
  onChange?: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editable = !!onChange;
  const priceColor = simulated ? "text-blue-400" : "text-green-400";

  const startEdit = () => {
    if (!editable) return;
    setText(price < 1 ? price.toFixed(4) : String(Math.round(price)));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };
  const commit = () => {
    setEditing(false);
    const v = parseFloat(text);
    if (!isNaN(v) && v > 0) {
      const clamped = Math.min(max ?? Infinity, Math.max(min ?? 0, v));
      onChange?.(clamped);
    }
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rb-200 dark:bg-rb-900 text-xs tabular-nums ring-1 ring-blue-500/50">
        <TokenChipIcon symbol={symbol} address={address} size={14} />
        <span>$</span>
        <input
          ref={inputRef}
          data-sim-focus
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className={`bg-transparent outline-none w-20 font-bold tabular-nums ${priceColor}`}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      data-sim-focus
      onClick={startEdit}
      disabled={!editable}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rb-200 dark:bg-rb-900 text-xs tabular-nums transition-colors ${
        editable ? "hover:bg-rb-300 dark:hover:bg-rb-800 cursor-text" : "cursor-default"
      }`}
    >
      <TokenChipIcon symbol={symbol} address={address} size={14} />
      <span className={`font-bold ${priceColor}`}>{fmtPrice(price)}</span>
    </button>
  );
}

export function TrovePriceAxis({
  collateralSymbol,
  collateralAddress,
  debtSymbol,
  oraclePrice,
  liquidationPrice,
  referenceOraclePrice,
  thresholdPrices,
  onOraclePriceChange,
  simulated = false,
  priceMin,
  priceMax,
  zoneBoundaries = [25, 50, 75],
}: TrovePriceAxisProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const editable = !!onOraclePriceChange;

  if (!(oraclePrice > 0) || !(liquidationPrice > 0)) return null;

  const liqBoundary = zoneBoundaries[2]; // bar % at which liq sits
  const usePiecewise = !!thresholdPrices
    && thresholdPrices[0] > thresholdPrices[1]
    && thresholdPrices[1] > liquidationPrice;
  const refPrice = referenceOraclePrice && referenceOraclePrice > 0 ? referenceOraclePrice : oraclePrice;
  // Skip drawing when the linear fallback can't form a valid runway.
  if (!usePiecewise && !(refPrice > liquidationPrice)) return null;

  const priceToPct = (p: number): number => {
    if (usePiecewise && thresholdPrices) {
      // Each pre-liq band gets a fixed share of the bar — Conservative
      // [0, b0], Moderate [b0, b1], Aggressive [b1, b2], Liquidation
      // [b2, 100]. Marker pins to 0 while price ≥ Conservative threshold,
      // then interpolates within each band as the price drops.
      const [pCons, pMod] = thresholdPrices;
      const pLiq = liquidationPrice;
      const [b0, b1, b2] = zoneBoundaries;
      if (p >= pCons) return 0;
      if (p >= pMod) return b0 + ((pCons - p) / (pCons - pMod)) * (b1 - b0);
      if (p >= pLiq) return b1 + ((pMod - p) / (pMod - pLiq)) * (b2 - b1);
      // Underwater — push toward 100% as price → 0.
      const t = Math.min(1, (pLiq - p) / pLiq);
      return Math.min(100, b2 + t * (100 - b2));
    }
    // Linear fallback: refPrice → 0%, liquidationPrice → liqBoundary%.
    const consumedFrac = (refPrice - p) / (refPrice - liquidationPrice);
    return Math.max(0, Math.min(100, consumedFrac * liqBoundary));
  };

  const oraclePct = priceToPct(oraclePrice);
  const liqPct = liqBoundary;

  // Active zone for highlight + label colour.
  const activeZoneIdx = oraclePct < zoneBoundaries[0] ? 0
    : oraclePct < zoneBoundaries[1] ? 1
    : oraclePct < zoneBoundaries[2] ? 2
    : 3;

  // Zone widths — shrink each zone proportionally so the inter-zone gaps
  // (1.5% × 3) fit inside the bar without overflowing. For default 25/50/75
  // boundaries this yields four equal 23.875% segments — matching Aave V4.
  const GAP = 1.5;
  const numZones = ZONE_META.length;
  const totalGap = (numZones - 1) * GAP;
  const shrink = (100 - totalGap) / 100;
  const intendedWidths = [
    zoneBoundaries[0],
    zoneBoundaries[1] - zoneBoundaries[0],
    zoneBoundaries[2] - zoneBoundaries[1],
    100 - zoneBoundaries[2],
  ];
  const zoneWidths = intendedWidths.map((w) => Math.max(0, w * shrink));

  const headroomPct = ((oraclePrice - liquidationPrice) / oraclePrice) * 100;
  const underwater = oraclePrice <= liquidationPrice;

  // Vertical layout — match Aave V4 dimensions (66px total).
  const H_LIQ_LABEL = 0;
  const H_BAR = 14;
  const H_BAR_TOP = 32;
  const H_LABELS_TOP = 52;
  const MARKER_SIZE = 14;
  const H_TOTAL = 66;

  return (
    <div>
      <div className="flex items-start gap-3">
        <div
          className="relative flex-1 min-w-[220px]"
          style={{ height: H_TOTAL }}
        >
          {/* Liquidation-price label, sitting above the boundary between
              Aggressive and Liquidation zones. */}
          <div
            className="absolute text-[11px] tabular-nums whitespace-nowrap pointer-events-none leading-tight text-red-400 font-semibold"
            style={{ left: `${liqPct}%`, transform: "translateX(-50%)", top: H_LIQ_LABEL }}
          >
            {fmtPrice(liquidationPrice)}
          </div>

          {/* Segmented bar — four zones with gaps. */}
          <div className="absolute left-0 right-0 flex items-center" style={{ top: H_BAR_TOP, height: H_BAR }}>
            {ZONE_META.map((zone, i) => (
              <div
                key={zone.key}
                className={`h-full rounded-md transition-colors ${i === activeZoneIdx ? zone.active : zone.muted}`}
                style={{
                  width: `${zoneWidths[i]}%`,
                  marginLeft: i === 0 ? 0 : `${GAP}%`,
                }}
              />
            ))}
          </div>

          {/* Oracle marker — purely visual; price edits go through the pill. */}
          <div
            className="absolute pointer-events-none flex items-center justify-center"
            style={{
              left: `calc(${oraclePct}% - ${MARKER_SIZE / 2}px)`,
              top: H_BAR_TOP + H_BAR / 2 - MARKER_SIZE / 2,
              width: MARKER_SIZE,
              height: MARKER_SIZE,
            }}
          >
            <span
              className="flex items-center justify-center w-full h-full rounded-full bg-white border-2 border-rb-300 dark:border-rb-700"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
            />
          </div>

          {/* Zone labels. */}
          <div className="absolute left-0 right-0 flex items-center" style={{ top: H_LABELS_TOP }}>
            {ZONE_META.map((zone, i) => (
              <div
                key={zone.key}
                className={`text-[10px] text-center transition-colors ${i === activeZoneIdx ? `${zone.text} font-semibold` : "text-rb-500"}`}
                style={{
                  width: `${zoneWidths[i]}%`,
                  marginLeft: i === 0 ? 0 : `${GAP}%`,
                }}
              >
                {zone.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 27 }}>
          <PricePill
            symbol={collateralSymbol}
            address={collateralAddress}
            price={oraclePrice}
            simulated={simulated}
            onChange={onOraclePriceChange}
            min={priceMin}
            max={priceMax}
          />
        </div>
        <div style={{ marginTop: 29 }}>
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
              Oracle price is <span className="font-semibold text-red-500">at or below the liquidation threshold</span>.
              This trove can be liquidated — any keeper hitting the contract repays the debt in {debtSymbol} and claims the collateral at a 10% bonus.
            </>
          ) : (
            <>
              {collateralSymbol} price would need to drop{" "}
              <span className="font-semibold text-emerald-400">{headroomPct.toFixed(1)}%</span>{" "}
              (to {fmtPrice(liquidationPrice)}) before this trove is liquidated. Liquity V2 uses a 110% minimum collateral ratio across branches.
            </>
          )}
          {editable ? (
            <>
              {" "}<span className="text-blue-400">Click the price pill to simulate a different oracle value.</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
