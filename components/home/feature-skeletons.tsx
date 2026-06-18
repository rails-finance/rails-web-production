/**
 * Abstract skeleton illustrations for the home feature spotlight — one per
 * feature, each a recognizably different *shape* of content (a single summary
 * card, a chart, a timeline) with no real numbers. Built entirely from rb-*
 * tokens so light/dark come for free.
 *
 * Restrained accent colour (status pills, coin circles, the risk gradient, a
 * couple of timeline dots) is deliberate: enough to tell the views apart at a
 * glance, not enough to stop reading as a skeleton.
 */

import type { ReactNode } from "react";

/** Bottom-fifth alpha fade so the skeleton dissolves into the section
 *  background — gradient-agnostic, same trick the PNG slots used. */
const BOTTOM_FADE = {
  WebkitMaskImage: "linear-gradient(to bottom, #000 80%, transparent 100%)",
  maskImage: "linear-gradient(to bottom, #000 80%, transparent 100%)",
} as const;

/** Sub-card surface — sits a step off the screen surface in both themes. */
const SUBCARD = "bg-rb-100/70 dark:bg-rb-800/50";

/** The framed "screen" every skeleton sits in: surface, clip, fade. */
function Screen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative h-full w-full overflow-hidden rounded-2xl bg-rb-50 ring-1 ring-rb-200 dark:bg-rb-900 dark:ring-rb-800/70"
      style={BOTTOM_FADE}
    >
      {children}
    </div>
  );
}

// ── Position card: one header + two prominent figures + secondary labels ─────
function PositionCardBody() {
  return (
    <div className="flex h-full w-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <div className="h-3.5 w-20 rounded bg-green-500/55" />
        <div className="h-3.5 w-20 rounded bg-rb-400 dark:bg-rb-600" />
        <div className="ml-auto h-3.5 w-28 rounded bg-rb-300 dark:bg-rb-700" />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-6">
        {["bg-blue-500/55", "bg-green-500/55"].map((coin, i) => (
          <div key={i} className="flex flex-col justify-center gap-2">
            <div className="h-2.5 w-16 rounded bg-rb-200 dark:bg-rb-800" />
            <div className="flex items-center gap-3">
              <div className="h-7 w-24 rounded-lg bg-rb-300 dark:bg-rb-700" />
              <div className={`h-9 w-9 shrink-0 rounded-full ${coin}`} />
            </div>
            <div className="h-2.5 w-20 rounded bg-rb-200 dark:bg-rb-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Economics: legend + bar chart + a conservative→liquidation risk bar ──────
function EconomicsBody() {
  return (
    <div className="flex h-full w-full flex-col gap-2.5 p-4">
      <div className="flex flex-[4] items-stretch gap-5">
        {/* left legend — bottom-aligned to the foot of the towers, matching the right */}
        <div className="flex w-1/4 flex-col justify-end gap-2 pb-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 shrink-0 rounded-sm bg-rb-400 dark:bg-rb-600" />
              <div className="h-2.5 flex-1 rounded bg-rb-200 dark:bg-rb-800" />
            </div>
          ))}
        </div>
        <div className="flex flex-1 items-end justify-center gap-4 pb-1">
          <div className="h-[78%] w-12 rounded bg-blue-500/55" />
          <div className="h-[56%] w-12 rounded bg-green-500/55" />
        </div>
        {/* Mirrors the left legend (swatch + bar), one row fewer, and bottom-
            aligned to the foot of the towers as it reads IRL. */}
        <div className="flex w-1/4 flex-col justify-end gap-2 pb-1">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 shrink-0 rounded-sm bg-rb-400 dark:bg-rb-600" />
              <div className="h-2.5 flex-1 rounded bg-rb-200 dark:bg-rb-800" />
            </div>
          ))}
        </div>
      </div>
      {/* Liquidation / price-runway bar: short blue lead, long neutral middle, red liquidation tail. */}
      <div className="flex h-2 w-full gap-1">
        <div className="h-full flex-[0.25] rounded-full bg-blue-500/55" />
        <div className="h-full flex-[2.25] rounded-full bg-rb-200 dark:bg-rb-500/30" />
        <div className="h-full flex-[0.5] rounded-full bg-red-500/55" />
      </div>
      {/* breathing room beneath the runway bar */}
      <div className="flex-1" />
    </div>
  );
}

// ── Timeline: a connected rail with a live head, numbered nodes + per-event row ─
function TimelineBody() {
  const events = [
    { dot: "bg-blue-500/55", title: "w-24", numberSide: "left" as const },
    { dot: "bg-blue-500/55", title: "w-20", numberSide: "right" as const },
    { dot: "bg-green-500/55", title: "w-28", numberSide: "left" as const },
  ];
  return (
    <div className="flex h-full w-full flex-col p-4">
      {/* pulsing "live" head of the spine, aligned over the rail column */}
      <div className="flex gap-2">
        <div className="w-6" />
        <div className="flex w-4 flex-col items-center">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <div className="mt-1 h-3 w-px bg-rb-300 dark:bg-rb-700" />
        </div>
      </div>
      {events.map((e, i) => (
        <div key={i} className="flex flex-1 gap-2">
          {/* left number slot — fixed width; centered on the row so it lines up
              with the node and the event-card value */}
          <div className="flex w-6 items-center justify-end">
            {e.numberSide === "left" && <div className="h-3 w-5 rounded bg-rb-300 dark:bg-rb-700" />}
          </div>
          {/* rail: coin icon centered on the row, with a continuous connector */}
          <div className="flex w-4 flex-col items-center">
            <div className="w-px flex-1 bg-rb-300 dark:bg-rb-700" />
            <div className={`h-4 w-4 shrink-0 rounded-full ${e.dot}`} />
            <div className="w-px flex-1 bg-rb-300 dark:bg-rb-700" />
          </div>
          {/* right number slot — reserved on every row so all event cards share a
              single left edge; only the "right-value" node fills it */}
          <div className="flex w-8 items-center justify-start">
            {e.numberSide === "right" && <div className="h-3 w-5 rounded bg-rb-300 dark:bg-rb-700" />}
          </div>
          {/* event card: type label + tag, amount + timestamp */}
          <div className={`my-1 flex flex-1 items-center gap-3 rounded-md p-2.5 ${SUBCARD}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 ${e.title} rounded bg-rb-300 dark:bg-rb-700`} />
                <div className="h-2.5 w-10 rounded bg-rb-200 dark:bg-rb-800" />
              </div>
            </div>
            {/* amount + timestamp */}
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="h-3 w-12 rounded bg-rb-300 dark:bg-rb-700" />
              <div className="h-2 w-8 rounded bg-rb-200 dark:bg-rb-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const BODIES: Record<string, () => ReactNode> = {
  "position-card": PositionCardBody,
  economics: EconomicsBody,
  timeline: TimelineBody,
};

export function FeatureSkeleton({ slide, label }: { slide: string; label: string }) {
  const Body = BODIES[slide] ?? PositionCardBody;
  return (
    <Screen label={label}>
      <Body />
    </Screen>
  );
}
