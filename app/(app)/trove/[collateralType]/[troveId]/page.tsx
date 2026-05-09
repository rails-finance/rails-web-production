"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ArrowUpDown } from "lucide-react";
import { TroveSummary, TrovesResponse } from "@/types/api/trove";
import { TroveSummaryCardSelector } from "@/components/trove/TroveSummaryCardSelector";
import { TroveDetailsBand } from "@/components/trove/TroveDetailsBand";
import { TroveContextRow } from "@/components/trove/TroveContextRow";
import { useTroveExplanationItems } from "@/components/trove/use-trove-explanation-items";
import { HoverProvider } from "@/components/transaction-timeline/context/HoverContext";
import { TroveEconomicsSummary } from "@/components/protocol/liquity/trove-economics";
import { formatDate, formatDuration } from "@/lib/date";
import { Icon } from "@/components/icons/icon";
import { FeedbackButton } from "@/components/FeedbackButton";
import { TroveStateData, TroveStateResponse } from "@/types/api/troveState";
import { OraclePricesData, OraclePricesResponse } from "@/types/api/oracle";
import { useTroveUiState } from "@/hooks/useTroveUiState";
import { useDebtInFront } from "@/hooks/useDebtInFront";
import { useWalletContext } from "@/components/nav/wallet-context";
import { upsertSession } from "@/lib/shared/sessions";

import { fetchTroveTimeline } from "@/lib/api/fetch-timeline";
import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isLiquityEvent } from "@/lib/shared/types/event-shape";
import { LiquityEventCard } from "@/components/protocol/liquity/liquity-event-card";
import { EventDateContext } from "@/components/shared/event-time";
import { dayKey, shortDate, shortDateYear } from "@/lib/shared/format-event";
import { TimelineDisplayProvider, useTimelineDisplay } from "@/components/shared/timeline-display-context";
import { LiquityTroveBarsProvider } from "@/lib/liquity/use-trove-bars";
import { FilterDropdown, DisplaySettingsIcon, type FilterOption } from "@/components/shared/filter-dropdown";
import { getEventActionKey, actionLabel, DEMOTED_ACTIONS } from "@/lib/shared/event-filter-helpers";

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

/** DISPLAY toggle dropdown — Liquity-only subset of rails-explorer's
 * TimelineDisplayToggle. USD Values + Ticker Labels are omitted because they
 * have no Liquity render path yet (USD-at-time would need upstream price
 * enrichment in the /timeline transformer). */
function TimelineDisplayToggle() {
  const {
    showTimestamps,
    showTimelineValues,
    showChangeBars,
    showBalanceBars,
    showEventNumbers,
    toggle,
  } = useTimelineDisplay();
  const options: FilterOption[] = [
    { key: "timestamps", label: "Timestamps" },
    { key: "timeline-values", label: "Timeline values" },
    { key: "change-bars", label: "Change bars" },
    { key: "balance-bars", label: "Balance bars" },
    { key: "event-numbers", label: "Event numbers" },
  ];
  const visible = new Set<string>();
  if (showTimestamps) visible.add("timestamps");
  if (showTimelineValues) visible.add("timeline-values");
  if (showChangeBars) visible.add("change-bars");
  if (showBalanceBars) visible.add("balance-bars");
  if (showEventNumbers) visible.add("event-numbers");
  return (
    <FilterDropdown
      label="Display"
      options={options}
      selected={visible}
      onSelect={() => {}}
      multi
      minimal
      align="right"
      variant="button"
      triggerIcon={<DisplaySettingsIcon size={16} />}
      onToggle={(key) => {
        if (key === "timestamps") toggle("showTimestamps");
        else if (key === "timeline-values") toggle("showTimelineValues");
        else if (key === "change-bars") toggle("showChangeBars");
        else if (key === "balance-bars") toggle("showBalanceBars");
        else if (key === "event-numbers") toggle("showEventNumbers");
      }}
    />
  );
}

/**
 * Composes the four tiers under one HoverProvider so HighlightableValues in
 * the expanded explanation can highlight their counterparts in the cards
 * above. The hook itself is hover-context-agnostic — it just builds JSX
 * which subscribes when rendered. */
