import { useMemo } from 'react';
import {
  type LiquityV2Branch,
  type LiquityV2BranchThresholds,
  type RatioMode,
  LIQUITY_V2_BRANCHES,
  DEFAULT_LIQUITY_V2_PREFERENCES,
} from '@/lib/shared/preferences';
import { usePreferences } from '@/lib/shared/preferences-context';

export function ratioLabel(mode: RatioMode): string {
  return mode === 'ltv' ? 'Loan-to-Value' : 'Collateral Ratio';
}

export function ratioLabelShort(mode: RatioMode): string {
  return mode === 'ltv' ? 'LTV' : 'CR';
}

// Convert a CR% value (e.g. 150 means 150%) to the display string for the chosen mode.
// LTV% = 10000 / CR%  (because LTV = debt/coll = 1 / (CR as ratio))
export function formatRatio(cr: number, mode: RatioMode, decimals = 1): string {
  if (!isFinite(cr) || cr <= 0) return mode === 'ltv' ? '—' : '0%';
  const value = mode === 'ltv' ? 10000 / cr : cr;
  return value.toFixed(decimals) + '%';
}

// Color class for a CR% value. Thresholds default to the Liquity V2 style
// (danger <150, warn <200, safe otherwise). Palette mirrors the price-runway
// zones — emerald = Conservative, amber = Caution. The Liquity hook below
// collapses the older three-tier (Cons/Mod/Agg) into two by leaving the
// danger threshold unset, so any CR below the Conservative cutoff renders
// amber; the orange/danger tier is still available to other protocols that
// want a finer split. Evaluation stays in CR terms regardless of display
// mode, so the colour remains accurate when the user has LTV enabled.
export interface RatioColorOptions {
  danger?: number;
  warn?: number;
  safeClass?: string;
  warnClass?: string;
  dangerClass?: string;
  zeroClass?: string;
}

export function ratioColorClass(cr: number, opts: RatioColorOptions = {}): string {
  const {
    danger = 150,
    warn = 200,
    safeClass = 'text-emerald-700 dark:text-emerald-400',
    warnClass = 'text-amber-600 dark:text-amber-400',
    dangerClass = 'text-orange-600 dark:text-orange-400',
    zeroClass = '',
  } = opts;
  if (!isFinite(cr) || cr <= 0) return zeroClass;
  if (cr < danger) return dangerClass;
  if (cr < warn) return warnClass;
  return safeClass;
}

/** Resolve a collateral-type string ("WETH", "wstETH", "rETH" — sometimes
 *  rendered as "ETH" in legacy events) to the branch key used by preferences.
 *  Unknown branches fall back to WETH so the colour palette is never undefined. */
export function resolveLiquityBranch(collateralType: string | undefined): LiquityV2Branch {
  if (!collateralType) return 'WETH';
  const normalised = collateralType === 'ETH' ? 'WETH' : collateralType;
  return (LIQUITY_V2_BRANCHES as readonly string[]).includes(normalised)
    ? (normalised as LiquityV2Branch)
    : 'WETH';
}

/**
 * React hook that returns a Liquity V2-aware ratio colourer. Reads the user's
 * per-branch Conservative threshold and produces a function
 * `(cr, branch, extraOpts?) => className`. Callers pass the trove's
 * collateral type so each branch's threshold applies correctly — a wstETH
 * trove (MCR 120) uses a different cut-off from a WETH trove (MCR 110).
 *
 * The 3-zone runway model collapses Moderate+Aggressive into a single Caution
 * band, so this hook is binary: emerald above the Conservative threshold,
 * amber below. `extraOpts` lets specific call sites override class names.
 */
export function useLiquityRatioColorClass(): (
  cr: number,
  branch: LiquityV2Branch | string | undefined,
  extraOpts?: RatioColorOptions,
) => string {
  const { prefs } = usePreferences();
  const byBranch = prefs.liquityV2.byBranch;
  return useMemo(() => {
    return (cr: number, branchInput: LiquityV2Branch | string | undefined, extraOpts: RatioColorOptions = {}) => {
      const branch = resolveLiquityBranch(branchInput);
      const t: LiquityV2BranchThresholds = byBranch[branch] ?? DEFAULT_LIQUITY_V2_PREFERENCES.byBranch[branch];
      // danger: 0 disables the orange tier — anything below the Conservative
      // threshold falls through to warnClass (amber), matching the runway's
      // single Caution band.
      return ratioColorClass(cr, { danger: 0, warn: t.crConservativeMin, ...extraOpts });
    };
  }, [byBranch]);
}
