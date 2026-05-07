"use client";

import { useCallback, useEffect, useState } from "react";

type SortDirection = "asc" | "desc";

type TroveUiState = {
  hideDelegateRates: boolean;
  hideRedemptions: boolean;
  summaryExplanationOpen: boolean;
  economicsOpen: boolean;
  sortDirection: SortDirection;
};

const DEFAULT_TROVE_STATE: TroveUiState = {
  hideDelegateRates: false,
  hideRedemptions: false,
  summaryExplanationOpen: false,
  economicsOpen: false,
  sortDirection: "asc",
};

const storageKey = (troveKey: string) => `rails-ui-${troveKey}`;

export function useTroveUiState(troveKey?: string) {
  const [state, setState] = useState<TroveUiState>(DEFAULT_TROVE_STATE);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Load persisted state per trove
  useEffect(() => {
    if (!troveKey) return;
    setHasHydrated(false);
    setState(DEFAULT_TROVE_STATE);

    try {
      const raw = localStorage.getItem(storageKey(troveKey));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TroveUiState>;
        setState({
          hideDelegateRates: parsed.hideDelegateRates ?? false,
          hideRedemptions: parsed.hideRedemptions ?? false,
          summaryExplanationOpen: parsed.summaryExplanationOpen ?? false,
          economicsOpen: parsed.economicsOpen ?? false,
          sortDirection: parsed.sortDirection === "desc" ? "desc" : "asc",
        });
      } else {
        setState(DEFAULT_TROVE_STATE);
      }
    } catch (err) {
      console.error("Failed to load trove UI state", err);
      setState(DEFAULT_TROVE_STATE);
    } finally {
      setHasHydrated(true);
    }
  }, [troveKey]);

  // Persist state after hydration
  useEffect(() => {
    if (!troveKey || !hasHydrated) return;
    try {
      localStorage.setItem(storageKey(troveKey), JSON.stringify(state));
    } catch (err) {
      console.error("Failed to save trove UI state", err);
    }
  }, [state, troveKey, hasHydrated]);

  const setSummaryExplanationOpen = useCallback((isOpen: boolean) => {
    setState((prev) => ({ ...prev, summaryExplanationOpen: isOpen }));
  }, []);

  const setEconomicsOpen = useCallback((isOpen: boolean) => {
    setState((prev) => ({ ...prev, economicsOpen: isOpen }));
  }, []);

  const setHideDelegateRates = useCallback((hide: boolean) => {
    setState((prev) => ({ ...prev, hideDelegateRates: hide }));
  }, []);

  const setHideRedemptions = useCallback((hide: boolean) => {
    setState((prev) => ({ ...prev, hideRedemptions: hide }));
  }, []);

  const setSortDirection = useCallback((dir: SortDirection) => {
    setState((prev) => ({ ...prev, sortDirection: dir }));
  }, []);

  return {
    hideDelegateRates: state.hideDelegateRates,
    hideRedemptions: state.hideRedemptions,
    summaryExplanationOpen: state.summaryExplanationOpen,
    economicsOpen: state.economicsOpen,
    sortDirection: state.sortDirection,
    setHideDelegateRates,
    setHideRedemptions,
    setSummaryExplanationOpen,
    setEconomicsOpen,
    setSortDirection,
  };
}
