// ── User Preferences — localStorage-backed persistence ─────────────────────

export type Theme = 'dark' | 'light';
export type RatioMode = 'cr' | 'ltv';

/** Liquity V2 collateral branches. Each branch has its own MCR (110% on WETH,
 *  120% on wstETH/rETH) so the user-editable risk thresholds need their own
 *  scale per branch. Keep this list in sync with backend / sieve config. */
export const LIQUITY_V2_BRANCHES = ['WETH', 'wstETH', 'rETH'] as const;
export type LiquityV2Branch = typeof LIQUITY_V2_BRANCHES[number];

/** Per-branch risk threshold. The runway uses a 3-zone model:
 *    Conservative — CR ≥ crConservativeMin (open-ended on the safe side)
 *    Caution      — MCR < CR < crConservativeMin (bounded interior)
 *    Liquidation  — CR ≤ MCR (open-ended on the loss side; trove is liquidatable)
 *  Only the Conservative→Caution boundary is user-editable; the lower bound
 *  is fixed by the branch's MCR. */
export interface LiquityV2BranchThresholds {
  crConservativeMin: number;   // CR ≥ this → Conservative/emerald
                               // CR < this → Caution/amber
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

/** Defaults sit ~1.82× the branch MCR — original WETH default (200 against
 *  MCR=110). Branches with MCR=120 round to 220 so the buffer in
 *  MCR-multiples stays comparable across branches. */
export const DEFAULT_LIQUITY_V2_PREFERENCES: LiquityV2Preferences = {
  byBranch: {
    WETH:   { crConservativeMin: 200 },
    wstETH: { crConservativeMin: 220 },
    rETH:   { crConservativeMin: 220 },
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

/** Migrate older preference shapes:
 *    1. Legacy flat `{ crConservativeMin, crModerateMin }` — keep
 *       `crConservativeMin`, drop `crModerateMin`, apply to every branch.
 *    2. Earlier per-branch shape with `crModerateMin` alongside
 *       `crConservativeMin` — keep `crConservativeMin`, drop the rest.
 *    3. Current per-branch shape with just `crConservativeMin` — pass through. */
function normaliseLiquityV2(stored: unknown): LiquityV2Preferences {
  const out: LiquityV2Preferences = {
    byBranch: { ...DEFAULT_LIQUITY_V2_PREFERENCES.byBranch },
  };
  if (!stored || typeof stored !== 'object') return out;
  const s = stored as Record<string, unknown>;

  // Legacy flat shape — distribute saved Conservative threshold to every branch.
  if (typeof s.crConservativeMin === 'number') {
    const flat: LiquityV2BranchThresholds = { crConservativeMin: s.crConservativeMin as number };
    for (const b of LIQUITY_V2_BRANCHES) out.byBranch[b] = { ...flat };
  }

  // Per-branch shape — keep only the Conservative threshold; older
  // `crModerateMin` keys are silently dropped.
  const byBranch = (s.byBranch ?? null) as Partial<Record<LiquityV2Branch, { crConservativeMin?: number }>> | null;
  if (byBranch && typeof byBranch === 'object') {
    for (const b of LIQUITY_V2_BRANCHES) {
      const branch = byBranch[b];
      if (branch && typeof branch.crConservativeMin === 'number') {
        out.byBranch[b] = { crConservativeMin: branch.crConservativeMin };
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
