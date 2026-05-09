"use client";

import type { ReactNode } from "react";
import { EventCard } from "@/components/shared/event-card";
import { SpineColumn, type SpineTokenRow } from "@/components/shared/spine-column";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { useHeaderValueHideClass } from "@/lib/shared/header-values";
import { formatNum } from "@/lib/shared/format-event";

/**
 * Shared chrome for protocol "what-if" simulators. Wraps EventCard with
 * action chips (Add / Withdraw / Borrow / Repay), Reset + Close controls,
 * and a dotted blue spine. The detail body is protocol-specific and passed
 * in as children — health/CR metrics live there, not in the header.
 */

export interface SimulatorActionChip {
  label: string;
  symbol: string;
  address?: string;
  /** Amount rendered in the header (respects the Header Amounts display toggle). */
  amount?: number;
}

export interface SimulatorCardShellProps {
  avatar?: ReactNode;
  /** Tokens to render on the spine. Falls back to the reward glyph when empty. */
  tokens?: SpineTokenRow[];
  /** Action chips derived from user edits (e.g. "Add wstETH") */
  actionChips?: SimulatorActionChip[];
  /** Shown when there are no action chips. Defaults to "What if?". */
  fallbackTitle?: ReactNode;
  /** Enables the Reset button */
  hasChanges: boolean;
  onReset: () => void;
  onClose?: () => void;
  /** Detail body (protocol-specific inputs + metrics) */
  children: ReactNode;
}

export function SimulatorCardShell({
  avatar,
  tokens,
  actionChips,
  fallbackTitle = "What if?",
  hasChanges,
  onReset,
  onClose,
  children,
}: SimulatorCardShellProps) {
  const hideVal = useHeaderValueHideClass();
  const iconSlot = tokens && tokens.length > 0 ? (
    <SpineColumn tokens={tokens} spine="dotted" color="blue" isLast={true} detached />
  ) : (
    <SpineColumn icon="reward" spine="dotted" color="blue" isLast={true} detached />
  );

  const header = (
    <div className="px-5 pt-4 pb-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {actionChips && actionChips.length > 0 ? (
          actionChips.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-sm">
              <span>{chip.label}</span>
              {chip.amount !== undefined && (
                <span className={`font-bold ${hideVal}`}>{formatNum(chip.amount)}</span>
              )}
              <TokenChipIcon symbol={chip.symbol} address={chip.address} size={16} />
            </span>
          ))
        ) : (
          <span className="text-sm">{fallbackTitle}</span>
        )}
        <span className="inline-flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            disabled={!hasChanges}
            aria-label="Reset simulation"
            title="Reset sliders to current state"
            className={`inline-flex items-center justify-center rounded transition-colors ${
              hasChanges
                ? "text-rb-500 hover:text-rb-700 dark:hover:text-rb-300 cursor-pointer"
                : "text-rb-400 dark:text-rb-700 cursor-default"
            }`}
            style={{ width: 22, height: 22 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              aria-label="Close simulator"
              title="Close simulator"
              className="inline-flex items-center justify-center rounded-md bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 hover:text-red-300 transition-colors"
              style={{ width: 22, height: 22 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </span>
      </div>
    </div>
  );

  return (
    <EventCard
      avatar={avatar ?? <div className="hidden sm:block" />}
      iconColumn={iconSlot}
      header={header}
      detail={<div className="px-4 pt-3 pb-3">{children}</div>}
      detailOpen={true}
      hideDetailChevron
    />
  );
}
