import Link from "next/link";
import { TroveSummary } from "@/types/api/trove";
import { Icon } from "../icons/icon";
import { formatPrice, formatApproximate } from "@/lib/utils/format";
import { CardFooter } from "../trove/components/CardFooter";
import { ChevronRight } from "lucide-react";
import { formatDuration } from "@/lib/date";
import { TokenIcon } from "../icons/tokenIcon";

export function ClosedListingCard({ trove, selectorMode = false }: { trove: TroveSummary; selectorMode?: boolean }) {
  // Save scroll position when navigating to trove detail
  const handleClick = (e: React.MouseEvent) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("troves-scroll-position", String(window.scrollY));
    }
  };

  return (
    <Link
      href={`/liquity-v2/trove/${trove.collateralType}/${trove.id}`}
      onClick={handleClick}
      className={
        selectorMode
          ? "block relative text-foreground transition-colors cursor-pointer group"
          : "block relative rounded-xl text-foreground bg-sunken hover:bg-rb-300 dark:hover:bg-rb-800 transition-colors cursor-pointer group"
      }
      aria-label={`View closed trove ${trove.id.substring(0, 8)}... with peak debt of ${formatApproximate(trove.debt.peak)} BOLD`}
    >
      {/* Header section */}
      <div className="flex items-center justify-between p-4 pb-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold tracking-wider px-2 py-0.5 bg-rb-500 dark:bg-rb-800 text-rb-50 dark:text-rb-400 rounded-xs">
            CLOSED
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
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

      {/* Content section - single responsive structure */}
      <div className="pt-2 p-4 space-y-4">
        {/* Main content grid - matching OpenListingCard 4-column layout */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 md:items-start">
          {/* Highest recorded debt - spans 2 columns on mobile, 1 on desktop */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-xs text-rb-500 mb-1 font-semibold uppercase tracking-wider">Highest recorded debt</p>
            <div className="flex items-center">
              <h3 className="text-xl lg:text-3xl font-bold text-foreground">
                {formatApproximate(trove.debt.peak)}
              </h3>
              <span className="ml-2 text-green-600">
                <TokenIcon assetSymbol="BOLD" className="w-6 md:w-7 h-6 md:h-7 relative top-0" />
              </span>
            </div>
          </div>

          {/* Highest recorded collateral - spans 2 columns on mobile, 1 on desktop */}
          <div className="col-span-2 md:col-span-1">
            <p className="text-xs text-rb-500 mb-1 font-semibold uppercase tracking-wider">Highest recorded collateral</p>
            <div className="flex items-center">
              <p className="text-lg md:text-xl font-bold mr-1 text-foreground">
                {formatApproximate(trove.collateral.peakAmount)}
              </p>
              <TokenIcon assetSymbol={trove.collateralType} />
            </div>
          </div>
        </div>

        {/* Footer with view button */}
        <div className="flex items-center justify-between">
          <CardFooter
            trove={trove}
            dateText={`${formatDuration(trove.activity.lastActivityAt, new Date())} ago`}
            showDetailedInfo={false}
          />
          {!selectorMode && (
            <div className="flex items-center bg-rb-300 dark:bg-rb-800 group-hover:bg-blue-500 transition-colors rounded-full pl-3 pr-2 py-1">
              <span className="text-sm text-rb-500 group-hover:text-white font-semibold flex items-center gap-1">
                <Icon name="timeline" size={20} aria-hidden="true" />
                View
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
