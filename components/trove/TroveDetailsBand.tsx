"use client";

import { Users } from "lucide-react";
import { TroveSummary } from "@/types/api/trove";
import { TroveStateData } from "@/types/api/troveState";
import { formatPrice, formatApproximate } from "@/lib/utils/format";
import { FadeNumber } from "@/components/ui/FadeNumber";

interface TroveDetailsBandProps {
  trove: TroveSummary;
  liveState?: TroveStateData;
  debtInFront?: number | null;
  trovesAhead?: number | null;
  debtInFrontLoading?: boolean;
}

/**
 * One shorthand stat-line beneath the headline grid: the labelled cost and
 * debt-in-front figures flow inline rather than sitting in separate columns
 * (`Costs: ~595.18 year +0.3%   Debt in front: 2.7M 41`). Each leads with its
 * label; the footnote directly below spells both out in plain language, so the
 * card carries only the glanceable figures. The delegate fee rides on as a
 * bare percentage + pink people glyph — the name and its BOLD/day cost live in
 * the footnote; the peak-collateral and debt-breakdown columns this band used
 * to carry were dropped because the economics chart shows them.
 */
export function TroveDetailsBand({
  trove,
  liveState,
  debtInFront,
  trovesAhead,
  debtInFrontLoading,
}: TroveDetailsBandProps) {
  if (trove.status !== "open") return null;

  const displayRecordedDebt = liveState?.debt.recorded ?? trove.debt.current;
  const displayInterestRate = liveState?.rates.annualInterestRate ?? trove.metrics.interestRate;

  // Only the annual base interest surfaces on the card; the per-day figure and
  // the delegate fee's BOLD/day cost both live in the footnote below.
  const annualInterestCost = (displayRecordedDebt * displayInterestRate) / 100;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-rb-500 leading-relaxed">
      {/* Costs — annual base interest plus the delegate's fee percentage. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="tabular-nums">
          Costs:{" "}
          <span className="text-foreground/80 font-semibold">
            ~<FadeNumber value={annualInterestCost} formatFn={formatPrice} animateOnMount={true} />
          </span>{" "}
          year
        </div>
        {trove.batch.isMember && (
          <div className="text-rb-500 inline-flex items-center gap-1 tabular-nums">
            <span className="text-foreground/80 font-semibold">+{trove.batch.managementFee}%</span>
            <Users className="w-3 h-3 shrink-0 text-pink-500" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Debt in front — flows on from costs, led by its label. */}
      {debtInFrontLoading ? (
        <div className="h-3 w-48 rounded-md bg-rb-200 dark:bg-rb-700 animate-pulse" />
      ) : debtInFront !== null && debtInFront !== undefined ? (
        <div className="tabular-nums">
          Debt in front:{" "}
          <span className="text-foreground/80 font-semibold">{formatApproximate(debtInFront)}</span>
          {trovesAhead !== null && trovesAhead !== undefined && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-rb-200 dark:bg-rb-700 px-1.5 py-px text-[0.7rem] font-semibold text-rb-500 align-middle">
              {trovesAhead}
            </span>
          )}
        </div>
      ) : (
        <div className="text-rb-500/70">Debt in front unavailable.</div>
      )}
    </div>
  );
}
