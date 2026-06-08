"use client";

import { useEffect, useMemo, useState } from "react";
import { RESET_LINK } from "@/lib/shared/ui-grammar";

// GitHub-style activity heatmap. Doubles as a date-range selector for the
// timeline below: click a cell for a single-day filter, or drag across cells
// for a range. Cells outside the events' lifetime render transparent so the
// grid stays a clean rectangle but only "live" days are interactive.
//
// Day buckets are UTC-aligned to match how event timestamps are stored — a
// localised grid would shift events between cells based on the viewer's
// timezone. The trade-off is that "today" can read as "yesterday" for users
// past UTC midnight; cheap price for cross-timezone consistency.

const SECONDS_PER_DAY = 86_400;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfUtcDay(ts: number): number {
  return Math.floor(ts / SECONDS_PER_DAY) * SECONDS_PER_DAY;
}

function dayOfWeekMon0(ts: number): number {
  // Date.getUTCDay returns 0=Sun..6=Sat. Shift so Mon=0, Sun=6.
  return (new Date(ts * 1000).getUTCDay() + 6) % 7;
}

function fmtFullDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function bucketColor(count: number): string {
  if (count === 0) return "bg-rb-200/50 dark:bg-rb-900/60";
  if (count === 1) return "bg-emerald-400/30 dark:bg-emerald-500/30";
  if (count === 2) return "bg-emerald-400/55 dark:bg-emerald-500/55";
  if (count <= 4) return "bg-emerald-500/75 dark:bg-emerald-400/75";
  return "bg-emerald-500 dark:bg-emerald-400";
}

const CELL_PX = 12;
const CELL_GAP_PX = 2;

interface DayCell {
  ts: number;
  count: number;
  inLifetime: boolean;
}

interface WeekColumn {
  weekIndex: number;
  monthLabel: string | null;
  days: DayCell[];
}

export interface TransactionHeatmapProps {
  events: { timestamp: number }[];
  /** Active date filter as [start, end] unix seconds. null = no filter. */
  value: [number, number] | null;
  onChange: (next: [number, number] | null) => void;
  /** Heading shown top-left. */
  title?: string;
}

