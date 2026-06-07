"use client";

import { TokenIcon } from "@/components/icons/tokenIcon";
import { Icon } from "@/components/icons/icon";
import { TroveIdentityRow } from "./trove-identity-row";
import { TroveSummary } from "@/types/api/trove";
import { getBatchManagerByAddress, getBatchManagerDeprecation } from "@/lib/services/batch-manager-service";
import { formatDate } from "@/lib/date";
import { formatApproximate, formatPrice, formatUsdValue } from "@/lib/utils/format";
import { getLiquidationThreshold } from "@/lib/utils/liquidation-utils";
import { HighlightableValue } from "@/components/transaction-timeline/explanation/HighlightableValue";
import { Users, Loader2, AlertTriangle } from "lucide-react";
import { TroveStateData } from "@/types/api/troveState";
import { OraclePricesData } from "@/types/api/oracle";
import { FadeNumber } from "@/components/ui/FadeNumber";
import { formatDuration } from "@/lib/date";

const ARM_DEPRECATION_ANNOUNCEMENT = "https://discord.com/channels/700620821198143498/711975093940519012/1487025900208783530";

// OpenSummaryCard is rendered inside Link-wrapped cards on listing/umbrella
// pages, so an inner <a> would nest anchors (invalid HTML, React hydration
// error). Render the announcement as a focusable span that opens the URL via
// click/keypress and stops propagation so the card's outer Link doesn't fire.
function AnnouncementLink() {
  const open = () => {
    if (typeof window !== "undefined") {
      window.open(ARM_DEPRECATION_ANNOUNCEMENT, "_blank", "noopener,noreferrer");
    }
  };
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        open();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          open();
        }
      }}
      className="underline hover:no-underline cursor-pointer"
    >
      Official announcement
    </span>
  );
}

interface OpenSummaryCardProps {
  trove: TroveSummary;
  liveState?: TroveStateData;
  prices?: OraclePricesData;
  loadingStatus?: {
    message: string | null;
    snapshotDate?: number;
  };
  /** Detail page passes true so the live-data loader spinner shows while
   *  liveState resolves. Chooser/listing contexts leave it false — they
   *  intentionally don't fetch liveState and shouldn't appear "loading". */
  expectsLiveState?: boolean;
  /** Listing context passes true to render the debt headline in compact
   *  notation ("48.1k") for scannability; the detail page leaves it false so
   *  the full-precision value ("48,148.74") shows. */
  compact?: boolean;
}

// Liq prices vary widely (BTC ~$100k, USDC ~$1). Match rails-explorer's
// magnitude-aware formatting so we don't get either "$100,000.00" or "$0".
function fmtLiqPrice(p: number): string {
  if (p < 0.01) return "< $0.01";
  if (p < 1) return "$" + p.toFixed(3);
  if (p < 100) return "$" + p.toFixed(2);
  if (p < 1_000) return "$" + p.toFixed(0);
  if (p < 1_000_000) return "$" + (p / 1000).toFixed(p < 10_000 ? 2 : 1) + "K";
  return "$" + (p / 1_000_000).toFixed(2) + "M";
}