function TroveSummaryStack({
  trove,
  ownerTroves,
  liveState,
  prices,
  debtInFront,
  trovesAhead,
  debtInFrontLoading,
  summaryExplanationOpen,
  onToggleSummaryExplanation,
  loadingStatus,
}: {
  trove: TroveSummary;
  ownerTroves?: TroveSummary[];
  liveState?: TroveStateData;
  prices?: OraclePricesData;
  debtInFront: number | null;
  trovesAhead: number | null;
  debtInFrontLoading: boolean;
  summaryExplanationOpen: boolean;
  onToggleSummaryExplanation: (isOpen: boolean) => void;
  loadingStatus: { message: string | null; snapshotDate?: number };
}) {
  const items = useTroveExplanationItems({ trove, liveState, prices, debtInFront, trovesAhead });
  return (
    <div className="space-y-6">
      <TroveSummaryCardSelector
        trove={trove}
        ownerTroves={ownerTroves}
        liveState={liveState}
        prices={prices}
        loadingStatus={loadingStatus}
      />
      {/* Match the active card's inner grid bounds: pl-5 mirrors the active
          card's left padding; pr-12 = active card's right padding (px-5,
          20px) + gap-2 (8px) + chevron column (20px) = 48px. Without this
          the supplementary stats below extend past the position card grid
          on the right and shift left by 20px on the left. */}
      <div className="pl-5 pr-12">
        <TroveDetailsBand
          trove={trove}
          liveState={liveState}
          prices={prices}
          debtInFront={debtInFront}
          trovesAhead={trovesAhead}
          debtInFrontLoading={debtInFrontLoading}
        />
      </div>
      <div className="pl-5 pr-12">
        <TroveContextRow
          items={items}
          isOpen={summaryExplanationOpen}
          onToggle={onToggleSummaryExplanation}
        />
      </div>
    </div>
  );
}

