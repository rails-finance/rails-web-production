'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

export type TowerSegment = {
  key: string;
  label: string;
  value: number;
  colorClass: string;
  patternStyle?: CSSProperties;
};

export type PositionedSegment = TowerSegment & {
  bottomPct: number;
  heightPct: number;
};

export type BreakdownRow = {
  sign: string;
  label: string;
  amount: string;
  symbol?: string;
  usdHint?: string;
  isResult?: boolean;
  hidden?: boolean;
  swatchClass?: string;
  swatchStyle?: CSSProperties;
  indent?: boolean;
  /** Optional React node rendered after the label (e.g. token icon) */
  icon?: React.ReactNode;
};

// ── Constants ──────────────────────────────────────────────────────────────

export const CHART_HEIGHT = 220;
export const COMPACT_CHART_HEIGHT = 150;
export const SEGMENT_GAP_PX = 2;
export const MIN_SEGMENT_PX = 2;

// ── Formatting helpers ─────────────────────────────────────────────────────

export function formatPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCompactUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `$${(value / 1_000).toFixed(0)}k`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

export function formatUsdValue(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Safe parseFloat for string context fields */
export function num(s: string | undefined | null): number {
  if (s == null) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ── Pattern generators ─────────────────────────────────────────────────────

export const parseRgba = (color: string): [string, string, string, number] | null => {
  const match = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+)\s*)?\)/i.exec(color);
  if (!match) return null;
  const [, r, g, b, a = '1'] = match;
  return [r, g, b, parseFloat(a)];
};

export const fadedColor = (color: string, multiplier = 0.5): string => {
  const parts = parseRgba(color);
  if (!parts) return color;
  const [r, g, b, a] = parts;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a * multiplier))})`;
};

export const withAlpha = (color: string, alpha: number): string => {
  const parts = parseRgba(color);
  if (!parts) return color;
  const [r, g, b] = parts;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
};

export const checkerPattern = (color: string): CSSProperties => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'><path d='M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2' stroke='${encodeURIComponent(color)}' stroke-width='2'/></svg>`;
  return {
    backgroundImage: `url("data:image/svg+xml,${svg}")`,
    backgroundSize: "4px 4px",
    backgroundRepeat: "repeat",
  };
};

/** Reverse-diagonal counterpart to `checkerPattern` — same stroke weight, mirrored angle. */
export const reverseDiagonalPattern = (color: string): CSSProperties => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'><path d='M-1,3 l2,2 M0,0 l4,4 M3,-1 l2,2' stroke='${encodeURIComponent(color)}' stroke-width='2'/></svg>`;
  return {
    backgroundImage: `url("data:image/svg+xml,${svg}")`,
    backgroundSize: "4px 4px",
    backgroundRepeat: "repeat",
  };
};

// ── Common pattern constants ──────────────────────────────────────────────
// Pattern semantics across the protocol suite:
//   · Solid fill               = currently held
//   · Forward diagonal  (╱╱╱)  = loss / involuntary exit (Liquidated, Soft Liq., Redemption)
//   · Reverse diagonal  (╲╲╲)  = voluntary exit          (Withdrawn, Repaid, Costs)

export const REDEMPTION_PATTERN = checkerPattern("rgba(251, 146, 60, 0.6)");
export const LIQUIDATION_PATTERN = checkerPattern("rgba(248, 113, 113, 0.6)");
export const REPAID_PATTERN = reverseDiagonalPattern("rgba(52, 211, 153, 0.5)");
export const WITHDRAWN_PATTERN = reverseDiagonalPattern("rgba(96, 165, 250, 0.5)");
export const COSTS_PATTERN = reverseDiagonalPattern("rgba(217, 70, 239, 0.5)");

// ── Chart mode toggle (Past / Present / Future) ───────────────────────────
// Shared segmented pill used by every lending-protocol economics view.
//   · "Live"      = current open position (striped lifetime layers hidden)
//   · "Historical"= lifetime view (Withdrawn / Repaid / Liquidated / Seized /
//                   Closed positions all reinstated)
//   · "Simulator" = projected position from user edits (only rendered when
//                   the protocol passes hasSimulator — currently V4, llamalend,
//                   liquity, with V3 + others to follow)

export type ChartMode = "live" | "historical" | "simulator";

