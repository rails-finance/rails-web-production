"use client";

import { Users } from "lucide-react";
import { TroveSummary } from "@/types/api/trove";
import { TroveStateData } from "@/types/api/troveState";
import { formatPrice, formatApproximate } from "@/lib/utils/format";
import { getBatchManagerByAddress } from "@/lib/services/batch-manager-service";
import { FadeNumber } from "@/components/ui/FadeNumber";

interface TroveDetailsBandProps {
  trove: TroveSummary;
  liveState?: TroveStateData;
  debtInFront?: number | null;
  trovesAhead?: number | null;
  debtInFrontLoading?: boolean;
}

/**
 * Two sentence-stats — interest cost and debt-in-front — each spanning half the
 * width beneath the headline grid. The peak-collateral and debt-breakdown
 * columns this band used to carry were dropped: they restate what the economics
 * chart directly below already shows (Deposited / principal + interest). What's
 * left is the pair that *isn't* in the chart and is the reason to read the card:
 * what the position costs to hold, and how much debt shields it from redemption.
 */
export function TroveDetailsBand({
  trove,
  liveState,
  debtInFront,
  trovesAhead,
  debtInFrontLoading,
}: TroveDetailsBandProps) {
  if (trove.status !== "open") return null;

  const batchManagerInfo = getBatchManagerByAddress(trove.batch.manager);

  const displayRecordedDebt = liveState?.debt.recorded ?? trove.debt.current;
  const displayInterestRate = liveState?.rates.annualInterestRate ?? trove.metrics.interestRate;

  const annualInterestCost = (displayRecordedDebt * displayInterestRate) / 100;
  const dailyInterestCost = annualInterestCost / 365;
  const annualManagementFee = (displayRecordedDebt * trove.batch.managementFee) / 100;
  const dailyManagementFee = annualManagementFee / 365;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-xs text-rb-500 leading-relaxed">
      {/* Interest cost — left half, under Collateral / Debt */}
      <div className="col-span-2 space-y-1">
        <div>
          Costs{" "}
          <span className="text-foreground/80 font-semibold tabular-nums">
            ~<FadeNumber value={dailyInterestCost} formatFn={formatPrice} animateOnMount={true} /> BOLD
          </span>{" "}
          / day to hold, or{" "}
          <span className="text-foreground/80 font-semibold tabular-nums">
            ~<FadeNumber value={annualInterestCost} formatFn={formatPrice} animateOnMount={true} /> BOLD
          </span>{" "}
          / year.
        </div>
        {trove.batch.isMember && (
          <div className="text-pink-500 inline-flex items-center gap-1 flex-wrap">
            <Users className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>
              {batchManagerInfo?.name || "Delegate"} adds{" "}
              <span className="font-semibold tabular-nums">+{trove.batch.managementFee}%</span>
              {" — ~"}
              <span className="tabular-nums">
                <FadeNumber value={dailyManagementFee} formatFn={formatPrice} animateOnMount={true} />
              </span>{" "}
              / day.
            </span>
          </div>
        )}
      </div>

      {/* Debt in front — right half, under Collateral Ratio / Liq Price */}
      <div className="col-span-2 space-y-1">
        {debtInFrontLoading ? (
          <div className="h-3 w-48 rounded-md bg-rb-200 dark:bg-rb-700 animate-pulse" />
        ) : debtInFront !== null && debtInFront !== undefined ? (
          <div>
            <span className="text-foreground/80 font-semibold tabular-nums">{formatApproximate(debtInFront)} BOLD</span>{" "}
            sits ahead in the redemption queue
            {trovesAhead !== null && trovesAhead !== undefined && (
              <>
                , across {trovesAhead} trove{trovesAhead !== 1 ? "s" : ""} at the same or lower rate
              </>
            )}
            .
          </div>
        ) : (
          <div className="text-rb-500/70">Debt in front unavailable.</div>
        )}
      </div>
    </div>
  );
}
