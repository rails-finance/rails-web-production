"use client";

import { useRef, useState } from "react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { InfoIconButton } from "@/components/shared/info-icon-button";
import { advanceToNextSimInput } from "@/components/shared/simulator-inputs";

/**
 * Per-asset price runway for the Aave V4 simulator.
 *
 * Aave liquidations aren't band-gradient like LLAMMA — a position is either
 * above HF 1 or it isn't. For a single collateral asset, the liquidation price
 * is the value at which `Σ(other_coll · price · LT) + coll_i · p_liq · LT_i
 *   = Σ(debt · price)`, solved for `p_liq`. The rest of the position is held
 * at its current state, so every asset's axis reflects what happens when only
 * *that* asset's price moves.
 *
 * Layout: editable price pill on the left, a four-zone runway bar in the
 * middle (Liquidation / Aggressive / Moderate / Conservative), info button on
 * the right. Each zone is a fixed ~25% slice of the bar; within a zone the
 * handle position interpolates linearly between the zone's price boundaries,
 * so the visual weight of "headroom" is consistent across assets regardless
 * of how far the actual price sits from liq.
 */

const ZONE_AGGRESSIVE_MULT = 1.10;
const ZONE_MODERATE_MULT = 1.25;
const ZONE_CONSERVATIVE_CAP_MULT = 2;

type ZoneIndex = 0 | 1 | 2 | 3;

function priceToBarPct(price: number, liq: number): number {
  if (liq <= 0 || price <= 0) return 100;
  const aggrEnd = liq * ZONE_AGGRESSIVE_MULT;
  const modEnd = liq * ZONE_MODERATE_MULT;
  const consEnd = liq * ZONE_CONSERVATIVE_CAP_MULT;
  if (price < liq) return Math.min(100, 75 + ((liq - price) / liq) * 25);
  if (price < aggrEnd) return 50 + ((aggrEnd - price) / (aggrEnd - liq)) * 25;
  if (price < modEnd) return 25 + ((modEnd - price) / (modEnd - aggrEnd)) * 25;
  return Math.max(0, 25 - Math.max(0, (price - modEnd) / (consEnd - modEnd)) * 25);
}

function priceToZone(price: number, liq: number): ZoneIndex {
  if (liq <= 0) return 0;
  if (price < liq) return 3;
  if (price < liq * ZONE_AGGRESSIVE_MULT) return 2;
  if (price < liq * ZONE_MODERATE_MULT) return 1;
  return 0;
}

const ZONE_LABELS = ["Conservative", "Moderate", "Aggressive", "Liquidation"] as const;
const ZONE_BG = [
  "bg-emerald-500/20",
  "bg-amber-500/20",
  "bg-orange-500/20",
  "bg-red-500/20",
];
const ZONE_BG_ACTIVE = [
  "bg-emerald-500/55",
  "bg-amber-500/65",
  "bg-orange-500/65",
  "bg-red-500/65",
];
const ZONE_TEXT_ACTIVE = [
  "text-emerald-400",
  "text-amber-400",
  "text-orange-400",
  "text-red-400",
];

export interface AaveV4PriceRunwayProps {
  collateralSymbol: string;
  collateralAddress?: string;
  currentPrice: number;
  liqPrice: number | null;
  simulated?: boolean;
  onPriceChange?: (price: number) => void;
  priceMin?: number;
  priceMax?: number;
  showZoneLabels?: boolean;
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
      <span className="inline-flex items-center gap-1.5">
        <TokenChipIcon symbol={symbol} address={address} size={32} />
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rb-200 dark:bg-rb-900 text-xs tabular-nums ring-1 ring-blue-500/50">
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
              if (e.key === "Enter") {
                e.preventDefault();
                const el = e.currentTarget;
                commit();
                advanceToNextSimInput(el, 1);
              } else if (e.key === "Tab") {
                const el = e.currentTarget;
                const dir: 1 | -1 = e.shiftKey ? -1 : 1;
                if (advanceToNextSimInput(el, dir)) {
                  e.preventDefault();
                  commit();
                }
              } else if (e.key === "Escape") {
                setEditing(false);
              }
            }}
            className={`bg-transparent outline-none w-20 font-bold tabular-nums ${priceColor}`}
          />
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      data-sim-focus={editable ? "" : undefined}
      onClick={startEdit}
      disabled={!editable}
      className={`inline-flex items-center gap-1.5 text-xs tabular-nums ${
        editable ? "cursor-text" : "cursor-default"
      }`}
    >
      <TokenChipIcon symbol={symbol} address={address} size={32} />
      <span className={`font-bold ${priceColor}`}>{fmtPrice(price)}</span>
    </button>
  );
}

