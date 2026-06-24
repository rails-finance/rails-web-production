// ============================================================================
// EVENT FILTER HELPERS
// ============================================================================
//
// Port of rails-explorer's event-filter-helpers, kept name-compatible so the
// FilterDropdown wiring is symmetric across protocols. Each protocol adds its
// own action-key extraction in `getEventActionKey` and label map in
// `actionLabel`. New protocol → add an arm to both, plus optional demoted /
// default-hidden entries below.

import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isLiquityEvent, isAaveV4Event } from "@/lib/shared/types/event-shape";

/** Get the canonical action key for an event (used for type-level filtering) */
export function getEventActionKey(e: BaseActivityEvent): string {
  if (isLiquityEvent(e)) {
    return e.context.data.operation ?? e.actionType ?? "unknown";
  }
  if (isAaveV4Event(e)) {
    // Distinguish "Supply & Enable Collateral" from plain "Supply" so users
    // can filter the merged variant on its own — the merge has very different
    // semantics (the supply enabled the asset as collateral, not just deposited).
    if (e.context.data.eventType === "supply" && e.context.data.alsoToggledCollateral) {
      return "supply_with_collateral";
    }
    return e.context.data.eventType ?? e.actionType ?? "unknown";
  }
  return e.actionType ?? "unknown";
}

const LIQUITY_OP_LABELS: Record<string, string> = {
  openTrove: "Open",
  openTroveAndJoinBatch: "Open",
  closeTrove: "Close",
  liquidate: "Liquidated",
  adjustTrove: "Adjust",
  adjustTroveInterestRate: "Interest rate",
  applyPendingDebt: "Apply debt",
  redeemCollateral: "Redemption",
  adjustZombieTrove: "Redeemed",
  adjustUnredeemableZombieTrove: "Redeemed",
  setInterestBatchManager: "Delegate",
  removeFromBatch: "Leave delegate",
  transferTrove: "Transfer",
  // Delegate-set rate. Shares the "Interest rate" label with the owner's own
  // adjustTroveInterestRate — the filter row carries a people glyph (suffix) to
  // mark it as the delegate's action. "Batch" is the contract term users read
  // as delegation; the UI never surfaces it.
  setBatchManagerAnnualInterestRate: "Interest rate",
};

const AAVE_V4_OP_LABELS: Record<string, string> = {
  supply: "Supply",
  supply_with_collateral: "Supply + collateral",
  withdraw: "Withdraw",
  borrow: "Borrow",
  repay: "Repay",
  liquidation: "Liquidated",
  collateral_toggle: "Collateral toggle",
  // Inbound from BaseActivityEvent.actionType when isAaveV4Event guard misses
  // (e.g. legacy events) — the EventCard composer maps collateral_toggle to
  // actionType "collateral", so it can show up as the key in some contexts.
  collateral: "Collateral toggle",
};

export function actionLabel(actionKey: string): string {
  return LIQUITY_OP_LABELS[actionKey] ?? AAVE_V4_OP_LABELS[actionKey] ?? actionKey;
}

/** Actions that are demoted (shown last in the filter list, often noisy). */
export const DEMOTED_ACTIONS: Record<string, string[]> = {
  "liquity-v2-troves": ["setBatchManagerAnnualInterestRate", "applyPendingDebt"],
  // Standalone collateral toggles (not merged into a supply) are rare and
  // mostly noise — surface but demoted. The merged "supply + collateral"
  // variant stays prominent because it represents a real state change.
  "aave-v4": ["collateral_toggle", "collateral"],
};

/**
 * Actions hidden by default when entering a protocol (user can un-hide via filter).
 *
 * Liquity is intentionally empty: a delegated trove's *current* rate is driven by
 * the batch manager's setBatchManagerAnnualInterestRate events, so hiding them left
 * the default timeline ending on the (now-stale) rate from the Delegate event while
 * every actual rate move was hidden — the headline rate then looked unexplained.
 * Showing them by default lets the timeline narrate the rate climb that produced the
 * headline. They stay DEMOTED (filter menu, below) so the filter row order still
 * reads owner-first; non-batched troves emit none, so nothing changes for them.
 */
export const DEFAULT_HIDDEN_ACTIONS: Record<string, string[]> = {
  "liquity-v2-troves": [],
  "aave-v4": [],
};