export function TransactionHeatmap({ events, value, onChange, title = "Transaction Heatmap" }: TransactionHeatmapProps) {
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [hoverTs, setHoverTs] = useState<number | null>(null);

  const grid = useMemo(() => {
    if (events.length === 0) return null;
    let minTs = Infinity;
    let maxTs = 0;
    const counts = new Map<number, number>();
    for (const e of events) {
      if (e.timestamp < minTs) minTs = e.timestamp;
      if (e.timestamp > maxTs) maxTs = e.timestamp;
      const dayTs = startOfUtcDay(e.timestamp);
      counts.set(dayTs, (counts.get(dayTs) ?? 0) + 1);
    }
    if (!Number.isFinite(minTs) || maxTs === 0) return null;

    const minDay = startOfUtcDay(minTs);
    const maxDay = startOfUtcDay(maxTs);
    // Snap the grid back to the Monday of `minDay`'s week and forward to the
    // Sunday of `maxDay`'s week so every column is a full 7-row stack.
    const gridStart = minDay - dayOfWeekMon0(minDay) * SECONDS_PER_DAY;
    const gridEnd = maxDay + (6 - dayOfWeekMon0(maxDay)) * SECONDS_PER_DAY;

    const totalDays = Math.round((gridEnd - gridStart) / SECONDS_PER_DAY) + 1;
    const totalWeeks = Math.round(totalDays / 7);
    const weeks: WeekColumn[] = [];
    for (let w = 0; w < totalWeeks; w++) {
      const days: DayCell[] = [];
      let monthLabel: string | null = null;
      for (let d = 0; d < 7; d++) {
        const ts = gridStart + (w * 7 + d) * SECONDS_PER_DAY;
        const date = new Date(ts * 1000);
        // Show the month name above the first column whose Monday falls in the
        // first week of that month — gives one label per month with no gaps.
        if (d === 0 && date.getUTCDate() <= 7) {
          monthLabel = MONTH_NAMES[date.getUTCMonth()];
        }
        const inLifetime = ts >= minDay && ts <= maxDay;
        days.push({ ts, count: counts.get(ts) ?? 0, inLifetime });
      }
      weeks.push({ weekIndex: w, monthLabel, days });
    }

    return { weeks, minDay, maxDay };
  }, [events]);

  // End drag on global mouseup so dragging off the grid still finalises.
  useEffect(() => {
    if (dragStart === null) return;
    const onUp = () => setDragStart(null);
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, [dragStart]);

  if (!grid) return null;

  const isDragging = dragStart !== null;
  // While dragging, show a live preview of the range derived from the cursor
  // so the user gets feedback before mouseup commits.
  const displayRange: [number, number] | null = isDragging && hoverTs !== null
    ? [Math.min(dragStart, hoverTs), Math.max(dragStart, hoverTs) + (SECONDS_PER_DAY - 1)]
    : value;

  const inSelection = (dayTs: number): boolean => {
    if (!displayRange) return false;
    const [a, b] = displayRange;
    return dayTs >= startOfUtcDay(a) && dayTs <= startOfUtcDay(b);
  };

  const onCellMouseDown = (cell: DayCell) => {
    if (!cell.inLifetime) return;
    setDragStart(cell.ts);
    setHoverTs(cell.ts);
    onChange([cell.ts, cell.ts + (SECONDS_PER_DAY - 1)]);
  };
  const onCellMouseEnter = (cell: DayCell) => {
    if (!cell.inLifetime) return;
    setHoverTs(cell.ts);
    if (isDragging) {
      const a = Math.min(dragStart, cell.ts);
      const b = Math.max(dragStart, cell.ts);
      onChange([a, b + (SECONDS_PER_DAY - 1)]);
    }
  };

  const rangeLabel = displayRange
    ? `${fmtFullDate(displayRange[0])} – ${fmtFullDate(displayRange[1])}`
    : `${fmtFullDate(grid.minDay)} – ${fmtFullDate(grid.maxDay)}`;

  // Day-of-week labels drop in on rows 0, 2, 4, 6 (Mon, Wed, Fri, Sun) — the
  // others are blank to keep the column rhythm aligned with the cell grid.
  const dowLabels = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

  return (
    <div className="rounded-lg border border-rb-200/60 dark:border-rb-800/60 bg-rb-100/40 dark:bg-rb-950/50 p-3 select-none">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <span className="text-sm font-bold tracking-wide">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-rb-500">{rangeLabel}</span>
          {value && (
            <button type="button" onClick={() => onChange(null)} className={RESET_LINK}>
              Reset
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-2 text-[10px] text-rb-500 overflow-x-auto">
        <div
          className="flex flex-col shrink-0 pt-4"
          style={{ rowGap: `${CELL_GAP_PX}px` }}
        >
          {dowLabels.map((label, i) => (
            <div
              key={i}
              className="leading-none"
              style={{ height: `${CELL_PX}px`, lineHeight: `${CELL_PX}px` }}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex" style={{ columnGap: `${CELL_GAP_PX}px`, marginBottom: `${CELL_GAP_PX}px` }}>
            {grid.weeks.map(w => (
              <div
                key={`m-${w.weekIndex}`}
                className="text-[10px] text-rb-500 leading-none"
                style={{ width: `${CELL_PX}px`, height: `${CELL_PX}px` }}
              >
                {w.monthLabel ?? ""}
              </div>
            ))}
          </div>
          <div className="flex" style={{ columnGap: `${CELL_GAP_PX}px` }}>
            {grid.weeks.map(w => (
              <div key={w.weekIndex} className="flex flex-col" style={{ rowGap: `${CELL_GAP_PX}px` }}>
                {w.days.map(d => {
                  const cls = !d.inLifetime ? "bg-transparent" : bucketColor(d.count);
                  const selected = inSelection(d.ts) && d.inLifetime;
                  return (
                    <div
                      key={d.ts}
                      title={d.inLifetime ? `${fmtFullDate(d.ts)} · ${d.count} event${d.count === 1 ? "" : "s"}` : ""}
                      onMouseDown={() => onCellMouseDown(d)}
                      onMouseEnter={() => onCellMouseEnter(d)}
                      className={`rounded-sm transition-colors ${cls} ${selected ? "ring-1 ring-amber-400 ring-offset-0" : ""} ${d.inLifetime ? "cursor-pointer" : ""}`}
                      style={{ width: `${CELL_PX}px`, height: `${CELL_PX}px` }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legend: Less → More */}
          <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-rb-500">
            <span>Less</span>
            <div className={`rounded-sm ${bucketColor(0)}`} style={{ width: `${CELL_PX}px`, height: `${CELL_PX}px` }} />
            <div className={`rounded-sm ${bucketColor(1)}`} style={{ width: `${CELL_PX}px`, height: `${CELL_PX}px` }} />
            <div className={`rounded-sm ${bucketColor(2)}`} style={{ width: `${CELL_PX}px`, height: `${CELL_PX}px` }} />
            <div className={`rounded-sm ${bucketColor(3)}`} style={{ width: `${CELL_PX}px`, height: `${CELL_PX}px` }} />
            <div className={`rounded-sm ${bucketColor(5)}`} style={{ width: `${CELL_PX}px`, height: `${CELL_PX}px` }} />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
