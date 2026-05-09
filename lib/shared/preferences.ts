// ── User Preferences — localStorage-backed persistence ─────────────────────

export type Theme = 'dark' | 'light';
export type RatioMode = 'cr' | 'ltv';

/** Per-protocol risk thresholds (Conservative / Moderate / Aggressive zones).
 *  Expressed as collateral ratio % so they sit in the same units the user
 *  reads on every position card. The runway widget translates these into bar
 *  positions using each trove's debt/coll/MCR. The MCR itself is fixed by the
 *  protocol — there is no "Liquidation" tier preference because at that point
 *  the position has no CR. */
export interface LiquityV2Preferences {
  crConservativeMin: number;   // CR ≥ this → Conservative/emerald (default 200)
  crModerateMin: number;       // CR ≥ this and < conservativeMin → Moderate/amber (default 150)
                               // CR < this → Aggressive/orange
}

export interface UserPreferences {
  _version: 1;
  expandedEvents: string[];         // txHash list, FIFO capped at MAX_EXPANDED
  theme: Theme;
  ratioMode: RatioMode;             // Display collateral health as Collateral Ratio (CR) or Loan-to-Value (LTV)
  hideClosedPositions: boolean;     // Hide closed/liquidated positions from selectors and the protocol nav
  liquityV2: LiquityV2Preferences;  // Per-protocol risk thresholds
}

const STORAGE_KEY = 'defi-explorer-preferences';
const MAX_EXPANDED = 200;

export const DEFAULT_LIQUITY_V2_PREFERENCES: LiquityV2Preferences = {
  crConservativeMin: 200,
  crModerateMin: 150,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  _version: 1,
  expandedEvents: [],
  theme: 'dark',
  ratioMode: 'cr',
  hideClosedPositions: false,
  liquityV2: DEFAULT_LIQUITY_V2_PREFERENCES,
};

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    if (parsed._version !== 1) return { ...DEFAULT_PREFERENCES };
    // Shallow merge for top-level + explicit deep-merge for nested
    // protocol prefs so a value added later (e.g. a new threshold field)
    // doesn't read as `undefined` on saves persisted before the field
    // existed.
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      liquityV2: { ...DEFAULT_LIQUITY_V2_PREFERENCES, ...(parsed.liquityV2 ?? {}) },
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function addExpandedEvent(prefs: UserPreferences, txHash: string): UserPreferences {
  const list = prefs.expandedEvents.filter(h => h !== txHash);
  list.push(txHash);
  if (list.length > MAX_EXPANDED) list.splice(0, list.length - MAX_EXPANDED);
  return { ...prefs, expandedEvents: list };
}

export function removeExpandedEvent(prefs: UserPreferences, txHash: string): UserPreferences {
  return { ...prefs, expandedEvents: prefs.expandedEvents.filter(h => h !== txHash) };
}
