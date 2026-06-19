import { TokenIcon } from "@/components/icons/tokenIcon";
import { formatDuration } from "@/lib/date";
import { Icon } from "@/components/icons/icon";
import { formatApproximate, formatPrice } from "@/lib/utils/format";
import { HighlightableValue } from "@/components/transaction-timeline/explanation/HighlightableValue";
import { TroveIdentityRow } from "./trove-identity-row";
import { TroveSummary } from "@/types/api/trove";

interface ClosedSummaryCardProps {
  trove: TroveSummary;
  /** Listing context passes true to render the peak-debt headline in compact
   *  notation ("48.1k"); the detail page leaves it false for full precision. */
  compact?: boolean;
  /** Header right-side cluster (last-activity "X ago" + tx/redemption
   *  counters). Listing keeps the full cluster; the detail page passes "counts"
   *  for just the counters (the timeline header below carries "X ago").
   *  `false` hides the cluster. Defaults to true. */
  showActivityMeta?: boolean | "counts";
}

export function ClosedSummaryCard({ trove, compact = false, showActivityMeta = true }: ClosedSummaryCardProps) {
  const txCount = trove.activity.transactionCount - trove.activity.redemptionCount;
  return (
    <div>
      <div className="relative text-foreground">
        {/* Header — mirrors OpenSummaryCard: status pill + asset + identity
            on the left, "X ago" pill + redemption/tx counters on the right. */}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-bold px-2 py-0.5 rounded-full text-xs bg-rb-300 dark:bg-rb-700 text-foreground/80 dark:text-foreground/60">
              Closed
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-foreground/80">{trove.collateralType}</span>
            <TroveIdentityRow
              troveId={trove.id}
              collateralType={trove.collateralType}
              owner={trove.owner}
              lastOwner={trove.lastOwner}
              ownerEns={trove.ownerEns}
            />
          </span>
          {showActivityMeta && (
            <span className="flex items-center gap-2 text-xs text-rb-500">
              {showActivityMeta !== "counts" && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="clock-zap" size={12} />
                  {formatDuration(trove.activity.lastActivityAt, new Date())} ago
                </span>
              )}
              {trove.activity.redemptionCount > 0 && (
                <span className="inline-flex items-center text-orange-400">
                  <Icon name="triangle" size={12} />
                  <span className="ml-1">{trove.activity.redemptionCount}</span>
                </span>
              )}
              {txCount > 0 && (
                <span className="inline-flex items-center">
                  <Icon name="arrow-left-right" size={12} />
                  <span className="ml-1">{txCount}</span>
                </span>
              )}
            </span>
          )}
        </div>

        {/* Peak collateral first (mirrors OpenSummaryCard ordering), then peak debt. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <div>
            <div className="text-xs text-rb-500 font-semibold mb-1">Highest recorded Collateral</div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl lg:text-3xl font-bold">
                <HighlightableValue
                  type="peakCollateral"
                  state="after"
                  value={trove.collateral.peakAmount}
                  variant="card"
                  className="text-rb-500"
                >
                  {formatPrice(trove.collateral.peakAmount)}
                </HighlightableValue>
              </span>
              <TokenIcon assetSymbol={trove.collateralType} className="inline-block w-7 h-7" />
            </div>
          </div>
          <div>
            <div className="text-xs text-rb-500 font-semibold mb-1">Highest recorded Debt</div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl lg:text-3xl font-bold">
                <HighlightableValue
                  type="peakDebt"
                  state="after"
                  value={trove.debt.peak}
                  variant="card"
                  className="text-rb-500"
                >
                  {compact ? formatApproximate(trove.debt.peak) : formatPrice(trove.debt.peak)}
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