export default function TrovePage() {
  const params = useParams();
  const router = useRouter();
  const troveId = params.troveId as string;
  const collateralType = params.collateralType as string;
  const troveKey = `${collateralType}:${troveId}`;

  const [troveData, setTroveData] = useState<TroveSummary | null>(null);
  const [ownerTroves, setOwnerTroves] = useState<TroveSummary[] | undefined>(undefined);
  const [events, setEvents] = useState<BaseActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    hiddenActions,
    summaryExplanationOpen,
    sortDirection,
    setHiddenActions,
    toggleHiddenAction,
    setSummaryExplanationOpen,
    setSortDirection,
  } = useTroveUiState(troveKey);
  const hiddenSet = useMemo(() => new Set(hiddenActions), [hiddenActions]);

  // Live blockchain data and prices
  const [liveState, setLiveState] = useState<TroveStateData | undefined>(undefined);
  const [prices, setPrices] = useState<OraclePricesData | undefined>(undefined);

  // Closed / liquidated troves have ownership transferred to the zero address,
  // so `owner` reads as the burn address. Real wallet lives in `lastOwner`.
  // Plain `owner ?? lastOwner` doesn't help because `0x0000...` is truthy —
  // we need to actively reject the burn address before falling through.
  const effectiveOwner = (() => {
    const o = troveData?.owner?.toLowerCase();
    if (o && o !== "0x0000000000000000000000000000000000000000") return troveData?.owner;
    return troveData?.lastOwner;
  })();

  // Surface the trove owner in the header wallet pill — the WalletContext
  // hydrator only reads /address/* paths, so trove pages need to push the
  // owner explicitly. Mirrors rails-explorer's "Liquity V2 + <owner>" header.
  const { setWallets } = useWalletContext();
  useEffect(() => {
    if (!effectiveOwner) return;
    const lower = effectiveOwner.toLowerCase();
    const ens = troveData?.ownerEns ?? null;
    setWallets([lower], { [lower]: ens });
    // Record the wallet in the recent/pinned list so it surfaces in the
    // header WalletMenu on subsequent visits. Tagged with the canonical
    // protocol id used across rails-explorer.
    upsertSession([lower], { [lower]: ens }, ["liquity-v2-troves"]);
  }, [effectiveOwner, troveData?.ownerEns, setWallets]);

  // Fetch sibling troves the same wallet holds across all collateral branches,
  // so the summary card can act as a position selector. Lazy after the primary
  // load — keeps the page TTI snappy and the chooser populates while the user
  // reads the active trove. `ownerAddress` filter is honored by /api/troves.
  useEffect(() => {
    if (!effectiveOwner) return;
    let cancelled = false;
    fetch(`/api/troves?ownerAddress=${effectiveOwner}`)
      .then(r => r.ok ? r.json() as Promise<TrovesResponse> : null)
      .then(resp => {
        if (cancelled || !resp?.data) return;
        setOwnerTroves(resp.data);
      })
      .catch(() => { /* silent — selector just stays in single-card mode */ });
    return () => { cancelled = true; };
  }, [effectiveOwner]);

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

  // Events sorted oldest → newest. Tertiary sort on log_index (parsed from
  // the event id, which is always `${txHash}_${logIndex}`) is essential when
  // a single tx emits multiple TroveUpdated logs at the same block/timestamp:
  // without it the within-tx order is whatever the API returned (DESC), and
  // the bars provider's running-state walk would process the later log first
  // and compute the earlier event's delta as the wrong sign. Display order
  // (asc/desc) is a render-time reverse below — the bars provider always
  // sees asc.
  const sortedEvents = useMemo(
    () => {
      const logIndex = (e: BaseActivityEvent) => {
        const tail = e.id.split("_").pop();
        const n = Number(tail);
        return Number.isFinite(n) ? n : 0;
      };
      return [...events].sort(
        (a, b) =>
          a.blockNumber - b.blockNumber ||
          a.timestamp - b.timestamp ||
          logIndex(a) - logIndex(b),
      );
    },
    [events],
  );

  const visibleEvents = useMemo(
    () => sortedEvents.filter((e) => !hiddenSet.has(getEventActionKey(e))),
    [sortedEvents, hiddenSet],
  );

  const displayedEvents = useMemo(
    () => (sortDirection === "desc" ? [...visibleEvents].reverse() : visibleEvents),
    [visibleEvents, sortDirection],
  );

  // Action-type buckets for the FilterDropdown. Demoted (noisy) actions are
  // sorted to the bottom so the more meaningful ones are always at the top of
  // the menu.
  const eventOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const e of sortedEvents) {
      const key = getEventActionKey(e);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const demoted = new Set(DEMOTED_ACTIONS["liquity-v2-troves"] ?? []);
    return [...counts.entries()]
      .sort((a, b) => {
        const aD = demoted.has(a[0]) ? 1 : 0;
        const bD = demoted.has(b[0]) ? 1 : 0;
        if (aD !== bD) return aD - bD;
        return b[1] - a[1];
      })
      .map(([key, count]) => ({
        key,
        label: actionLabel(key),
        count,
        demoted: demoted.has(key),
      }));
  }, [sortedEvents]);

  const visibleActionKeys = useMemo(
    () => new Set(eventOptions.map((o) => o.key).filter((k) => !hiddenSet.has(k))),
    [eventOptions, hiddenSet],
  );

  const lastEventTs = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].timestamp : null;

  if (loading) {
    return (
      <>
        <FeedbackButton />
        <div className="space-y-6 py-8">
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
        <BackButton onClick={() => router.back()} />

        {/* Single HoverProvider wraps the whole summary stack so
            HighlightableValues in the expanded explanation can highlight
            their counterparts up in the summary card and details band. */}
        <HoverProvider>
          <TroveSummaryStack
            trove={troveData}
            ownerTroves={ownerTroves}
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
        </HoverProvider>

        {/* Full-bleed economics band — escapes the max-w-7xl gutter so the
            background extends edge-to-edge (matches rails-explorer). The
            inner content stays centered in the same content container. */}
        <div className="relative left-1/2 -translate-x-1/2 w-screen bg-rb-100 dark:bg-rb-900 py-6">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <TroveEconomicsSummary
              events={sortedEvents}
              currentPrice={prices?.[troveData.collateralType.toLowerCase() as keyof OraclePricesData]}
              hideHeader
            />
          </div>
        </div>

        <TimelineDisplayProvider>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm">
              {troveData.activity?.createdAt && (
                <>
                  <span className="text-foreground">
                    Opened {formatDate(troveData.activity.createdAt)}
                  </span>
                  <span className="text-rb-500 rounded-md bg-rb-100 dark:bg-rb-900 px-1.5 py-0.5">
                    {formatDuration(
                      troveData.activity.createdAt,
                      troveData.status === "open"
                        ? new Date()
                        : troveData.activity.lastActivityAt ?? new Date(),
                    )}
                  </span>
                </>
              )}
              {troveData.activity?.lastActivityAt && (
                <span className="text-xs text-rb-500 flex items-center gap-1 rounded-full pl-1 pr-2 py-0.5 bg-rb-100 dark:bg-rb-900">
                  <Icon name="clock-zap" size={14} />
                  {formatDuration(troveData.activity.lastActivityAt, new Date())} ago
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                aria-label={sortDirection === "asc" ? "Currently oldest first — click to flip to newest first" : "Currently newest first — click to flip to oldest first"}
                title={sortDirection === "asc" ? "Oldest first" : "Newest first"}
                className="cursor-pointer inline-flex items-center justify-center w-7 h-7 rounded-full text-rb-500 hover:text-foreground bg-rb-100 dark:bg-rb-900 hover:bg-rb-200 dark:hover:bg-rb-800 transition-colors"
              >
                <ArrowUpDown size={12} />
              </button>
              <span className="text-xs text-rb-500 tabular-nums">
                {hiddenSet.size > 0 ? `${visibleEvents.length} of ${sortedEvents.length}` : `${sortedEvents.length}`} event{sortedEvents.length === 1 ? "" : "s"}
              </span>
              {eventOptions.length > 1 && (
                <FilterDropdown
                  label="Types of event"
                  options={eventOptions}
                  selected={visibleActionKeys}
                  onSelect={() => setHiddenActions([])}
                  multi
                  variant="button"
                  align="right"
                  onToggle={(act) => toggleHiddenAction(act)}
                />
              )}
              <TimelineDisplayToggle />
            </div>
          </div>

          {displayedEvents.length > 0 ? (
            <LiquityTroveBarsProvider events={sortedEvents}>
              <div className="space-y-2">
                {displayedEvents.map((event, idx) => {
                  if (!isLiquityEvent(event)) return null;
                  // previousEvent is always the temporally-older event,
                  // regardless of display order, so explainer deltas
                  // (interest accrued, time-since-last) stay correct.
                  // tempIdx + 1 is the chronological event number (#1 =
                  // openTrove), stable across asc/desc display flips.
                  const tempIdx = sortedEvents.indexOf(event);
                  const previousEvent = tempIdx > 0 ? sortedEvents[tempIdx - 1] : undefined;
                  // Day-grouping: show the date alongside the time only on the
                  // first event of each calendar day in *display* order. Works
                  // for both asc and desc — we compare against the previous
                  // displayed event, not the chronologically-prior one.
                  const prevDisplayed = idx > 0 ? displayedEvents[idx - 1] : undefined;
                  const showDate =
                    !prevDisplayed || dayKey(event.timestamp) !== dayKey(prevDisplayed.timestamp);
                  const datePrefix = showDate
                    ? `${shortDate(event.timestamp)} ${shortDateYear(event.timestamp)}`
                    : null;
                  return (
                    <EventDateContext.Provider key={event.id} value={datePrefix}>
                      <LiquityEventCard
                        event={event}
                        addressDisplay="hidden"
                        isFirst={idx === 0}
                        isLast={idx === displayedEvents.length - 1}
                        previousEvent={previousEvent}
                        eventNumber={tempIdx + 1}
                      />
                    </EventDateContext.Provider>
                  );
                })}
              </div>
            </LiquityTroveBarsProvider>
          ) : (
            <div className="text-center py-8 text-rb-500">
              {hiddenSet.size > 0 && sortedEvents.length > 0
                ? "All events filtered out — adjust the type filter to show some."
                : "No transaction history available"}
            </div>
          )}
        </TimelineDisplayProvider>
      </div>
    </>
  );
}
