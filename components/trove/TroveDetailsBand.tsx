"use client";

import { Users } from "lucide-react";
import { TokenIcon } from "@/components/icons/tokenIcon";
import { TroveSummary } from "@/types/api/trove";
import { TroveStateData } from "@/types/api/troveState";
import { OraclePricesData } from "@/types/api/oracle";
import { formatPrice, formatUsdValue, formatApproximate } from "@/lib/utils/format";
import { getBatchManagerByAddress } from "@/lib/services/batch-manager-service";
import { LIQUIDATION_RESERVE_ETH } from "@/components/transaction-timeline/explanation/shared/eventHelpers";
import { FadeNumber } from "@/components/ui/FadeNumber";

interface TroveDetailsBandProps {
  trove: TroveSummary;
  liveState?: TroveStateData;
  prices?: OraclePricesData;
  debtInFront?: number | null;
  trovesAhead?: number | null;
  debtInFrontLoading?: boolean;
}

/**
 * 4-column band that mirrors the summary card's grid (Collateral / Debt /
 * Collateral Ratio / Liq Price) and surfaces the structured detail that used
 * to crowd the summary card itself: peak collateral, debt breakdown,
 * daily/annual cost, debt-in-front. Cells stay empty rather than fill for
 * symmetry's sake — the band breathes when there's nothing useful to say.
 */
