// Curve LlamaLend V1 — Protocol Context. Verbatim mirror of rails-explorer's
// lib/shared/types/protocols/llamalend.ts. Lifted components import the
// `LlamalendContext` symbol from here; the canonical declaration also lives
// in `lib/shared/types/event-shape.ts` (and is duplicated below to avoid a
// cross-file re-export shuffle in lifted components).

export type LlamalendEventType =
  | "open"             // first borrow that creates a position (debtBefore ≈ 0)
  | "close"            // repay that fully clears a position (debtAfter ≈ 0)
  | "borrow"
  | "repay"
  | "remove_collateral"
  | "liquidate"        // liquidator-side
  | "liquidated"       // borrower-side when someone else liquidates this wallet
  | "soft_liquidated"; // synthetic event derived from state deltas between user actions

export interface LlamalendContext {
  eventType: LlamalendEventType;

  // ── Market identity ────────────────────────────────────────
  controller: string;
  family?: "lend" | "mint";
  collateralToken?: string;
  collateralSymbol?: string;
  collateralDecimals?: number;
  borrowedToken?: string;
  borrowedSymbol?: string;
  borrowedDecimals?: number;

  // ── Event payload (formatted-decimal strings, not raw wei) ──
  deltaCollateral?: string;
  deltaDebt?: string;
  collateralReceived?: string;
  stablecoinReceived?: string;
  debtCleared?: string;
  liquidator?: string;
  /** 1-based cycle index per (wallet, controller). Increments after every
   *  close or liquidation so a reopen yields a separate position card. */
  positionEpoch?: number;

  // ── Before/after snapshots from llamalend_user_state ───────
  collateralBefore?: string;
  collateralAfter?: string;
  debtBefore?: string;
  debtAfter?: string;
  /** LLAMMA band range after this event (signed int256). */
  n1?: string;
  n2?: string;
  /** Bands before this event. */
  n1Before?: string;
  n2Before?: string;
  liquidationDiscount?: string;

  // ── LLAMMA market constants (resolved on-chain by the loader) ──
  ammA?: number;
  /** LLAMMA base_price, 18-decimal fixed point. */
  ammBasePrice?: string;

  // ── Grouped-liquidation fields ─────────────────────────────
  liquidationCount?: number;
  liquidationFirstTs?: number;
  liquidationLastTs?: number;
  liquidators?: string[];
}
