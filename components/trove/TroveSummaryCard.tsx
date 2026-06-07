import { OpenSummaryCard } from "./OpenSummaryCard";
import { ClosedSummaryCard } from "./ClosedSummaryCard";
import { LiquidatedSummaryCard } from "./LiquidatedSummaryCard";
import { TroveSummary } from "@/types/api/trove";
import { TroveStateData } from "@/types/api/troveState";
import { OraclePricesData } from "@/types/api/oracle";

interface TroveSummaryCardProps {
  trove: TroveSummary;
  liveState?: TroveStateData;
  prices?: OraclePricesData;
  loadingStatus?: {
    message: string | null;
    snapshotDate?: number;
  };
  /** Detail page passes true: shows the live-data loader spinner and animates
   *  values when liveState resolves. Chooser/listing contexts leave it false. */
  expectsLiveState?: boolean;
  /** Listing context passes true to render the debt headline in compact
   *  notation ("48.1k"); the detail page leaves it false for full precision. */
  compact?: boolean;
  /** Header right-side activity cluster (last-activity time + tx counters).
   *  Listing keeps it; the detail page passes false. Defaults to true. */
  showActivityMeta?: boolean;
}

export function TroveSummaryCard({ trove, liveState, prices, loadingStatus, expectsLiveState, compact, showActivityMeta }: TroveSummaryCardProps) {
  if (trove.status === "liquidated") {
    return <LiquidatedSummaryCard trove={trove} />;
  }

  if (trove.status === "open") {
    return (
      <OpenSummaryCard
        trove={trove}
        liveState={liveState}
        prices={prices}
        loadingStatus={loadingStatus}
        expectsLiveState={expectsLiveState}
        compact={compact}
        showActivityMeta={showActivityMeta}
      />
    );
  }

  return <ClosedSummaryCard trove={trove} compact={compact} showActivityMeta={showActivityMeta} />;
}
