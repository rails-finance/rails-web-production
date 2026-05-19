"use client";

/**
 * Bands-vs-Oracle price axis. Ported verbatim from
 * rails-explorer/components/protocol/llamalend/bands-price-axis.tsx.
 *
 * LLAMMA positions don't have a single liquidation price. The collateral is
 * spread across a range of price bands; when the oracle drops into the top of
 * that range, LLAMMA starts gradually converting collateral into the debt
 * token ("soft liquidation"). This component puts oracle price and the band
 * range on a shared horizontal axis so the user can see how much cushion the
 * position has.
 *
 * pUp/pDown are computed by `lib/llamalend/bands.ts` from the LLAMMA's
 * resolved A + base_price (Phase 5 server cache) and the position's n1/n2
 * band indices. When those constants aren't available, callers fall back to
 * `simulateLlamalendPosition`'s soft-liq-onset approximation, which is what
 * the `exact` flag tracks.
 */

import { useCallback, useRef, useState } from "react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { InfoIconButton } from "@/components/shared/info-icon-button";

export interface BandsPriceAxisProps {
  collateralSymbol: string;
  collateralAddress?: string;
  debtSymbol: string;
  /** Current oracle price of the collateral in debt/USD units. */
  oraclePrice: number;
  /** Top of the band range — soft-liquidation onset. */
  pUp: number;
  /** Bottom of the band range — below this, fully liquidated. Only known
   *  when A + base_price came from on-chain. */
  pDown?: number;
  /** Number of bands the position spans (n2 − n1 + 1). */
  bandWidth?: number | null;
  /** True when pUp/pDown are exact (on-chain), false when approximated. */
  exact?: boolean;
  /** When set, the oracle pill + handle become editable/draggable. */
  onOraclePriceChange?: (price: number) => void;
  /** True when the axis is displaying the simulator's edited price rather
   *  than the live oracle. Controls pill colour (blue vs green). */
  simulated?: boolean;
  priceMin?: number;
  priceMax?: number;
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
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rb-200 dark:bg-rb-900 text-xs tabular-nums ring-1 ring-blue-500/50">
        <TokenChipIcon symbol={symbol} address={address} size={14} />
        <span>$</span>
        <input
          ref={inputRef}
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

export function BandsPriceAxis({
  collateralSymbol,
  collateralAddress,
  debtSymbol,
  oraclePrice,
  pUp,
  pDown,
  bandWidth,
  exact = false,
  onOraclePriceChange,
  simulated = false,
  priceMin,
  priceMax,
}: BandsPriceAxisProps) {
  const draggable = !!onOraclePriceChange;
  const axisRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const hasRange = pDown !== undefined && pDown > 0 && pDown < pUp;
  const minMarker = Math.min(oraclePrice, pUp, hasRange ? pDown! : pUp);
  const maxMarker = Math.max(oraclePrice, pUp);
  let leftEdge = minMarker * 0.7;
  let rightEdge = maxMarker * 1.3;

  if (draggable) {
    if (priceMin != null && priceMin > 0) leftEdge = Math.min(leftEdge, priceMin * 0.98);
    if (priceMax != null && priceMax > 0) rightEdge = Math.max(rightEdge, priceMax * 1.02);
  }

  if (hasRange && pDown! > 0) {
    const bandSpan = pUp - pDown!;
    const defaultSpan = rightEdge - leftEdge;
    if (defaultSpan > 0 && bandSpan / defaultSpan < 0.1) {
      const halfPad = bandSpan * 2;
      let newLeft = pDown! - halfPad;
      let newRight = pUp + halfPad;
      if (oraclePrice < newLeft) newLeft = oraclePrice - bandSpan * 0.5;
      if (oraclePrice > newRight) newRight = oraclePrice + bandSpan * 0.5;
      leftEdge = Math.max(0.0001, newLeft);
      rightEdge = newRight;
    }
  }
  const range = rightEdge - leftEdge;
  const pUpPct = ((pUp - leftEdge) / range) * 100;
  const pDownPct = hasRange ? ((pDown! - leftEdge) / range) * 100 : 0;
  const oraclePct = ((oraclePrice - leftEdge) / range) * 100;

  const headroomPct = ((oraclePrice - pUp) / oraclePrice) * 100;
  const inSoftLiq = oraclePrice < pUp && (!hasRange || oraclePrice > pDown!);
  const wiped = hasRange && oraclePrice <= pDown!;
  const warning = inSoftLiq || wiped;

  const H_TOP_LABEL = 32;
  const H_BAR_OFFSET = H_TOP_LABEL + 6;
  const H_BAR = 8;
  const HANDLE_SIZE = draggable ? 18 : 12;
  const BAR_MID = H_BAR_OFFSET + H_BAR / 2;
  const H_TOTAL = Math.max(H_BAR_OFFSET + H_BAR + 4, BAR_MID + HANDLE_SIZE / 2 + 2);

  const pointerToPrice = useCallback(
    (clientX: number): number => {
      const rect = axisRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return oraclePrice;
      const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const pct = relX / rect.width;
      let next = leftEdge + pct * range;
      if (priceMin != null && priceMin > 0) next = Math.max(priceMin, next);
      if (priceMax != null && priceMax > 0) next = Math.min(priceMax, next);
      return next;
    },
    [leftEdge, range, priceMin, priceMax, oraclePrice],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onOraclePriceChange) return;
      draggingRef.current = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      onOraclePriceChange(pointerToPrice(e.clientX));
    },
    [onOraclePriceChange, pointerToPrice],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || !onOraclePriceChange) return;
      onOraclePriceChange(pointerToPrice(e.clientX));
    },
    [onOraclePriceChange, pointerToPrice],
  );
  const endDrag = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div>
      <div className="flex items-start gap-3">
        <div style={{ marginTop: BAR_MID - 13 }}>
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
        <div
          ref={axisRef}
          className={`relative flex-1 min-w-[180px] ${draggable ? "cursor-ew-resize select-none" : ""}`}
          style={{ height: H_TOTAL }}
          onPointerDown={draggable ? onPointerDown : undefined}
          onPointerMove={draggable ? onPointerMove : undefined}
          onPointerUp={draggable ? endDrag : undefined}
          onPointerCancel={draggable ? endDrag : undefined}
        >
          {hasRange ? (
            <div
              className="absolute flex flex-col items-center text-xs tabular-nums whitespace-nowrap pointer-events-none leading-tight"
              style={{
                left: `${(pDownPct + pUpPct) / 2}%`,
                transform: "translateX(-50%)",
                top: 0,
              }}
            >
              <span className="text-amber-400 font-semibold">Band range</span>
              <span className="text-rb-500">
                {fmtPrice(pDown!)} – {fmtPrice(pUp)}
              </span>
            </div>
          ) : (
            <div
              className="absolute flex flex-col items-center text-xs tabular-nums whitespace-nowrap pointer-events-none leading-tight"
              style={{
                left: `${pUpPct}%`,
                transform: "translateX(-50%)",
                top: 0,
              }}
            >
              <span className="text-red-400 font-semibold">Soft liq</span>
              <span className="text-rb-500">{fmtPrice(pUp)}</span>
            </div>
          )}

          <div
            className="absolute left-0 right-0 rounded-sm overflow-hidden bg-rb-200 dark:bg-rb-900"
            style={{ top: H_BAR_OFFSET, height: H_BAR }}
          >
            {hasRange ? (
              <>
                <div
                  className="absolute left-0 top-0 bottom-0 bg-red-500/60 rounded-sm"
                  style={{ width: `${Math.max(0, Math.min(100, pDownPct))}%` }}
                />
                {bandWidth && bandWidth > 1 && bandWidth <= 30 ? (
                  <div
                    className="absolute top-0 bottom-0 flex gap-[2px] px-[2px]"
                    style={{
                      left: `${Math.max(0, Math.min(100, pDownPct))}%`,
                      width: `${Math.max(0, Math.min(100, pUpPct) - Math.max(0, pDownPct))}%`,
                    }}
                  >
                    {Array.from({ length: bandWidth }).map((_, i) => {
                      const t = bandWidth === 1 ? 0 : i / (bandWidth - 1);
                      const r = Math.round(239 * (1 - t) + 245 * t);
                      const g = Math.round(68 * (1 - t) + 158 * t);
                      const b = Math.round(68 * (1 - t) + 11 * t);
                      const a = 0.55 * (1 - t) + 0.2 * t;
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-sm"
                          style={{ background: `rgba(${r},${g},${b},${a})` }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="absolute top-0 bottom-0 bg-gradient-to-r from-red-500/55 via-amber-500/45 to-amber-500/20"
                    style={{
                      left: `${Math.max(0, Math.min(100, pDownPct))}%`,
                      width: `${Math.max(0, Math.min(100, pUpPct) - Math.max(0, pDownPct))}%`,
                    }}
                  />
                )}
              </>
            ) : (
              <div
                className="absolute left-0 top-0 bottom-0 bg-red-500/50 rounded-sm"
                style={{ width: `${Math.max(0, Math.min(100, pUpPct))}%` }}
              />
            )}
            <div
              className="absolute right-0 top-0 bottom-0 bg-emerald-500/25 rounded-sm"
              style={{ left: `${Math.max(0, Math.min(100, pUpPct))}%` }}
            />
          </div>

          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `calc(${oraclePct}% - ${HANDLE_SIZE / 2}px)`,
              top: BAR_MID - HANDLE_SIZE / 2,
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              background: "#fff",
              border: "2px solid var(--color-rb-700)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
            }}
          />
        </div>

        <div style={{ marginTop: BAR_MID - 10 }}>
          <InfoIconButton
            open={infoOpen}
            onClick={() => setInfoOpen((v) => !v)}
            warning={warning}
          />
        </div>
      </div>
      {infoOpen && (
        <div className="mt-2 text-xs text-rb-500 leading-relaxed">
          {wiped ? (
            <>
              Oracle price is <span className="font-semibold text-red-500">below the entire band range</span>.
              All {collateralSymbol} collateral has been converted to {debtSymbol}.
            </>
          ) : inSoftLiq ? (
            <>
              Oracle price is <span className="font-semibold text-amber-400">inside the band range</span>.
              LLAMMA is soft-liquidating this position — {collateralSymbol} is being converted to {debtSymbol} as price moves through the bands.
            </>
          ) : (
            <>
              {collateralSymbol} price would need to drop{" "}
              <span className="font-semibold text-emerald-400">{headroomPct.toFixed(1)}%</span>{" "}
              (to {fmtPrice(pUp)}) before soft-liquidation begins
              {hasRange ? (
                <>
                  , and{" "}
                  <span className="font-semibold">{(((oraclePrice - pDown!) / oraclePrice) * 100).toFixed(1)}%</span>
                  {" "}(to {fmtPrice(pDown!)}) before the position is fully liquidated
                </>
              ) : null}
              .
            </>
          )}
          {bandWidth ? (
            <>
              {" "}The position spans <span className="font-semibold">{bandWidth} band{bandWidth === 1 ? "" : "s"}</span>.
            </>
          ) : null}
          {!exact ? (
            <>
              {" "}<span className="text-rb-600 dark:text-rb-500 italic">Band-range top approximated from debt/collateral; exact on-chain values unavailable.</span>
            </>
          ) : null}
          {draggable ? (
            <>
              {" "}<span className="text-blue-400">Edit the pill or drag the handle to simulate a price move.</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
