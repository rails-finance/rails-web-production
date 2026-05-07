"use client";

import { useTimelineDisplay } from "@/components/shared/timeline-display-context";

// Event-card headers hide their value spans on desktop (≥sm) so the SpineColumn
// flanking values can take over without duplication, while mobile keeps the
// "amount + icon" visible inline with the action pill. Passive events
// (liquidations, challenges, rewards that happen TO the user) keep the value
// visible on desktop too — the amount IS the story of the event.
//
// The "Timeline values" option in the Display dropdown is the default-on
// preference: when on, values render in the spine and header amounts hide on
// desktop. When off, header amounts come back and the spine drops its flanking
// values.

const HIDE_CLASS = "sm:hidden";

export function useHeaderValueHideClass(opts?: { isPassive?: boolean }): string {
  const { showTimelineValues } = useTimelineDisplay();
  if (!showTimelineValues) return "";
  if (opts?.isPassive) return "";
  return HIDE_CLASS;
}
