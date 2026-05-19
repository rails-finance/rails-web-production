"use client";

// Per-wallet UI state for /llamalend/[wallet]. Mirrors useAaveV4UiState's
// localStorage-keyed pattern so filter / sort / heatmap-range preferences
// persist across reloads on a per-wallet basis.

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_HIDDEN_ACTIONS } from "@/lib/shared/event-filter-helpers";

type SortDirection = "asc" | "desc";

type LlamalendUiState = {
  hiddenActions: string[];
  sortDirection: SortDirection;
  /** Date range filter [startUnix, endUnix], null when off. */
  dateRange: [number, number] | null;
  /** Whether the heatmap visualisation is open under the timeline header. */
  heatmapOpen: boolean;
  /** Selected position key `${controller}:${positionEpoch}` — scopes the
   *  activity timeline below to events on that one lifecycle. null = show
   *  every event across the wallet. */
  selectedPosition: string | null;
};

const DEFAULT_HIDDEN_FOR_LLAMALEND = DEFAULT_HIDDEN_ACTIONS["llamalend"] ?? [];

const DEFAULT_STATE: LlamalendUiState = {
  hiddenActions: [...DEFAULT_HIDDEN_FOR_LLAMALEND],
  sortDirection: "desc",
  dateRange: null,
  heatmapOpen: false,
  selectedPosition: null,
};

const storageKey = (wallet: string) => `rails-ui-llamalend-${wallet.toLowerCase()}`;

export function useLlamalendUiState(wallet?: string) {
  const [state, setState] = useState<LlamalendUiState>(DEFAULT_STATE);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (!wallet) return;
    setHasHydrated(false);
    setState(DEFAULT_STATE);
    try {
      const raw = localStorage.getItem(storageKey(wallet));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LlamalendUiState>;
        setState({
          hiddenActions: Array.isArray(parsed.hiddenActions) ? parsed.hiddenActions : [...DEFAULT_HIDDEN_FOR_LLAMALEND],
          sortDirection: parsed.sortDirection === "asc" ? "asc" : "desc",
          dateRange:
            Array.isArray(parsed.dateRange) &&
            parsed.dateRange.length === 2 &&
            parsed.dateRange.every((n) => typeof n === "number" && n > 0)
              ? (parsed.dateRange as [number, number])
              : null,
          heatmapOpen: parsed.heatmapOpen ?? false,
          selectedPosition: typeof parsed.selectedPosition === "string" ? parsed.selectedPosition : null,
        });
      }
    } catch (err) {
      console.error("Failed to load llamalend UI state", err);
      setState(DEFAULT_STATE);
    } finally {
      setHasHydrated(true);
    }
  }, [wallet]);

  useEffect(() => {
    if (!wallet || !hasHydrated) return;
    try {
      localStorage.setItem(storageKey(wallet), JSON.stringify(state));
    } catch (err) {
      console.error("Failed to save llamalend UI state", err);
    }
  }, [state, wallet, hasHydrated]);

  const setSortDirection = useCallback((dir: SortDirection) => {
    setState((prev) => ({ ...prev, sortDirection: dir }));
  }, []);

  const setHiddenActions = useCallback((next: string[]) => {
    setState((prev) => ({ ...prev, hiddenActions: next }));
  }, []);

  const toggleHiddenAction = useCallback((action: string) => {
    setState((prev) => {
      const set = new Set(prev.hiddenActions);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      return { ...prev, hiddenActions: [...set] };
    });
  }, []);

  const setDateRange = useCallback((range: [number, number] | null) => {
    setState((prev) => ({ ...prev, dateRange: range }));
  }, []);

  const setHeatmapOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, heatmapOpen: open }));
  }, []);

  const setSelectedPosition = useCallback((positionKey: string | null) => {
    setState((prev) => ({ ...prev, selectedPosition: positionKey }));
  }, []);

  return {
    hiddenActions: state.hiddenActions,
    sortDirection: state.sortDirection,
    dateRange: state.dateRange,
    heatmapOpen: state.heatmapOpen,
    selectedPosition: state.selectedPosition,
    hasHydrated,
    setHiddenActions,
    toggleHiddenAction,
    setSortDirection,
    setDateRange,
    setHeatmapOpen,
    setSelectedPosition,
  };
}
