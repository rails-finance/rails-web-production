"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { TroveSummary, TrovesResponse } from "@/types/api/trove";
import { TroveSummaryCard } from "@/components/trove/TroveSummaryCard";
import { TroveEconomicsSummary } from "@/components/trove/TroveEconomicsSummary";
import { formatDuration } from "@/lib/date";
import { Icon } from "@/components/icons/icon";
import { TokenIcon } from "@/components/icons/tokenIcon";
import { FeedbackButton } from "@/components/FeedbackButton";
import { TroveStateData, TroveStateResponse } from "@/types/api/troveState";
import { OraclePricesData, OraclePricesResponse } from "@/types/api/oracle";
import { useTroveUiState } from "@/hooks/useTroveUiState";
import { useDebtInFront } from "@/hooks/useDebtInFront";

import { fetchTroveTimeline } from "@/lib/api/fetch-timeline";
import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isLiquityEvent } from "@/lib/shared/types/event-shape";
import { LiquityEventCard } from "@/components/protocol/liquity/liquity-event-card";
import { TimelineDisplayProvider } from "@/components/shared/timeline-display-context";
import { LiquityTroveBarsProvider } from "@/lib/liquity/use-trove-bars";

function isRedemptionEvent(e: BaseActivityEvent): boolean {
  return isLiquityEvent(e) && e.context.data.eventType === "redemption";
}

function isBatchManagerEvent(e: BaseActivityEvent): boolean {
  return isLiquityEvent(e) && e.context.data.eventType === "batch_manager";
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1 pl-1.5 pr-3 py-1.5 rounded-full text-sm font-medium text-foreground bg-rb-100 dark:bg-rb-800 hover:bg-rb-200 dark:hover:bg-rb-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
    >
      <ChevronLeft className="w-4 h-4" />
      Back
    </button>
  );
}

