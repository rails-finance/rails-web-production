import { TokenIcon } from "@/components/icons/tokenIcon";
import { formatDateRange, formatDuration } from "@/lib/date";
import { Icon } from "@/components/icons/icon";
import { formatPrice } from "@/lib/utils/format";
import { HighlightableValue } from "@/components/transaction-timeline/explanation/HighlightableValue";
import { TroveSummary } from "@/types/api/trove";

interface ClosedSummaryCardProps {
  trove: TroveSummary;
}

export function ClosedSummaryCard({ trove }: ClosedSummaryCardProps) {
  return (
    <div>
      <div className="relative text-foreground">
        {/* Header — flat, no card background. The CLOSED pill carries
            status; the rest sits on the page background. */}
        <div className="grid grid-cols-[auto_1fr] gap-2 items-start">
          <div className="flex items-center">
            <span className="font-bold tracking-wider px-2 py-0.5 bg-rb-500 dark:bg-rb-700 text-white rounded-xs text-xs">
              CLOSED
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs flex-wrap justify-end pt-0.5">
            <span className="text-rb-500">
              <HighlightableValue
                type="dateRange"
                state="after"
                value={`${trove.activity.createdAt}-${trove.activity.lastActivityAt}`}
                variant="card"
              >
                {formatDateRange(trove.activity.createdAt, trove.activity.lastActivityAt)}
              </HighlightableValue>
            </span>
            <span className="text-rb-500">
              <HighlightableValue
                type="duration"
                state="after"
                value={
                  (new Date(trove.activity.lastActivityAt).getTime() - new Date(trove.activity.createdAt).getTime()) /
                  1000
                }
                variant="card"
              >
                {formatDuration(trove.activity.createdAt, trove.activity.lastActivityAt)}
              </HighlightableValue>
            </span>
            {trove.activity.redemptionCount > 0 && (
              <span className="inline-flex items-center text-orange-400">
                <Icon name="triangle" size={12} />
                <span className="ml-1">{trove.activity.redemptionCount}</span>
              </span>
            )}
            <span className="inline-flex items-center text-rb-500">
              <Icon name="arrow-left-right" size={12} />
              <span className="ml-1">{trove.activity.transactionCount - trove.activity.redemptionCount}</span>
            </span>
          </div>
        </div>

        {/* Peak collateral first (mirrors OpenSummaryCard ordering), then peak debt. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 mt-3">
          <div>
            <div className="text-xs text-rb-500 font-semibold mb-1">Peak Collateral</div>
            <div className="flex items-center gap-1.5">
              <span className="text-3xl font-bold">
                <HighlightableValue type="peakCollateral" state="after" value={trove.collateral.peakAmount} variant="card">
                  {formatPrice(trove.collateral.peakAmount)}
                </HighlightableValue>
              </span>
              <TokenIcon assetSymbol={trove.collateralType} className="inline-block w-7 h-7" />
            </div>
          </div>
          <div>
            <div className="text-xs text-rb-500 font-semibold mb-1">Peak Debt</div>
            <div className="flex items-center gap-1.5">
              <span className="text-3xl font-bold">
                <HighlightableValue type="peakDebt" state="after" value={trove.debt.peak} variant="card">
                  {formatPrice(trove.debt.peak)}
                </HighlightableValue>
              </span>
              <TokenIcon assetSymbol="BOLD" className="inline-block w-7 h-7" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