export function ChartModeToggle({ mode, onChange, hasHistory = true, hasSimulator = false }: {
  mode: ChartMode;
  onChange: (next: ChartMode) => void;
  /** When false, the historical option is disabled (nothing to show) */
  hasHistory?: boolean;
  /** When true, render the third Simulator pill */
  hasSimulator?: boolean;
}) {
  const baseBtn = "px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors rounded";
  const activeBtn = "bg-rb-200 dark:bg-rb-900 text-rb-800 dark:text-rb-100";
  const idleBtn = "text-rb-500 hover:text-rb-700 dark:hover:text-rb-300";
  const disabledBtn = "text-rb-400 dark:text-rb-700 cursor-not-allowed";
  // Simulator pill picks up an amber accent so the editorial mode reads
  // distinctly from the two passive views.
  const activeSimBtn = "bg-amber-500/15 text-amber-400";
  const idleSimBtn = "text-rb-500 hover:text-amber-400";
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md border border-rb-200/60 dark:border-rb-800/60">
      <button
        type="button"
        onClick={() => onChange("live")}
        className={`${baseBtn} ${mode === "live" ? activeBtn : idleBtn}`}
      >
        Live
      </button>
      <button
        type="button"
        onClick={() => hasHistory && onChange("historical")}
        disabled={!hasHistory}
        title={hasHistory ? "Show lifetime activity (withdrawn, repaid, closed positions)" : "No historical activity to show"}
        className={`${baseBtn} ${mode === "historical" ? activeBtn : (hasHistory ? idleBtn : disabledBtn)}`}
      >
        Historical
      </button>
      {hasSimulator && (
        <button
          type="button"
          onClick={() => onChange("simulator")}
          title="Project a hypothetical position from current state"
          className={`${baseBtn} ${mode === "simulator" ? activeSimBtn : idleSimBtn}`}
        >
          Simulator
        </button>
      )}
    </div>
  );
}


// ── Compact number formatter ──────────────────────────────────────────────

function compactSuffix(n: number, divisor: number, suffix: string): string {
  const v = (n / divisor).toFixed(1);
  return v.endsWith(".0") ? v.slice(0, -2) + suffix : v + suffix;
}

