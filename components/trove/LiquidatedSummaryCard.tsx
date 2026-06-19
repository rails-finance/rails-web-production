import { formatDuration } from "@/lib/date";
import { Icon } from "@/components/icons/icon";
import { TroveIdentityRow } from "./trove-identity-row";
import { TroveSummary } from "@/types/api/trove";

interface LiquidatedSummaryCardProps {
  trove: TroveSummary;
}

export function LiquidatedSummaryCard({ trove }: LiquidatedSummaryCardProps) {
  const txCount = trove.activity.transactionCount - trove.activity.redemptionCount;
  return (
    <div>
      <div className="text-foreground">
        {/* Header mirrors Open/Closed: status pill + asset + identity on the
            left, "X ago" pill + redemption/tx counters on the right. */}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-bold px-2 py-0.5 rounded-sm text-xs uppercase bg-red-500/20 text-red-500">Liquidated</span>
            <span className="text-xs font-bold uppercase tracking-wide text-foreground/80">{trove.collateralType}</span>
            <TroveIdentityRow
              troveId={trove.id}
              collateralType={trove.collateralType}
              owner={trove.owner}
              lastOwner={trove.lastOwner}
              ownerEns={trove.ownerEns}
            />
          </span>
          <span className="flex items-center gap-2 text-xs text-rb-500">
            <span className="inline-flex items-center gap-1">
              <Icon name="clock-zap" size={12} />
              {formatDuration(trove.activity.lastActivityAt, new Date())} ago
            </span>
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
        </div>
      </div>
    </div>
  );
}
