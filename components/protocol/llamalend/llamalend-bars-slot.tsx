"use client";

// LLAMMA bands pill, rendered in the EventCard's `headerBars` slot — the
// same architectural position as AaveV4's change/balance bars and Liquity's
// trove bar. The visual is the band-range strip from rails-explorer's
// `bands-pill.tsx`; this stub is the structural mount-point that C2 fills in.
//
// Inputs are already populated on every event (Phase 5, B6):
//   ctx.n1 / ctx.n2          — band indices for this event
//   ctx.ammA / ctx.ammBasePrice — LLAMMA constants for band-edge formula
// C2 will plug those into `BandsPill` and gate visibility on a new
// `showBandsBar` toggle in `TimelineDisplayProvider`.

import type { LlamalendContext } from "@/lib/shared/types/protocols/llamalend";

export interface LlamalendBarsSlotProps {
  ctx: LlamalendContext;
}

export function LlamalendBarsSlot(_props: LlamalendBarsSlotProps) {
  return null;
}
