// Aave V4 — Protocol Context. Verbatim mirror of rails-explorer's
// lib/shared/types/protocols/aave-v4.ts. Lifted components import the
// `AaveV4Context` symbol from here; the canonical declaration lives in
// `lib/shared/types/event-shape.ts` (and is duplicated below to avoid a
// cross-file re-export shuffle in lifted components).

export type AaveV4EventType =
  | "supply"
  | "withdraw"
  | "borrow"
  | "repay"
  | "liquidation"
  | "collateral_toggle";

export interface AaveV4Context {
  eventType: AaveV4EventType;
  amount?: string;
  reserveSymbol?: string;
  spokeName?: string;
  spokeAddress?: string;
  enabled?: boolean;
  collateralSymbol?: string;
  debtToCover?: string;
  liquidatedCollateralAmount?: string;
  liquidator?: string;
  supplyBefore?: string;
  supplyAfter?: string;
  debtBefore?: string;
  debtAfter?: string;
  allSupplies?: { symbol: string; amount: string }[];
  allDebts?: { symbol: string; amount: string }[];
  alsoToggledCollateral?: boolean;
  supplyAPR?: string;
  borrowAPR?: string;
}
