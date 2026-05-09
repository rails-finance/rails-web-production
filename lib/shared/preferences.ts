// ── User Preferences — localStorage-backed persistence ─────────────────────

export type Theme = 'dark' | 'light';
export type RatioMode = 'cr' | 'ltv';

/** Liquity V2 collateral branches. Each branch has its own MCR (110% on WETH,
 *  120% on wstETH/rETH) so the user-editable risk thresholds need their own
 *  scale per branch. Keep this list in sync with backend / sieve config. */
export const LIQUITY_V2_BRANCHES = ['WETH', 'wstETH', 'rETH'] as const;
export type LiquityV2Branch = typeof LIQUITY_V2_BRANCHES[number];

/** Per-branch risk thresholds (Conservative / Moderate / Aggressive zones).
 *  Expressed as collateral ratio % so they sit in the same units the user
 *  reads on every position card. The runway widget translates these into bar
 *  positions using each trove's debt/coll/MCR. The MCR itself is fixed by the
 *  protocol — there is no "Liquidation" tier preference because at that point
 *  the position has no CR. */
export interface LiquityV2BranchThresholds {
  crConservativeMin: number;   // CR ≥ this → Conservative/emerald
  crModerateMin: number;       // CR ≥ this and < conservativeMin → Moderate/amber
                               // CR < this → Aggressive/orange
}

export interface LiquityV2Preferences {
  byBranch: Record<LiquityV2Branch, LiquityV2BranchThresholds>;
}

export interface UserPreferences {
  _version: 1;
  expandedEvents: string[];         // txHash list, FIFO capped at MAX_EXPANDED
  theme: Theme;
  ratioMode: RatioMode;             // Display collateral health as Collateral Ratio (CR) or Loan-to-Value (LTV)
  hideClosedPositions: boolean;     // Hide closed/liquidated positions from selectors and the protocol nav
  liquityV2: LiquityV2Preferences;  // Per-branch risk thresholds
}

const STORAGE_KEY = 'defi-explorer-preferences';
const MAX_EXPANDED = 200;

/** Defaults sit ~1.82× and ~1.36× the branch MCR — same shape as the original
 *  WETH defaults (200/150 against MCR=110). Branches with MCR=120 round to
 *  220/165 so the buffer in MCR-multiples stays comparable across branches. */
export const DEFAULT_LIQUITY_V2_PREFERENCES: LiquityV2Preferences = {
  byBranch: {
    WETH:   { crConservativeMin: 200, crModerateMin: 150 },
    wstETH: { crConservativeMin: 220, crModerateMin: 165 },
    rETH:   { crConservativeMin: 220, crModerateMin: 165 },
  },
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  _version: 1,
  expandedEvents: [],
  theme: 'dark',
  ratioMode: 'cr',
  hideClosedPositions: false,
  liquityV2: DEFAULT_LIQUITY_V2_PREFERENCES,
};

/** Migrate the legacy flat `{ crConservativeMin, crModerateMin }` shape (a
 *  single global pair) to the per-branch shape, applying the saved values to
 *  every branch as a starting point. Per-branch defaults (which differ for
 *  120%-MCR branches) take over once the user resets. */
function normaliseLiquityV2(stored: unknown): LiquityV2Preferences {
  const out: LiquityV2Preferences = {
    byBranch: { ...DEFAULT_LIQUITY_V2_PREFERENCES.byBranch },
  };
  if (!stored || typeof stored !== 'object') return out;
  const s = stored as Record<string, unknown>;

  // Legacy flat shape — distribute saved values to every branch.
  if (typeof s.crConservativeMin === 'number' && typeof s.crModerateMin === 'number') {
    const flat: LiquityV2BranchThresholds = {
      crConservativeMin: s.crConservativeMin as number,
      crModerateMin: s.crModerateMin as number,
    };
    for (const b of LIQUITY_V2_BRANCHES) out.byBranch[b] = { ...flat };
  }

  // Current shape — merge per-branch overrides on top of defaults.
  const byBranch = (s.byBranch ?? null) as Partial<Record<LiquityV2Branch, LiquityV2BranchThresholds>> | null;
  if (byBranch && typeof byBranch === 'object') {
    for (const b of LIQUITY_V2_BRANCHES) {
      const branch = byBranch[b];
      if (branch && typeof branch.crConservativeMin === 'number' && typeof branch.crModerateMin === 'number') {
        out.byBranch[b] = { ...out.byBranch[b], ...branch };
      }
    }
  }
  return out;
}

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    if (parsed._version !== 1) return { ...DEFAULT_PREFERENCES };
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      liquityV2: normaliseLiquityV2(parsed.liquityV2),
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
