// ── User Preferences — localStorage-backed persistence ─────────────────────

export type Theme = 'dark' | 'light';
export type RatioMode = 'cr' | 'ltv';

export interface UserPreferences {
  _version: 1;
  expandedEvents: string[];         // txHash list, FIFO capped at MAX_EXPANDED
  theme: Theme;
  ratioMode: RatioMode;             // Display collateral health as Collateral Ratio (CR) or Loan-to-Value (LTV)
  hideClosedPositions: boolean;     // Hide closed/liquidated positions from selectors and the protocol nav
}

const STORAGE_KEY = 'defi-explorer-preferences';
const MAX_EXPANDED = 200;

export const DEFAULT_PREFERENCES: UserPreferences = {
  _version: 1,
  expandedEvents: [],
  theme: 'dark',
  ratioMode: 'cr',
  hideClosedPositions: false,
};

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    if (parsed._version !== 1) return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...parsed };
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
