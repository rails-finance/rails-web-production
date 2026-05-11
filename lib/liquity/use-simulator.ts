"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createElement } from "react";

/** Live edit values published by the open simulator card. Null when closed. */
export interface LiquitySimulatorEdits {
  /** Trove ID the edits belong to — lets the chart verify it matches its own trove. */
  troveId: string;
  /** Baseline snapshot the simulator opened with. */
  base: { coll: number; debt: number; rate: number; price: number };
  /** Current slider values. */
  sim: { coll: number; debt: number; rate: number; price: number };
}

interface TroveSimulatorState {
  /** Trove ID the simulator is currently open for (null = closed) */
  openTroveId: string | null;
  /** Toggle the simulator for a given trove */
  toggle: (troveId: string) => void;
  /** Force close */
  close: () => void;

  /** Latest edits from the open simulator card (used by the economics chart). */
  edits: LiquitySimulatorEdits | null;
  publishEdits: (edits: LiquitySimulatorEdits | null) => void;

  /** Price requested by the draggable oracle tick on the trove-price axis.
   * The simulator card watches this and pushes it into its local simPrice. */
  requestedPrice: number | null;
  requestPrice: (price: number) => void;
}

const Ctx = createContext<TroveSimulatorState | null>(null);

export function TroveSimulatorProvider({
  activeTroveId,
  children,
}: {
  /** The currently-selected trove on the page — simulator closes when this changes */
  activeTroveId: string | null;
  children: ReactNode;
}) {
  const [openTroveId, setOpenTroveId] = useState<string | null>(null);
  const [edits, setEdits] = useState<LiquitySimulatorEdits | null>(null);
  const [requestedPrice, setRequestedPrice] = useState<number | null>(null);

  useEffect(() => {
    if (openTroveId && openTroveId !== activeTroveId) {
      setOpenTroveId(null);
      setEdits(null);
      setRequestedPrice(null);
    }
  }, [activeTroveId, openTroveId]);

  const toggle = useCallback((troveId: string) => {
    setOpenTroveId((prev) => {
      const next = prev === troveId ? null : troveId;
      if (next === null) {
        setEdits(null);
        setRequestedPrice(null);
      }
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setOpenTroveId(null);
    setEdits(null);
    setRequestedPrice(null);
  }, []);

  const publishEdits = useCallback((next: LiquitySimulatorEdits | null) => {
    setEdits(next);
  }, []);

  const requestPrice = useCallback((price: number) => {
    setRequestedPrice(price);
  }, []);

  const value = useMemo(
    () => ({ openTroveId, toggle, close, edits, publishEdits, requestedPrice, requestPrice }),
    [openTroveId, toggle, close, edits, publishEdits, requestedPrice, requestPrice],
  );

  return createElement(Ctx.Provider, { value }, children);
}

export function useTroveSimulator(): TroveSimulatorState | null {
  return useContext(Ctx);
}
