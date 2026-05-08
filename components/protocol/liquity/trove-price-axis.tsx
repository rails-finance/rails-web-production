"use client";

import { useRef, useState } from "react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { InfoIconButton } from "@/components/shared/info-icon-button";

/**
 * Liquidation-price axis for a Liquity V2 trove.
 *
 * Unlike LLAMMA, Liquity troves have a single liquidation price:
 *   liqPrice = debt × MCR / coll
 * (MCR = 110% on all V2 branches at launch.)
 *
 * Layout: collateral-icon price pill on the left (green = live, blue =
 * simulated), colour bar filling the remaining width with the liquidation
 * label above, and a white circle handle marking the oracle. A small (i)
 * button opens a tooltip with the narrative caption; when the trove is at or
 * below the liquidation threshold the (i) swaps to a red warning triangle.
 *
 * Drag handlers are wired but only fire when `onOraclePriceChange` is
 * supplied (Phase-2 simulator); read-only callers omit it.
 */

export interface TrovePriceAxisProps {
  collateralSymbol: string;
  collateralAddress?: string;
  debtSymbol: string;
  oraclePrice: number;
  liquidationPrice: number;
  onOraclePriceChange?: (price: number) => void;
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
        editable ? "hover:bg-rb-300 dark:hover:bg-rb-800 cursor-text!" : "cursor-default"
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
  onOraclePriceChange,
  simulated = false,
  priceMin,
  priceMax,
}: TrovePriceAxisProps) {
  const draggable = !!onOraclePriceChange;
  const axisRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [infoOpen, setInfoOpen] = useState(false);

  if (!(oraclePrice > 0) || !(liquidationPrice > 0)) return null;

  let leftEdge = Math.min(oraclePrice, liquidationPrice) * 0.7;
  let rightEdge = Math.max(oraclePrice, liquidationPrice) * 1.3;
  if (draggable) {
    if (priceMin != null && priceMin > 0) leftEdge = Math.min(leftEdge, priceMin * 0.98);
    if (priceMax != null && priceMax > 0) rightEdge = Math.max(rightEdge, priceMax * 1.02);
  }
  const range = rightEdge - leftEdge;
  const liqPct = ((liquidationPrice - leftEdge) / range) * 100;
  const oraclePct = ((oraclePrice - leftEdge) / range) * 100;

  const headroomPct = ((oraclePrice - liquidationPrice) / oraclePrice) * 100;
  const underwater = oraclePrice <= liquidationPrice;

  const pointerToPrice = (clientX: number): number => {
    const rect = axisRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return oraclePrice;
    const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = relX / rect.width;
    let next = leftEdge + pct * range;
    if (priceMin != null && priceMin > 0) next = Math.max(priceMin, next);
    if (priceMax != null && priceMax > 0) next = Math.min(priceMax, next);
    return next;
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onOraclePriceChange) return;
    draggingRef.current = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    onOraclePriceChange(pointerToPrice(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !onOraclePriceChange) return;
    onOraclePriceChange(pointerToPrice(e.clientX));
  };
  const endDrag = () => {
    draggingRef.current = false;
  };

  const H_TOP_LABEL = 16;
  const H_BAR_OFFSET = H_TOP_LABEL + 10;
  const H_BAR = 8;
  const HANDLE_SIZE = draggable ? 18 : 12;
  const BAR_MID = H_BAR_OFFSET + H_BAR / 2;
  const H_TOTAL = Math.max(H_BAR_OFFSET + H_BAR + 4, BAR_MID + HANDLE_SIZE / 2 + 2);

  return (
    <div>
      <div className="flex items-center gap-3">
      <PricePill
        symbol={collateralSymbol}
        address={collateralAddress}
        price={oraclePrice}
        simulated={simulated}
        onChange={onOraclePriceChange}
        min={priceMin}
        max={priceMax}
      />
      <div
        ref={axisRef}
        className={`relative flex-1 min-w-[180px] ${draggable ? "cursor-ew-resize select-none" : ""}`}
        style={{ height: H_TOTAL }}
        onPointerDown={draggable ? onPointerDown : undefined}
        onPointerMove={draggable ? onPointerMove : undefined}
        onPointerUp={draggable ? endDrag : undefined}
        onPointerCancel={draggable ? endDrag : undefined}
      >
        <div
          className="absolute text-xs tabular-nums whitespace-nowrap pointer-events-none"
          style={{ left: `${liqPct}%`, transform: "translateX(-50%)", top: 0 }}
        >
          <span className="text-red-400 font-semibold">Liquidation</span>
          <span className="text-rb-500 ml-1.5">{fmtPrice(liquidationPrice)}</span>
        </div>

        <div
          className="absolute left-0 right-0 rounded-sm overflow-hidden bg-rb-200 dark:bg-rb-900"
          style={{ top: H_BAR_OFFSET, height: H_BAR }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 bg-red-500/50"
            style={{ width: `${Math.max(0, Math.min(100, liqPct))}%` }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 bg-emerald-500/25"
            style={{ left: `${Math.max(0, Math.min(100, liqPct))}%` }}
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

        <InfoIconButton
          open={infoOpen}
          onClick={() => setInfoOpen((v) => !v)}
          warning={underwater}
        />
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
