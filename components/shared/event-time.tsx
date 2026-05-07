"use client";

import { createContext, useContext } from "react";
import { formatTimestamp } from "@/lib/shared/format-event";
import { useTimelineDisplay } from "./timeline-display-context";

/**
 * Optional date prefix for the next event's timestamp.
 * Set by the timeline renderer for the first event of each day
 * (e.g. "Mar 15 '24"); null/empty for subsequent events.
 */
export const EventDateContext = createContext<string | null>(null);

/**
 * Renders an event timestamp. When inside an EventDateContext that
 * provides a non-empty prefix, prepends the date so the first event
 * of each day reads e.g. "Mar 15 '24 14:30".
 */
export function EventTime({ ts }: { ts: number }) {
  const datePrefix = useContext(EventDateContext);
  const { showTimestamps } = useTimelineDisplay();
  if (!showTimestamps) return null;
  const time = formatTimestamp(ts);
  return (
    <>
      {datePrefix && (
        <span className="text-xs">{datePrefix} </span>
      )}
      <span className="text-xs text-rb-500">{time}</span>
    </>
  );
}