export function TroveDetailsBand({
  trove,
  liveState,
  prices,
  debtInFront,
  trovesAhead,
  debtInFrontLoading,
}: TroveDetailsBandProps) {
  if (trove.status !== "open") return null;

  const batchManagerInfo = getBatchManagerByAddress(trove.batch.manager);

  const displayDebt = liveState?.debt.entire ?? trove.debt.current;
  const displayRecordedDebt = liveState?.debt.recorded ?? trove.debt.current;
  const displayAccruedInterest = liveState?.debt.accruedInterest;
  const displayInterestRate = liveState?.rates.annualInterestRate ?? trove.metrics.interestRate;
  const displayManagementFee = liveState?.rates.accruedBatchManagementFee;
  const displayCollateral = liveState?.collateral.entire ?? trove.collateral.amount;

  const annualInterestCost = (displayRecordedDebt * displayInterestRate) / 100;
  const dailyInterestCost = annualInterestCost / 365;
  const annualManagementFee = (displayRecordedDebt * trove.batch.managementFee) / 100;
  const dailyManagementFee = annualManagementFee / 365;

  const hasLiveData = liveState && prices;
  const collateralTokenKey = trove.collateralType.toLowerCase() as keyof OraclePricesData;
  const currentPrice = hasLiveData ? prices[collateralTokenKey] : null;

  // Peak collateral makes sense as the supplementary collateral line — it
  // contextualises the current Collateral number without duplicating it.
  const peakCollateral = trove.collateral.peakAmount;
  const peakCollateralUsd = currentPrice && peakCollateral > 0 ? peakCollateral * currentPrice : null;
  const showPeakCollateral = peakCollateral > 0 && peakCollateral !== displayCollateral;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-xs text-rb-500">
      {/* Column 1 — under Collateral */}
      <div className="space-y-1">
        {showPeakCollateral ? (
          <>
            <div className="text-rb-500/70 font-semibold uppercase tracking-wide text-[10px]">
              Peak Collateral
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-foreground font-semibold tabular-nums">
                {formatPrice(peakCollateral)}
              </span>
              <TokenIcon assetSymbol={trove.collateralType} className="inline-block w-4 h-4" />
            </div>
            {peakCollateralUsd !== null && (
              <div className="text-rb-500">≈ {formatUsdValue(peakCollateralUsd)}</div>
            )}
          </>
        ) : null}
      </div>

      {/* Column 2 — under Debt */}
      <div className="space-y-1">
        {displayAccruedInterest !== undefined ? (
          <>
            <div className="text-rb-500/70 font-semibold uppercase tracking-wide text-[10px]">
              Debt Breakdown
            </div>
            <div className="text-foreground/80 tabular-nums">
              <FadeNumber value={displayRecordedDebt} formatFn={formatPrice} animateOnMount={true} />{" "}
              <span className="text-rb-500">principal</span>
            </div>
            <div className="text-foreground/80 tabular-nums">
              + <FadeNumber value={displayAccruedInterest} formatFn={formatPrice} animateOnMount={true} />{" "}
              <span className="text-rb-500">interest</span>
            </div>
            {trove.batch.isMember && displayManagementFee !== undefined && displayManagementFee > 0 && (
              <div className="text-pink-500 tabular-nums">
                + <FadeNumber value={displayManagementFee} formatFn={formatPrice} animateOnMount={true} />{" "}
                <span className="text-pink-500/70">delegate fee</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-rb-500/70 font-semibold uppercase tracking-wide text-[10px]">
              Debt Breakdown
            </div>
            <div className="space-y-1">
              <div className="h-3 w-32 bg-rb-200 dark:bg-rb-800 rounded animate-pulse" />
              <div className="h-3 w-28 bg-rb-200 dark:bg-rb-800 rounded animate-pulse" />
            </div>
          </>
        )}
        {LIQUIDATION_RESERVE_ETH > 0 && (
          <div className="pt-1 text-rb-500">
            <span className="text-foreground/80 font-semibold">{LIQUIDATION_RESERVE_ETH} ETH</span> liquidation reserve
          </div>
        )}
      </div>

      {/* Column 3 — under Collateral Ratio */}
      <div className="space-y-1">
        <div className="text-rb-500/70 font-semibold uppercase tracking-wide text-[10px]">
          Interest Cost
        </div>
        <div className="text-foreground/80 tabular-nums">
          ~ <FadeNumber value={dailyInterestCost} formatFn={formatPrice} animateOnMount={true} />{" "}
          <span className="text-rb-500">/ day</span>
        </div>
        <div className="text-foreground/80 tabular-nums">
          ~ <FadeNumber value={annualInterestCost} formatFn={formatPrice} animateOnMount={true} />{" "}
          <span className="text-rb-500">/ year</span>
        </div>
        {trove.batch.isMember && (
          <div className="pt-1">
            <div className="inline-flex items-center gap-1 text-pink-500">
              <Users className="w-3 h-3" aria-hidden="true" />
              <span className="font-semibold">+{trove.batch.managementFee}%</span>
              <span className="text-pink-500/80">{batchManagerInfo?.name || "delegate"}</span>
            </div>
            <div className="text-pink-500/90 tabular-nums">
              ~ <FadeNumber value={dailyManagementFee} formatFn={formatPrice} animateOnMount={true} />{" "}
              <span className="text-pink-500/60">/ day</span>
              {" · "}
              <FadeNumber value={annualManagementFee} formatFn={formatPrice} animateOnMount={true} />{" "}
              <span className="text-pink-500/60">/ year</span>
            </div>
          </div>
        )}
      </div>

      {/* Column 4 — under Liq Price */}
      <div className="space-y-1">
        <div className="text-rb-500/70 font-semibold uppercase tracking-wide text-[10px]">
          Debt in Front
        </div>
        {debtInFrontLoading ? (
          <div className="space-y-1">
            <div className="h-3 w-24 bg-rb-200 dark:bg-rb-800 rounded animate-pulse" />
            <div className="h-3 w-32 bg-rb-200 dark:bg-rb-800 rounded animate-pulse" />
          </div>
        ) : debtInFront !== null && debtInFront !== undefined ? (
          <>
            <div className="text-foreground/80 font-semibold tabular-nums">
              {formatApproximate(debtInFront)} <span className="text-rb-500 font-normal">BOLD</span>
            </div>
            {trovesAhead !== null && trovesAhead !== undefined && (
              <div className="text-rb-500">
                across {trovesAhead} trove{trovesAhead !== 1 ? "s" : ""} at same or lower rate
              </div>
            )}
          </>
        ) : (
          <div className="text-rb-500/70">—</div>
        )}
      </div>
    </div>
  );
}
