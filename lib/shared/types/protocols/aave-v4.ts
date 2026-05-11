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
  /** Historic USD price of the event's primary asset at the event's block.
   *  Populated for supply / withdraw / borrow / repay / collateral_toggle.
   *  Liquidation rows use `collateralPrice` + `debtPrice` instead. */
  price?: { usd: number; source: AaveV4PriceSource };
  /** Liquidation rows only — collateral asset's USD price at event block. */
  collateralPrice?: { usd: number; source: AaveV4PriceSource };
  /** Liquidation rows only — debt asset's USD price at event block. */
  debtPrice?: { usd: number; source: AaveV4PriceSource };
}

/** Provenance of an Aave V4 historic price.
 *  - `chainlink` — Chainlink USD aggregator round at the event block. Used
 *    for the bluechip allowlist (WETH, WBTC, cbBTC, AAVE, EURC, LINK,
 *    USDC, USDT). No `≈` prefix on the chip.
 *  - `iaave-oracle` — protocol-faithful IAaveOracle read. No `≈`.
 *  - `stablecoin` — hard-pinned to $1.00 for the known stable set. `≈`.
 *  - `defillama` — DEPRECATED. The server-side transformer drops these
 *    rows from the wire response, so the UI never sees them. The variant
 *    stays in the union so any historical row queried directly still
 *    parses. */
export type AaveV4PriceSource =
  | "chainlink"
  | "iaave-oracle"
  | "stablecoin"
  | "defillama";
