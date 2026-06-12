"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type TimelineDisplayKey =
  | "showTimestamps"
  | "showChangeBars"
  | "showBalanceBars"
  | "showTimelineValues"
  | "showTickerLabels"
  | "showUsdValues"
  | "showEventNumbers"
  | "showInterestRates"
  | "showCollateralRatio";

export interface TimelineDisplayState {
  showTimestamps: boolean;
  /** Top delta bar: the collateral/debt value transacted in this event. */
  showChangeBars: boolean;
  /** Bottom total bar: the underlying collateral/debt balance after this event. */
  showBalanceBars: boolean;
  /** When true, the SpineColumn surfaces flanking values along the timeline
   * spine and event-card headers hide their amount on desktop to avoid
   * duplication. When false, values move into the card header instead. */
  showTimelineValues: boolean;
  /** When true, position-snapshot rows show the asset ticker text alongside
   * the icon. Off by default — the icon alone identifies the asset. */
  showTickerLabels: boolean;
  /** When true, position-snapshot / simulator rows show the USD-equivalent
   * value next to the asset amount. */
  showUsdValues: boolean;
  /** When true, each timeline row displays its 1-based chronological number
   * (stable across asc/desc display). */
  showEventNumbers: boolean;
  /** When true, event-card headers show the per-event interest-rate badge
   * (Aave supply/borrow APR). Off by default — surfaced on demand. */
  showInterestRates: boolean;
  /** When true, Liquity event-card headers show the trailing collateral-ratio
   * (CR / LTV) chip. Off by default — surfaced on demand. */
  showCollateralRatio: boolean;
  toggle: (key: TimelineDisplayKey) => void;
}

const DEFAULTS = {
  showTimestamps: false,
  showChangeBars: false,
  showBalanceBars: false,
  showTimelineValues: true,
  showTickerLabels: false,
  showUsdValues: false,
  showEventNumbers: false,
  showInterestRates: false,
  showCollateralRatio: false,
};
const STORAGE_KEY = "timeline-display-v2";

const Ctx = createContext<TimelineDisplayState>({
  ...DEFAULTS,
  toggle: () => {},
});

export function TimelineDisplayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<typeof DEFAULTS>;
      setState((s) => ({ ...s, ...parsed }));
    } catch {}
  }, []);

  const toggle = useCallback((key: TimelineDisplayKey) => {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ ...state, toggle }}>{children}</Ctx.Provider>;
}

export function useTimelineDisplay(): TimelineDisplayState {
  return useContext(Ctx);
}