export function AaveV4PriceRunway({
  collateralSymbol,
  collateralAddress,
  currentPrice,
  liqPrice,
  simulated = false,
  onPriceChange,
  priceMin,
  priceMax,
  showZoneLabels = true,
}: AaveV4PriceRunwayProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  const hasLiq = liqPrice != null && liqPrice > 0;
  const underwater = hasLiq && currentPrice <= liqPrice!;
  const overCovered = liqPrice === 0;

  const liqRef = hasLiq ? liqPrice! : 0;
  const pricePct = hasLiq ? priceToBarPct(currentPrice, liqRef) : 0;
  const currentZone: ZoneIndex = hasLiq ? priceToZone(currentPrice, liqRef) : 0;

  const headroomPct = hasLiq && currentPrice > 0
    ? ((currentPrice - liqPrice!) / currentPrice) * 100
    : null;

  const H_BAR = 14;
  const ZONE_GAP_PCT = 1.5;
  const SEG_WIDTH_PCT = (100 - ZONE_GAP_PCT * 3) / 4;
  const H_TOP_LABEL = 26;
  const H_BAR_OFFSET = H_TOP_LABEL + 6;
  const HANDLE_SIZE = 18;
  const BAR_MID = H_BAR_OFFSET + H_BAR / 2;
  const ZONE_LABEL_TOP = H_BAR_OFFSET + H_BAR + 6;
  const H_TOTAL = showZoneLabels ? ZONE_LABEL_TOP + 14 : H_BAR_OFFSET + H_BAR;

  return (
    <div>
      <div className="flex items-start gap-3">
        <div style={{ marginTop: BAR_MID - 16 }}>
          <PricePill
            symbol={collateralSymbol}
            address={collateralAddress}
            price={currentPrice}
            simulated={simulated}
            onChange={onPriceChange}
            min={priceMin}
            max={priceMax}
          />
        </div>
        <div
          className="relative flex-1 min-w-[220px]"
          style={{ height: H_TOTAL }}
        >
          {hasLiq && (
            <div
              className="absolute text-[11px] tabular-nums whitespace-nowrap pointer-events-none leading-tight text-red-400 font-semibold"
              style={{ left: "75%", transform: "translateX(-50%)", top: 0 }}
            >
              {fmtPrice(liqPrice!)}
            </div>
          )}
          <div
            className="absolute left-0 right-0 flex items-center"
            style={{ top: H_BAR_OFFSET, height: H_BAR }}
          >
            {([0, 1, 2, 3] as ZoneIndex[]).map((zi) => {
              const isActive = hasLiq && zi === currentZone;
              const fill = !hasLiq && zi === 0
                ? ZONE_BG_ACTIVE[0]
                : isActive ? ZONE_BG_ACTIVE[zi] : ZONE_BG[zi];
              return (
                <div
                  key={zi}
                  className={`h-full rounded-md transition-colors ${fill}`}
                  style={{
                    width: `${SEG_WIDTH_PCT}%`,
                    marginLeft: zi === 0 ? 0 : `${ZONE_GAP_PCT}%`,
                  }}
                />
              );
            })}
          </div>

          <div
            className="absolute pointer-events-none flex items-center justify-center"
            style={{
              left: `calc(${Math.max(0, Math.min(100, pricePct))}% - ${HANDLE_SIZE / 2}px)`,
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
              {([0, 1, 2, 3] as ZoneIndex[]).map((zi) => {
                const isActive = hasLiq && zi === currentZone;
                return (
                  <div
                    key={zi}
                    className={`text-[10px] text-center transition-colors ${
                      isActive ? `${ZONE_TEXT_ACTIVE[zi]} font-semibold` : "text-rb-500"
                    }`}
                    style={{
                      width: `${SEG_WIDTH_PCT}%`,
                      marginLeft: zi === 0 ? 0 : `${ZONE_GAP_PCT}%`,
                    }}
                  >
                    {ZONE_LABELS[zi]}
                  </div>
                );
              })}
            </div>
          )}
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
          {onPriceChange ? (
            <>
              {" "}<span className="text-blue-400">Edit the price pill to simulate a price move.</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
