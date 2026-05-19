// ============================================================================
// EVENT FILTER HELPERS
// ============================================================================
//
// Port of rails-explorer's event-filter-helpers, kept name-compatible so the
// FilterDropdown wiring is symmetric across protocols. Each protocol adds its
// own action-key extraction in `getEventActionKey` and label map in
// `actionLabel`. New protocol → add an arm to both, plus optional demoted /
// default-hidden entries below.

import type { BaseActivityEvent } from '@/lib/shared/types/event-shape';
import { isLiquityEvent, isAaveV4Event, isLlamalendEvent } from '@/lib/shared/types/event-shape';

/** Get the canonical action key for an event (used for type-level filtering) */
export function getEventActionKey(e: BaseActivityEvent): string {
  if (isLiquityEvent(e)) {
    return e.context.data.operation ?? e.actionType ?? 'unknown';
  }
  if (isAaveV4Event(e)) {
    // Distinguish "Supply & Enable Collateral" from plain "Supply" so users
    // can filter the merged variant on its own — the merge has very different
    // semantics (the supply enabled the asset as collateral, not just deposited).
    if (e.context.data.eventType === 'supply' && e.context.data.alsoToggledCollateral) {
      return 'supply_with_collateral';
    }
    return e.context.data.eventType ?? e.actionType ?? 'unknown';
  }
  if (isLlamalendEvent(e)) {
    return e.context.data.eventType ?? e.actionType ?? 'unknown';
  }
  return e.actionType ?? 'unknown';
}

const LIQUITY_OP_LABELS: Record<string, string> = {
  openTrove: 'Open',
  openTroveAndJoinBatch: 'Open',
  closeTrove: 'Close',
  liquidate: 'Liquidated',
  adjustTrove: 'Adjust',
  adjustTroveInterestRate: 'Interest rate',
  applyPendingDebt: 'Apply debt',
  redeemCollateral: 'Redemption',
  adjustZombieTrove: 'Redeemed',
  adjustUnredeemableZombieTrove: 'Redeemed',
  setInterestBatchManager: 'Delegate',
  removeFromBatch: 'Leave delegate',
  transferTrove: 'Transfer',
  setBatchManagerAnnualInterestRate: 'Batch rate',
};

const AAVE_V4_OP_LABELS: Record<string, string> = {
  supply: 'Supply',
  supply_with_collateral: 'Supply + collateral',
  withdraw: 'Withdraw',
  borrow: 'Borrow',
  repay: 'Repay',
  liquidation: 'Liquidated',
  collateral_toggle: 'Collateral toggle',
  // Inbound from BaseActivityEvent.actionType when isAaveV4Event guard misses
  // (e.g. legacy events) — the EventCard composer maps collateral_toggle to
  // actionType "collateral", so it can show up as the key in some contexts.
  collateral: 'Collateral toggle',
};

const LLAMALEND_OP_LABELS: Record<string, string> = {
  open: 'Open',
  close: 'Close',
  borrow: 'Borrow',
  repay: 'Repay',
  remove_collateral: 'Remove collateral',
  liquidate: 'Liquidated',
  liquidated: 'Liquidated',
  soft_liquidated: 'Soft liquidated',
};

export function actionLabel(actionKey: string): string {
  return (
    LIQUITY_OP_LABELS[actionKey] ??
    AAVE_V4_OP_LABELS[actionKey] ??
    LLAMALEND_OP_LABELS[actionKey] ??
    actionKey
  );
}

/** Actions that are demoted (shown last in the filter list, often noisy). */
export const DEMOTED_ACTIONS: Record<string, string[]> = {
  'liquity-v2-troves': ['setBatchManagerAnnualInterestRate', 'applyPendingDebt'],
  // Standalone collateral toggles (not merged into a supply) are rare and
  // mostly noise — surface but demoted. The merged "supply + collateral"
  // variant stays prominent because it represents a real state change.
  'aave-v4': ['collateral_toggle', 'collateral'],
  // Bare remove_collateral and soft-liq ticks are the noisy long tail on
  // LlamaLend timelines — surface them but demote so borrow/repay/open/close
  // stay on top of the filter list.
  'llamalend': ['remove_collateral', 'soft_liquidated'],
};

/** Actions hidden by default when entering a protocol (user can un-hide via filter) */
export const DEFAULT_HIDDEN_ACTIONS: Record<string, string[]> = {
  'liquity-v2-troves': ['setBatchManagerAnnualInterestRate'],
  'aave-v4': [],
  'llamalend': [],
};