export default function TrovePage() {
  const params = useParams();
  const router = useRouter();
  const troveId = params.troveId as string;
  const collateralType = params.collateralType as string;
  const troveKey = `${collateralType}:${troveId}`;

  const [troveData, setTroveData] = useState<TroveSummary | null>(null);
  const [events, setEvents] = useState<BaseActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    hideDelegateRates,
    hideRedemptions,
    summaryExplanationOpen,
    economicsOpen,
    setHideDelegateRates,
    setHideRedemptions,
    setSummaryExplanationOpen,
    setEconomicsOpen,
  } = useTroveUiState(troveKey);

  // Live blockchain data and prices
  const [liveState, setLiveState] = useState<TroveStateData | undefined>(undefined);
  const [prices, setPrices] = useState<OraclePricesData | undefined>(undefined);

  // Debt in front calculation
  const debtInFrontRate = liveState?.rates.annualInterestRate ?? troveData?.metrics.interestRate;
  const { debtInFront, trovesAhead, loading: debtInFrontLoading } = useDebtInFront(
    troveData?.status === "open" ? collateralType : undefined,
    troveData?.status === "open" ? debtInFrontRate : undefined,
    troveData?.status === "open" ? troveId : undefined,
  );
  const [enhancementLoading, setEnhancementLoading] = useState({
    blockchain: false,
    prices: false,
  });

  useEffect(() => {
    loadData();
  }, [troveId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [troveResponse, timelineResult] = await Promise.all([
        fetch(`/api/troves?troveId=${troveId}&collateralType=${collateralType}`),
        fetchTroveTimeline({ collateralType, troveId, limit: 500 }).catch(err => {
          console.error("Failed to fetch trove timeline:", err);
          return null;
        }),
      ]);

      if (!troveResponse.ok) {
        throw new Error(`Failed to fetch trove: ${troveResponse.statusText}`);
      }

      const troveDataResp: TrovesResponse = await troveResponse.json();

      if (!troveDataResp.data || troveDataResp.data.length === 0) {
        setError("Trove not found");
        setLoading(false);
        return;
      }

      setTroveData(troveDataResp.data[0]);
      setEvents(timelineResult?.events ?? []);

      setLoading(false);
      loadEnhancements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trove data");
      console.error("Error loading trove data:", err);
      setLoading(false);
    }
  };

  const loadEnhancements = async () => {
    setEnhancementLoading({ blockchain: true, prices: true });

    const results = await Promise.allSettled([
      fetch(`/api/trove/state/${collateralType}/${troveId}`),
      fetch(`/api/oracle/liquity-v2`),
    ]);

    if (results[0].status === "fulfilled" && results[0].value.ok) {
      try {
        const stateResponse: TroveStateResponse = await results[0].value.json();
        if (stateResponse.success && stateResponse.data) {
          setLiveState(stateResponse.data);
        }
      } catch (err) {
        console.error("Error parsing blockchain state:", err);
      }
    } else {
      console.error("Failed to fetch blockchain state");
    }
    setEnhancementLoading((prev) => ({ ...prev, blockchain: false }));

    if (results[1].status === "fulfilled" && results[1].value.ok) {
      try {
        const pricesResponse: OraclePricesResponse = await results[1].value.json();
        if (pricesResponse.success && pricesResponse.data) {
          setPrices(pricesResponse.data);
        }
      } catch (err) {
        console.error("Error parsing oracle prices:", err);
      }
    } else {
      console.error("Failed to fetch oracle prices");
    }
    setEnhancementLoading((prev) => ({ ...prev, prices: false }));
  };

  const getEnhancementStatus = (): string | null => {
    const { blockchain, prices } = enhancementLoading;
    if (!blockchain && !prices) return null;
    if (blockchain) return "Loading current state...";
    if (prices) return "Fetching current asset price...";
    return null;
  };

  // Events sorted oldest → newest, with Liquity events at the front so the
  // bars provider's lifetime-peak walk is deterministic.
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.blockNumber - b.blockNumber || a.timestamp - b.timestamp),
    [events],
  );

  const visibleEvents = useMemo(
    () =>
      sortedEvents.filter((e) => {
        if (hideRedemptions && isRedemptionEvent(e)) return false;
        if (hideDelegateRates && isBatchManagerEvent(e)) return false;
        return true;
      }),
    [sortedEvents, hideRedemptions, hideDelegateRates],
  );

  const redemptionCount = sortedEvents.filter(isRedemptionEvent).length;
  const batchManagerCount = sortedEvents.filter(isBatchManagerEvent).length;
  const lastEventTs = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].timestamp : null;

  if (loading) {
    return (
      <>
        <FeedbackButton />
        <div className="space-y-6 py-8">
          <h1 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <TokenIcon assetSymbol={collateralType} className="w-7 h-7 z-1" />
            <TokenIcon assetSymbol="BOLD" className="w-7 h-7 -ml-3" />
            Liquity V2 Trove
          </h1>
          <BackButton onClick={() => router.back()} />
          <div className="bg-rb-100 dark:bg-rb-800 rounded-lg h-48 animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 bg-rb-100 dark:bg-rb-800 rounded w-1/4 animate-pulse" />
            <div className="h-32 bg-rb-100 dark:bg-rb-800 rounded animate-pulse" />
          </div>
        </div>
      </>
    );
  }

  if (error || !troveData) {
    return (
      <>
        <FeedbackButton />
        <div className="space-y-6 py-8">
          <BackButton onClick={() => router.back()} />
          <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error || "Trove not found"}</p>
            <button
              onClick={loadData}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <FeedbackButton />
      <div className="space-y-6 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
          <TokenIcon assetSymbol={collateralType} className="w-7 h-7 z-1" />
          <TokenIcon assetSymbol="BOLD" className="w-7 h-7 -ml-3" />
          Liquity V2 Trove
        </h1>
        <BackButton onClick={() => router.back()} />

        <TroveSummaryCard
          trove={troveData}
          liveState={liveState}
          prices={prices}
          debtInFront={debtInFront}
          trovesAhead={trovesAhead}
          debtInFrontLoading={debtInFrontLoading}
          summaryExplanationOpen={summaryExplanationOpen}
          onToggleSummaryExplanation={setSummaryExplanationOpen}
          loadingStatus={{
            message: getEnhancementStatus(),
            snapshotDate: lastEventTs ?? undefined,
          }}
        />

        <TroveEconomicsSummary
          trove={troveData}
          transactions={undefined}
          currentPrice={prices?.[troveData.collateralType.toLowerCase() as keyof OraclePricesData]}
          entireDebt={liveState?.debt.entire}
          persistedOpen={economicsOpen}
          onToggle={setEconomicsOpen}
        />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-semibold text-foreground">Timeline</h3>
            {troveData.activity?.lastActivityAt && (
              <span className="text-xs text-rb-500 flex items-center gap-1 rounded-full pl-1 pr-2 py-0.5 bg-rb-100 dark:bg-rb-900">
                <Icon name="clock-zap" size={14} />
                {formatDuration(troveData.activity.lastActivityAt, new Date())} ago
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {batchManagerCount > 0 && (
              <button
                onClick={() => setHideDelegateRates(!hideDelegateRates)}
                aria-label={hideDelegateRates ? "Show delegate rate updates" : "Hide delegate rate updates"}
                className="cursor-pointer pl-0.5 pr-1.5 text-sm rounded-full transition-colors flex items-center bg-pink-500/15 text-pink-600 dark:text-pink-400 hover:bg-pink-500/25"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name={hideDelegateRates ? "x" : "check"} size={12} className="text-pink-600 dark:text-pink-400" />
                </span>
                <span className="flex items-center text-xs font-medium gap-1">
                  <Users size={12} className="text-pink-500" />
                  {batchManagerCount}
                </span>
              </button>
            )}
            {redemptionCount > 0 && (
              <button
                onClick={() => setHideRedemptions(!hideRedemptions)}
                aria-label={hideRedemptions ? "Show redemption transactions" : "Hide redemption transactions"}
                className="cursor-pointer pl-0.5 pr-1.5 text-sm rounded-full transition-colors flex items-center bg-orange-500/15 text-orange-600 dark:text-orange-400 hover:bg-orange-500/25"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name={hideRedemptions ? "x" : "check"} size={12} className="text-orange-600 dark:text-orange-400" />
                </span>
                <span className="flex items-center text-xs font-medium gap-1">
                  <Icon name="triangle" size={12} className="text-orange-500" />
                  {redemptionCount}
                </span>
              </button>
            )}
          </div>
        </div>

        {visibleEvents.length > 0 ? (
          <TimelineDisplayProvider>
            <LiquityTroveBarsProvider events={sortedEvents}>
              <div className="space-y-2">
                {visibleEvents.map((event, idx) => {
                  if (!isLiquityEvent(event)) return null;
                  const previousEvent = idx > 0 ? visibleEvents[idx - 1] : undefined;
                  return (
                    <LiquityEventCard
                      key={event.id}
                      event={event}
                      addressDisplay="hidden"
                      isFirst={idx === 0}
                      isLast={idx === visibleEvents.length - 1}
                      previousEvent={previousEvent}
                    />
                  );
                })}
              </div>
            </LiquityTroveBarsProvider>
          </TimelineDisplayProvider>
        ) : (
          <div className="text-center py-8 text-rb-500">No transaction history available</div>
        )}
      </div>
    </>
  );
}
