"use client";

// Compact band-range pill — "n1 to n2", with a before→after transition
// variant when the bands shifted in an event. Ported verbatim from
// rails-explorer/components/protocol/llamalend/bands-pill.tsx; the dependency
// (TransitionArrow) is already shared between the two repos.

import { TransitionArrow } from "@/components/shared/state-transition";

export interface BandsPillProps {
  n1: number | string;
  n2: number | string;
  /** `current` uses the foreground (theme) text color; `before` uses text-rb-500. */
  variant?: "current" | "before";
}

export function BandsPill({ n1, n2, variant = "current" }: BandsPillProps) {
  const colorClass = variant === "before" ? "text-rb-500" : "";
  return (
    <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${colorClass}`}>
      <span>{n1}</span>
      <span className="text-rb-500 font-normal">to</span>
      <span>{n2}</span>
    </span>
  );
}

export interface BandsTransitionProps {
  /** Bands before the event. If nullish or equal to after, only the current range is shown. */
  n1Before?: number | string | null;
  n2Before?: number | string | null;
  n1: number | string;
  n2: number | string;
}

export function BandsTransition({ n1Before, n2Before, n1, n2 }: BandsTransitionProps) {
  const hasBefore =
    n1Before !== undefined && n1Before !== null && n1Before !== "" &&
    n2Before !== undefined && n2Before !== null && n2Before !== "";
  const changed =
    hasBefore && (String(n1Before) !== String(n1) || String(n2Before) !== String(n2));

  if (!changed) {
    return <BandsPill n1={n1} n2={n2} variant="current" />;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <BandsPill n1={n1Before!} n2={n2Before!} variant="before" />
      <TransitionArrow size="sm" />
      <BandsPill n1={n1} n2={n2} variant="current" />
    </span>
  );
}
