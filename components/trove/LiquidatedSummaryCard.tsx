import { formatDateRange, formatDuration } from "@/lib/date";
import { Icon } from "@/components/icons/icon";
import { HighlightableValue } from "@/components/transaction-timeline/explanation/HighlightableValue";
import { TroveIdentityRow } from "./trove-identity-row";
import { TroveSummary } from "@/types/api/trove";

interface LiquidatedSummaryCardProps {
  trove: TroveSummary;
}

export function LiquidatedSummaryCard({ trove }: LiquidatedSummaryCardProps) {
  return (
    <div>
      <div className="text-foreground">
        {/* Header — flat, no card background. LIQUIDATED pill carries the
            only chrome. */}
        <div className="grid grid-cols-[auto_1fr] gap-2 items-start">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold tracking-wider px-2 py-0.5 bg-red-700 text-white rounded-xs text-xs">
              LIQUIDATED
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-foreground/80">
              {trove.collateralType}
            </span>
            <TroveIdentityRow troveId={trove.id} collateralType={trove.collateralType} />
          </div>
          <div className="flex items-center gap-2 text-xs flex-wrap justify-end pt-0.5">
            <HighlightableValue type="dateRange" state="after">
              <span className="text-rb-500">
                {formatDateRange(trove.activity.createdAt, trove.activity.lastActivityAt)}
              </span>
            </HighlightableValue>
            <div className="flex items-center gap-1">
              <HighlightableValue type="duration" state="after">
                <span className="text-rb-500 rounded-lg bg-rb-100 dark:bg-rb-900 px-2">
                  {formatDuration(trove.activity.createdAt, trove.activity.lastActivityAt)}
                </span>
              </HighlightableValue>
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
        </div>
      </div>
    </div>
  );
}
