import { useMemo } from 'react';
import type { RatioMode } from '@/lib/shared/preferences';
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
// zones — emerald = Conservative, amber = Moderate, orange = Aggressive — so
// a position's CR colour and its runway-zone colour stay in sync. There's no
// "Liquidation" tier here because at that point the position has no CR.
// Protocols with different MCRs or visual preferences override via opts (e.g.
// Aave's stricter thresholds, the position card's neutral safe). Evaluation
// stays in CR terms regardless of display mode, so the colour remains accurate
// when the user has LTV enabled.
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

/**
 * React hook that returns a Liquity V2-aware ratio colourer. Reads the user's
 * threshold preferences (Conservative / Moderate CR mins) and produces a
 * function `(cr, opts?) => className`. Callers pass any extra opts they want
 * — e.g. the position card overrides `safeClass` to neutral foreground — and
 * the prefs-driven thresholds win over the static defaults.
 */
export function useLiquityRatioColorClass(): (cr: number, extraOpts?: RatioColorOptions) => string {
  const { prefs } = usePreferences();
  const v2 = prefs.liquityV2;
  return useMemo(() => {
    return (cr: number, extraOpts: RatioColorOptions = {}) =>
      ratioColorClass(cr, { danger: v2.crModerateMin, warn: v2.crConservativeMin, ...extraOpts });
  }, [v2.crModerateMin, v2.crConservativeMin]);
}
