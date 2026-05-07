// ============================================================================
// EVENT FILTER HELPERS
// ============================================================================
//
// Liquity-only port of rails-explorer's event-filter-helpers. Keeps the same
// function names so the FilterDropdown wiring is symmetric, but typed against
// BaseActivityEvent (the web-mig event shape) and trimmed to the operations
// that matter for the trove view.

import type { BaseActivityEvent } from '@/lib/shared/types/event-shape';
import { isLiquityEvent } from '@/lib/shared/types/event-shape';

/** Get the canonical action key for an event (used for type-level filtering) */
export function getEventActionKey(e: BaseActivityEvent): string {
  if (isLiquityEvent(e)) {
    return e.context.data.operation ?? e.actionType ?? 'unknown';
  }
  return e.actionType ?? 'unknown';
}

/** Display label for a Liquity V2 operation key — mirrors the labels used by
 * LiquityEventHeader's getOperationStyle so the filter dropdown reads the same
 * as the row chips. */
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

export function actionLabel(actionKey: string): string {
  return LIQUITY_OP_LABELS[actionKey] ?? actionKey;
}

/** Actions that are demoted (shown last in the filter list, often noisy). */
export const DEMOTED_ACTIONS: Record<string, string[]> = {
  'liquity-v2-troves': ['setBatchManagerAnnualInterestRate', 'applyPendingDebt'],
};

/** Actions hidden by default when entering a protocol (user can un-hide via filter) */
export const DEFAULT_HIDDEN_ACTIONS: Record<string, string[]> = {
  'liquity-v2-troves': ['setBatchManagerAnnualInterestRate'],
};