export function fmt(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1_000_000) return compactSuffix(n, 1_000_000, "M");
  if (Math.abs(n) >= 1_000) return compactSuffix(n, 1_000, "K");
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export function fmtUsd(n: number): string {
  if (n < 0.01) return "< $0.01";
  if (n >= 1_000_000) return "$" + compactSuffix(n, 1_000_000, "M");
  if (n >= 1_000) return "$" + compactSuffix(n, 1_000, "K");
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ── Layout ─────────────────────────────────────────────────────────────────

export function computeTowerLayout(segments: TowerSegment[], maxValue: number, chartHeight = CHART_HEIGHT): PositionedSegment[] {
  if (!maxValue || !isFinite(maxValue)) return [];
  const visible = segments.filter(s => s.value > 0 && isFinite(s.value));
  if (visible.length === 0) return [];
  const totalGapPx = Math.max(0, visible.length - 1) * SEGMENT_GAP_PX;
  const availableHeight = chartHeight - totalGapPx;
  let cursorPx = 0;
  return visible.map((seg, i) => {
    if (i > 0) cursorPx += SEGMENT_GAP_PX;
    const heightPx = Math.max((seg.value / maxValue) * availableHeight, MIN_SEGMENT_PX);
    const pos: PositionedSegment = { ...seg, bottomPct: cursorPx, heightPct: heightPx };
    cursorPx += heightPx;
    return pos;
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────

export function TowerBar({ segments, sideBar, height = CHART_HEIGHT }: {
  segments: PositionedSegment[];
  /** Single-segment side bar (legacy) or stacked principal + accrued segments. */
  sideBar?:
    | { heightPct: number; color: string }
    | { segments: Array<{ heightPct: number; color: string; patternStyle?: CSSProperties }> };
  height?: number;
}) {
  const sideBarSegments = sideBar
    ? "segments" in sideBar
      ? sideBar.segments.filter(s => s.heightPct > 0)
      : sideBar.heightPct > 0
        ? [{ heightPct: sideBar.heightPct, color: sideBar.color }]
        : []
    : [];
  return (
    <div className="flex gap-px shrink-0">
      {sideBarSegments.length > 0 && (
        <div className="relative shrink-0" style={{ width: 5, height }}>
          {sideBarSegments.reduce<{ cursor: number; nodes: ReactNode[] }>(
            (acc, seg, i) => {
              acc.nodes.push(
                <div
                  key={i}
                  className="absolute w-full rounded-sm"
                  style={{
                    bottom: acc.cursor,
                    height: seg.heightPct,
                    backgroundColor: seg.color,
                    ...seg.patternStyle,
                  }}
                />
              );
              acc.cursor += seg.heightPct;
              return acc;
            },
            { cursor: 0, nodes: [] }
          ).nodes}
        </div>
      )}
      <div className="relative w-16 sm:w-20" style={{ height }}>
        {segments.map((seg) => (
          <div key={seg.key}>
            {seg.colorClass && (
              <div
                className={`absolute left-0 right-0 rounded-sm ${seg.colorClass}`}
                style={{ bottom: seg.bottomPct, height: seg.heightPct }}
              />
            )}
            {seg.patternStyle && (
              <div
                className="absolute left-0 right-0 rounded-sm pointer-events-none bg-rb-200 dark:bg-rb-900"
                style={{ bottom: seg.bottomPct, height: seg.heightPct, ...seg.patternStyle }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BreakdownTable({ rows }: { rows: BreakdownRow[] }) {
  const visible = rows.filter(r => !r.hidden);
  // Layout: sign (~14px) | swatch (~14px) | label (flex) | amount (150px,
  // left-aligned). Whole table caps at 300px so the amount column always
  // starts at the half-width mark — keeps swatches vertically aligned and
  // amounts reading like a column rather than ragged-right text.
  return (
    <table className="text-[11px] border-collapse table-fixed" style={{ width: "100%", maxWidth: 300 }}>
      <colgroup>
        <col className="w-3.5" />
        <col className="w-3.5" />
        <col />
        <col style={{ width: 150 }} />
      </colgroup>
      <tbody>
        {visible.map((row, i) => {
          const rowText = row.isResult
            ? 'text-foreground font-bold'
            : row.indent ? 'text-rb-500 font-medium' : 'text-rb-500 font-bold';
          // Result rows pick up a top divider in rb-500 so the total reads as
          // the sum-line beneath the per-asset contributions.
          const cellBorder = row.isResult ? 'border-t border-rb-300 dark:border-rb-600' : '';
          return (
            <tr key={i} className={rowText}>
              <td className={`py-1 text-right pr-0.5 tabular-nums ${cellBorder}`}>{row.sign}</td>
              <td className={`py-1 pr-1 ${cellBorder}`}>
                {(row.swatchClass || row.swatchStyle) ? (
                  <span
                    className={`inline-block w-2 h-2 rounded-xs overflow-hidden ${row.swatchClass ?? ''}`}
                    style={row.swatchStyle}
                  />
                ) : null}
              </td>
              <td className={`py-1 whitespace-nowrap overflow-hidden text-ellipsis ${cellBorder}`}>{row.label}{row.icon && <span className="inline-flex ml-1 align-middle">{row.icon}</span>}</td>
              <td className={`py-1 pl-3 text-right tabular-nums whitespace-nowrap ${cellBorder}`}>
                {row.amount}
                {row.usdHint && <span className="font-normal ml-1">{row.usdHint}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Stat cell ─────────────────────────────────────────────────────────────

export function Stat({ label, sublabel, children }: { label: string; sublabel?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface-hover)' }}>
      <div className="text-xs  uppercase mb-1">{label}</div>
      <div className="flex items-center gap-1">{children}</div>
      {sublabel && <div className="text-xs  mt-0.5">{sublabel}</div>}
    </div>
  );
}

// ── Dual Tower Chart ──────────────────────────────────────────────────────

export interface TowerSide {
  /** Optional label shown above the breakdown */
  label?: ReactNode;
  segments: TowerSegment[];
  breakdownRows: BreakdownRow[];
  sideBar?:
    | { heightPct: number; color: string }
    | { segments: Array<{ heightPct: number; color: string; patternStyle?: CSSProperties }> };
  /** Placeholder element rendered in the tower area when segments are empty */
  placeholder?: ReactNode;
}

export interface DualTowerChartProps {
  left: TowerSide;
  right?: TowerSide;
  /** Override the chart height (default: CHART_HEIGHT = 220) */
  height?: number;
  /** Override the max value for tower scaling (auto-calculated if omitted) */
  maxValue?: number;
  /** Extra class name on the outer wrapper */
  className?: string;
}

export function DualTowerChart({ left, right, height = CHART_HEIGHT, maxValue, className }: DualTowerChartProps) {
  const leftSum = left.segments.reduce((s, seg) => s + Math.max(0, seg.value), 0);
  const rightSum = right ? right.segments.reduce((s, seg) => s + Math.max(0, seg.value), 0) : 0;
  const towerMax = maxValue ?? Math.max(leftSum, rightSum) * 1.08;

  const leftPositioned = computeTowerLayout(left.segments, towerMax, height);
  const rightPositioned = right ? computeTowerLayout(right.segments, towerMax, height) : [];

  const showLeft = leftSum > 0;
  const hasLeftPlaceholder = !!left.placeholder;
  const showRightTower = !!right && rightSum > 0;
  const showRightBreakdown = !!right && right.breakdownRows.length > 0;
  const hasRightPlaceholder = !!right?.placeholder;
  const leftSlotVisible = showLeft || hasLeftPlaceholder;
  const rightSlotVisible = showRightTower || hasRightPlaceholder;

  if (!leftSlotVisible && !rightSlotVisible) {
    if (!showRightBreakdown) return null;
  }

  // Stacked layout (under xl) puts towers on top and the breakdown tables
  // centered beneath. xl: switches to side-by-side with the left breakdown
  // right-aligned (its right edge flush to the tower's left edge) and the
  // right breakdown left-aligned (mirrored). The 300px wrapper around each
  // table holds its alignment box at exactly the table width so flex
  // alignment moves the visible block, not just the surrounding whitespace.
  if (showLeft && !showRightTower && !showRightBreakdown && !hasRightPlaceholder) {
    return (
      <div className={`flex flex-col xl:flex-row items-center xl:items-stretch justify-center gap-3 ${className ?? ""}`}>
        <div className="flex items-end justify-center gap-1 py-2">
          <TowerBar segments={leftPositioned} sideBar={left.sideBar} height={height} />
        </div>
        <div className="xl:flex-1 xl:flex xl:flex-col">
          <div className="xl:mt-auto w-[300px] max-w-full">
            <BreakdownTable rows={left.breakdownRows} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col xl:flex-row items-center xl:items-stretch justify-center gap-3 ${className ?? ""}`}>
      {/* Left breakdown */}
      <div className="order-2 xl:order-none xl:flex-1 xl:flex xl:flex-col xl:items-center">
        <div className="xl:mt-auto w-[300px] max-w-full">
          <BreakdownTable rows={left.breakdownRows} />
        </div>
      </div>

      {/* Towers */}
      <div className="flex items-end justify-center gap-1 py-2 order-1 xl:order-none">
        {showLeft && <TowerBar segments={leftPositioned} sideBar={left.sideBar} height={height} />}
        {!showLeft && hasLeftPlaceholder && left.placeholder}
        {(leftSlotVisible && rightSlotVisible) && <div className="w-2 shrink-0" />}
        {showRightTower && <TowerBar segments={rightPositioned} sideBar={right!.sideBar} height={height} />}
        {!showRightTower && hasRightPlaceholder && right!.placeholder}
      </div>

      {/* Right breakdown — shown when right side has breakdown rows or placeholder */}
      {(showRightBreakdown || hasRightPlaceholder) && (
        <div className="order-3 xl:order-none xl:flex-1 xl:flex xl:flex-col xl:items-center">
          <div className="xl:mt-auto w-[300px] max-w-full">
            <BreakdownTable rows={right!.breakdownRows} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────

export function EconomicsChartShell({ title, children }: { title: string; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg overflow-hidden mb-4 surface-active">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between text-left cursor-pointer transition-colors"
        style={{ background: 'transparent' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        aria-expanded={isOpen}
        aria-label={isOpen ? `Hide ${title}` : `Show ${title}`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 " />
        ) : (
          <ChevronDown className="w-4 h-4 " />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          <div className="border-t border-rb-200 dark:border-rb-800 pt-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Waterfall Bar ──────────────────────────────────────────────────────────

export type WaterfallStep = {
  key: string;
  label: string;
  value: number; // positive = up, negative = down
  colorClass: string;
  patternStyle?: CSSProperties;
};

export function WaterfallBar({ steps, height = CHART_HEIGHT }: { steps: WaterfallStep[]; height?: number }) {
  // Compute running total to position each bar
  const positions: { key: string; bottom: number; top: number; colorClass: string; patternStyle?: CSSProperties }[] = [];
  let running = 0;
  for (const step of steps) {
    if (step.value === 0) continue;
    const bottom = step.value > 0 ? running : running + step.value;
    const top = step.value > 0 ? running + step.value : running;
    positions.push({ key: step.key, bottom, top, colorClass: step.colorClass, patternStyle: step.patternStyle });
    running += step.value;
  }

  if (positions.length === 0) return null;

  const allValues = positions.flatMap(p => [p.bottom, p.top]);
  const minVal = Math.min(0, ...allValues);
  const maxVal = Math.max(0, ...allValues);
  const range = (maxVal - minVal) * 1.08 || 1;
  const barWidth = Math.max(28, Math.floor(200 / positions.length));

  const toPct = (v: number) => ((v - minVal) / range) * 100;

  return (
    <div className="flex items-end gap-1 justify-center" style={{ height }}>
      {positions.map((p) => {
        const bottomPct = toPct(p.bottom);
        const heightPct = toPct(p.top) - bottomPct;
        return (
          <div key={p.key} className="relative" style={{ width: barWidth, height }}>
            {p.colorClass && (
              <div
                className={`absolute inset-x-0 rounded-xs ${p.colorClass}`}
                style={{ bottom: `${bottomPct}%`, height: `${Math.max(heightPct, 1)}%` }}
              />
            )}
            {p.patternStyle && (
              <div
                className="absolute inset-x-0 rounded-xs pointer-events-none"
                style={{ bottom: `${bottomPct}%`, height: `${Math.max(heightPct, 1)}%`, ...p.patternStyle }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Horizontal Bar ─────────────────────────────────────────────────────────

export type HorizontalSegment = {
  key: string;
  label: string;
  value: number;
  colorClass: string;
  patternStyle?: CSSProperties;
};

export function HorizontalBar({ segments, height = 32 }: { segments: HorizontalSegment[]; height?: number }) {
  const total = segments.reduce((s, seg) => s + Math.abs(seg.value), 0);
  if (total === 0) return null;

  return (
    <div className="flex rounded-md overflow-hidden" style={{ height }}>
      {segments.filter(s => s.value > 0).map((seg) => {
        const widthPct = (seg.value / total) * 100;
        return (
          <div key={seg.key} className="relative" style={{ width: `${widthPct}%` }}>
            <div className={`absolute inset-0 ${seg.colorClass}`} />
            {seg.patternStyle && (
              <div className="absolute inset-0 pointer-events-none" style={seg.patternStyle} />
            )}
            {widthPct > 15 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white/80 drop-shadow-sm">{seg.label}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Price Sensitivity Bar ─────────────────────────────────────────────────

export function PriceSensitivityBar({
  currentPrice,
  breakEvenPrice,
  symbol = "ETH",
}: {
  currentPrice: number;
  breakEvenPrice: number;
  symbol?: string;
}) {
  if (breakEvenPrice <= 0 || !isFinite(breakEvenPrice)) return null;

  // Scale: 0 → breakEven * 1.4
  const ceiling = breakEvenPrice * 1.4;
  const breakPct = Math.min((breakEvenPrice / ceiling) * 100, 100);
  const currentPct = Math.min(Math.max((currentPrice / ceiling) * 100, 2), 98);
  const inProfit = currentPrice >= breakEvenPrice;
  const distPct = Math.abs((breakEvenPrice - currentPrice) / breakEvenPrice * 100);

  return (
    <div>
      <div className="text-xs  uppercase tracking-wider mb-2">
        {symbol} Price Sensitivity
      </div>
      <div className="relative mb-1.5">
        <div className="flex rounded-md overflow-hidden h-2.5">
          {/* Loss zone */}
          <div className="bg-red-500/25" style={{ width: `${breakPct}%` }} />
          {/* Profit zone */}
          <div className="bg-emerald-500/15 flex-1" />
        </div>
        {/* Break-even marker */}
        <div
          className="absolute top-[-2px] w-0.5 h-3.5 bg-amber-400 rounded-full"
          style={{ left: `${breakPct}%`, transform: 'translateX(-50%)' }}
        />
        {/* Current price marker */}
        <div
          className="absolute top-[-2px] w-0.5 h-3.5 bg-blue-400 rounded-full"
          style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between text-[9px]">
        <span className="text-red-400">loss zone</span>
        <span className="text-amber-400">break-even: ${formatCompactUsd(breakEvenPrice).slice(1)}</span>
        <span className="text-emerald-400">profit zone</span>
      </div>
      <div className="text-center text-[9px] mt-0.5">
        <span className="text-blue-400">current {symbol}: ${currentPrice.toLocaleString()} </span>
        <span className={inProfit ? "text-emerald-400" : "text-red-400"}>
          ({distPct.toFixed(1)}% {inProfit ? "above" : "below"} break-even)
        </span>
      </div>
    </div>
  );
}
