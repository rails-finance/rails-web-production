import type { RatioMode } from '@/lib/shared/preferences';

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

// Color class for a CR% value. Thresholds and colors default to the Liquity V2 style
// (danger <150, warn <200, safe otherwise). Protocols with different MCRs or visual
// preferences override via opts — e.g. Aave's stricter thresholds, f(x)'s white safe,
// Frankencoin's emerald/amber palette. Evaluation stays in CR terms regardless of
// display mode, so the color remains accurate when the user has LTV enabled.
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
    safeClass = 'text-green-700 dark:text-green-400',
    warnClass = 'text-yellow-600 dark:text-yellow-400',
    dangerClass = 'text-red-700 dark:text-red-400',
    zeroClass = '',
  } = opts;
  if (!isFinite(cr) || cr <= 0) return zeroClass;
  if (cr < danger) return dangerClass;
  if (cr < warn) return warnClass;
  return safeClass;
}
