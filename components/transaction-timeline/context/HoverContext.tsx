"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type ValueType =
  | "debt"
  | "principal"
  | "interest"
  | "managementFee"
  | "collateral"
  | "collateralUsd"
  | "collateralPrice"
  | "redemptionPrice"
  | "currentPrice"
  | "interestRate"
  | "dailyInterest"
  | "annualInterest"
  | "managementFeeRate"
  | "dailyManagementFee"
  | "annualManagementFee"
  | "delegateName"
  | "collRatio"
  | "upfrontFee"
  | "peakDebt"
  | "peakCollateral"
  | "duration"
  | "dateRange"
  | "owner"
  | "ownerAddress"
  | "troveId"
  | "nftToken"
  | "collSurplus"
  | "debtOffsetBySP"
  | "collToSP"
  | "collGasCompensation"
  | "netOutcome";
export type ValueState = "before" | "after" | "change" | "fee";

export interface HoveredValue {
  type: ValueType;
  state: ValueState;
  value?: number | string;
}

interface HoverContextType {
  hoveredValue: HoveredValue | null;
  setHoveredValue: (value: HoveredValue | null) => void;
  hoverEnabled: boolean;
  setHoverEnabled: (enabled: boolean) => void;
}

const HoverContext = createContext<HoverContextType | undefined>(undefined);

export function HoverProvider({ children }: { children: ReactNode }) {
  const [hoveredValue, setHoveredValue] = useState<HoveredValue | null>(null);
  const [hoverEnabled, setHoverEnabled] = useState<boolean>(false);

  return (
    <HoverContext.Provider value={{ hoveredValue, setHoveredValue, hoverEnabled, setHoverEnabled }}>
      {children}
    </HoverContext.Provider>
  );
}

// No-op fallback so HighlightableValue can render in surfaces that don't
// mount a HoverProvider (chooser rows, listing cards) — those have no
// counterpart explanation to highlight, so silent degradation is correct.
const HOVER_NOOP: HoverContextType = {
  hoveredValue: null,
  setHoveredValue: () => {},
  hoverEnabled: false,
  setHoverEnabled: () => {},
};

export function useHover() {
  return useContext(HoverContext) ?? HOVER_NOOP;
}

// Helper function to check if a value should be highlighted
export function shouldHighlight(hoveredValue: HoveredValue | null, type: ValueType, state?: ValueState): boolean {
  if (!hoveredValue) return false;

  // Match type
  if (hoveredValue.type !== type) return false;

  // If state is provided, match it too
  if (state && hoveredValue.state !== state) return false;

  return true;
}