export function OpenSummaryCard({ trove, liveState, prices, loadingStatus, expectsLiveState = false, compact = false }: OpenSummaryCardProps) {
  const batchManagerInfo = getBatchManagerByAddress(trove.batch.manager);
  const deprecation = getBatchManagerDeprecation(trove.batch.manager);

  const displayDebt = liveState?.debt.entire ?? trove.debt.current;
  const displayInterestRate = liveState?.rates.annualInterestRate ?? trove.metrics.interestRate;
  const displayCollateral = liveState?.collateral.entire ?? trove.collateral.amount;

  // Snapshot data is the floor; price-derived metrics work whenever prices
  // are available, even if liveState hasn't (or won't) resolve.
  const collateralTokenKey = trove.collateralType.toLowerCase() as keyof OraclePricesData;
  const currentPrice = prices ? prices[collateralTokenKey] : null;
  const collateralUsd = currentPrice ? displayCollateral * currentPrice : null;
  const collateralRatio = collateralUsd && displayDebt > 0 ? (collateralUsd / displayDebt) * 100 : null;
  const animateValues = expectsLiveState;

  const mcr = getLiquidationThreshold(trove.collateralType);
  const liqPrice = displayCollateral > 0 && displayDebt > 0
    ? (displayDebt * (mcr / 100)) / displayCollateral
    : null;
  const headroomPct = liqPrice !== null && currentPrice && currentPrice > 0
    ? Math.max(0, ((currentPrice - liqPrice) / currentPrice) * 100)
    : null;

  const txCount = trove.activity.transactionCount - trove.activity.redemptionCount;

  return (
    <div>
      {deprecation && (
        <div className={`flex items-start gap-2 rounded-lg p-3 mb-2 text-sm ${
          deprecation.isPast
            ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900"
            : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900"
        }`}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            {deprecation.isPast ? (
              <>The {batchManagerInfo?.name} delegate is no longer maintained and has been removed from the frontend. Please move your position to a new delegate. <AnnouncementLink /></>
            ) : (
              <>The {batchManagerInfo?.name} delegate will no longer be maintained after {new Date(deprecation.deprecatedDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Please move your position to a new delegate before this date. <AnnouncementLink /></>
            )}
          </p>
        </div>
      )}

      <div className="text-foreground">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-bold tracking-wider px-2 py-0.5 text-white bg-green-500 dark:bg-green-950 dark:text-green-500/70 rounded-xs text-xs">
              OPEN
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-foreground/80">
              {trove.collateralType}
            </span>
            <TroveIdentityRow troveId={trove.id} collateralType={trove.collateralType} />
            {/* Delegate marker — name lives in the row below the card, the
                fuchsia icon here is just a status flag. */}
            {trove.batch.isMember && (
              <span
                className="inline-flex items-center text-pink-500/90"
                title={batchManagerInfo?.name ? `Delegate: ${batchManagerInfo.name}` : "Delegate-managed"}
              >
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            )}
            {expectsLiveState && (!liveState || !currentPrice) && (
              <Loader2 className="w-3.5 h-3.5 text-rb-500 animate-spin" />
            )}
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {/* Collateral */}
          <div>
            <div className="text-xs text-rb-500 font-semibold mb-1">Collateral</div>
            <div className="flex items-center gap-1.5">
              <span className="text-3xl font-bold">
                <HighlightableValue type="collateral" state="after" value={displayCollateral}>
                  <FadeNumber value={displayCollateral} animateOnMount={animateValues} />
                </HighlightableValue>
              </span>
              <TokenIcon assetSymbol={trove.collateralType} className="inline-block w-7 h-7" />
            </div>
            <div className="text-xs mt-0.5 min-h-[1rem]">
              {collateralUsd !== null && collateralUsd > 0 ? (
                <span className="inline-flex items-center font-bold text-green-400 border-l-2 border-r-2 border-green-400 rounded-sm px-1 py-0">
                  <HighlightableValue type="collateralUsd" state="after" value={collateralUsd} className="text-green-400">
                    <FadeNumber value={collateralUsd} formatFn={formatUsdValue} animateOnMount={animateValues} />
                  </HighlightableValue>
                </span>
              ) : expectsLiveState ? (
                <span className="inline-block h-3 w-16 bg-rb-200 dark:bg-rb-800 rounded animate-pulse" />
              ) : null}
            </div>
          </div>

          {/* Debt */}
          <div>
            <div className="text-xs text-rb-500 font-semibold mb-1">Debt</div>
            <div className="flex items-center gap-1.5">
              <span className="text-3xl font-bold">
                <HighlightableValue type="debt" state="after" value={displayDebt}>
                  <FadeNumber value={displayDebt} formatFn={compact ? formatApproximate : formatPrice} animateOnMount={animateValues} />
                </HighlightableValue>
              </span>
              <TokenIcon assetSymbol="BOLD" className="inline-block w-7 h-7" />
            </div>
            <div className="text-xs mt-0.5 text-rb-500">
              <HighlightableValue type="interestRate" state="after" value={displayInterestRate}>
                <FadeNumber value={displayInterestRate} decimals={2} animateOnMount={animateValues} />%
              </HighlightableValue>
              {" "}interest rate
            </div>
          </div>

          {/* Collateral Ratio */}
          <div>
            <div className="text-xs text-rb-500 font-semibold mb-1">Collateral Ratio</div>
            {currentPrice && collateralRatio !== null && collateralRatio > 0 ? (
              <div className="text-3xl font-bold">
                <HighlightableValue type="collRatio" state="after" value={parseFloat(collateralRatio.toFixed(1))}>
                  <FadeNumber value={collateralRatio} decimals={1} animateOnMount={animateValues} />%
                </HighlightableValue>
              </div>
            ) : expectsLiveState ? (
              <div className="h-9 w-20 bg-rb-200 dark:bg-rb-800 rounded animate-pulse" />
            ) : (
              <div className="text-3xl font-bold text-rb-500">—</div>
            )}
            <div className="text-xs mt-0.5 text-rb-500">Min {mcr}% threshold</div>
          </div>

          {/* Liq Price */}
          <div>
            <div className="text-xs text-rb-500 font-semibold mb-1">
              Liq Price ({trove.collateralType})
            </div>
            {liqPrice !== null ? (
              <div className="flex items-center gap-1.5">
                <span className="text-3xl font-bold">{fmtLiqPrice(liqPrice)}</span>
                <TokenIcon assetSymbol={trove.collateralType} className="inline-block w-7 h-7" />
              </div>
            ) : (
              <div className="text-3xl font-bold text-rb-500">—</div>
            )}
            <div className="text-xs mt-0.5 text-rb-500 min-h-[1rem]">
              {headroomPct !== null ? (
                <>{headroomPct.toFixed(0)}% headroom</>
              ) : expectsLiveState ? (
                <span className="inline-block h-3 w-20 bg-rb-200 dark:bg-rb-800 rounded animate-pulse" />
              ) : null}
            </div>
          </div>
        </div>

        {loadingStatus?.message && (
          <div className="flex justify-end mt-3">
            <div className="text-xs text-rb-500 text-right">
              {loadingStatus.snapshotDate && <div>Snapshot from {formatDate(loadingStatus.snapshotDate)}.</div>}
              <div className="italic">{loadingStatus.message}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
