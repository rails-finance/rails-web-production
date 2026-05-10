"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createElement } from "react";

/** Snapshot of a single supply leg as it exists on-chain right now. */
export interface AaveV4SimBaseSupply {
  symbol: string;
  amount: number;
  price: number;
  lt: number;
  collateralEnabled: boolean;
}

/** Snapshot of a single debt leg as it exists on-chain right now. */
export interface AaveV4SimBaseDebt {
  symbol: string;
  amount: number;
  price: number;
}

export interface AaveV4SimBase {
  supplies: AaveV4SimBaseSupply[];
  debts: AaveV4SimBaseDebt[];
}

/** A leg the user added in-card for an asset that wasn't in the on-chain
 *  position. Carries the LT/price/decimals the simulator math needs since
 *  there's no matching `base` row to look them up in. */
export interface AaveV4SimAddedSupply {
  symbol: string;
  amount: number;
  price: number;
  lt: number;
  collateralEnabled: boolean;
}

export interface AaveV4SimAddedDebt {
  symbol: string;
  amount: number;
  price: number;
}

/** Edits published by the open simulator card. The `supplies`/`debts` arrays
 *  line up 1:1 with `base` by index. `addedSupplies`/`addedDebts` carry rows
 *  the user introduced via the picker for assets the wallet doesn't currently
 *  hold — they don't fold back into base, so the chart treats them as fresh
 *  legs rather than deltas to existing reserves. */
export interface AaveV4SimEdits {
  supplies: { symbol: string; amount: number; price: number; collateralEnabled: boolean }[];
  debts: { symbol: string; amount: number }[];
  addedSupplies: AaveV4SimAddedSupply[];
  addedDebts: AaveV4SimAddedDebt[];
}

export interface AaveV4SimulatorEdits {
  /** Spoke name — so the chart/overlay can verify the edits match its own spoke. */
  spokeKey: string;
  base: AaveV4SimBase;
  sim: AaveV4SimEdits;
}

interface AaveV4SimulatorState {
  /** Spoke currently in simulation mode (null = off). */
  openSpokeKey: string | null;
  toggle: (spokeKey: string) => void;
  close: () => void;

  /** Latest edits from the open simulator card. */
  edits: AaveV4SimulatorEdits | null;
  publishEdits: (edits: AaveV4SimulatorEdits | null) => void;

  /** Per-asset price requests driven by the draggable axes beneath the tower
   *  chart. The simulator card watches this map and pushes each entry into
   *  its local slider state so dragging an axis moves the matching slider. */
  requestedPrices: Record<string, number>;
  requestPrice: (symbol: string, price: number) => void;
}

const Ctx = createContext<AaveV4SimulatorState | null>(null);

export function AaveV4SimulatorProvider({
  activeSpokeKey,
  children,
}: {
  /** Spoke currently rendered in the timeline — simulator auto-closes when it changes. */
  activeSpokeKey: string | null;
  children: ReactNode;
}) {
  const [openSpokeKey, setOpen] = useState<string | null>(null);
  const [edits, setEdits] = useState<AaveV4SimulatorEdits | null>(null);
  const [requestedPrices, setRequestedPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (openSpokeKey && openSpokeKey !== activeSpokeKey) {
      setOpen(null);
      setEdits(null);
      setRequestedPrices({});
    }
  }, [activeSpokeKey, openSpokeKey]);

  const toggle = useCallback((spokeKey: string) => {
    setOpen((prev) => {
      const next = prev === spokeKey ? null : spokeKey;
      if (next === null) {
        setEdits(null);
        setRequestedPrices({});
      }
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setOpen(null);
    setEdits(null);
    setRequestedPrices({});
  }, []);

  const publishEdits = useCallback((next: AaveV4SimulatorEdits | null) => {
    setEdits(next);
  }, []);

  const requestPrice = useCallback((symbol: string, price: number) => {
    setRequestedPrices((prev) => ({ ...prev, [symbol]: price }));
  }, []);

  const value = useMemo(
    () => ({ openSpokeKey, toggle, close, edits, publishEdits, requestedPrices, requestPrice }),
    [openSpokeKey, toggle, close, edits, publishEdits, requestedPrices, requestPrice],
  );

  return createElement(Ctx.Provider, { value }, children);
}

export function useAaveV4Simulator(): AaveV4SimulatorState | null {
  return useContext(Ctx);
}
