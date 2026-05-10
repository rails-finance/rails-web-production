"use client";

// Aave V4 wallet detail. Calls the two API endpoints (timeline + positions),
// renders a spoke-card selector (one card per active spoke, ACTIVE/CLOSED
// outcome pill, full HF / Liq Price / borrowing power tier) and a timeline
// of events scoped to the selected spoke, with type + date filters, day
// grouping, and a display toggle.
//
// Health factor, liq price, borrowing power, and net APY are computed
// client-side via lib/aave-v4/spoke-cards.ts → simulateAaveV4Position over a
// hard-coded LT table. No on-chain reads needed — deferred per v1's locked
// product decisions.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import {
  fetchAaveV4Timeline,
  fetchAaveV4Positions,
  type AaveV4Position,
} from "@/lib/api/fetch-aave-v4";
import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isAaveV4Event } from "@/lib/shared/types/event-shape";
import { AaveV4EventCard } from "@/components/protocol/aave-v4/aave-v4-event-card";
import { AaveV4SpokeCardSelector } from "@/components/protocol/aave-v4/aave-v4-spoke-card";
import { AaveV4SpokeRunwayStack } from "@/components/protocol/aave-v4/aave-v4-spoke-runway-stack";
import { buildAaveV4SpokeCards } from "@/lib/aave-v4/spoke-cards";
import {
  TimelineDisplayProvider,
  useTimelineDisplay,
} from "@/components/shared/timeline-display-context";
import {
  FilterDropdown,
  DisplaySettingsIcon,
  type FilterOption,
} from "@/components/shared/filter-dropdown";
import { TransactionHeatmap } from "@/components/shared/transaction-heatmap";
import { EventDateContext } from "@/components/shared/event-time";
import { dayKey, shortDate, shortDateYear } from "@/lib/shared/format-event";
import {
  getEventActionKey,
  actionLabel,
  DEMOTED_ACTIONS,
} from "@/lib/shared/event-filter-helpers";
import { FeedbackButton } from "@/components/FeedbackButton";
import { useWalletContext } from "@/components/nav/wallet-context";
import { upsertSession } from "@/lib/shared/sessions";
import { shortAddr } from "@/lib/shared/format-event";
import { useAaveV4UiState } from "@/hooks/useAaveV4UiState";
import { PricesProvider, usePrices, useRequestPrices } from "@/lib/shared/prices-context";
import { AaveV4BarsProvider } from "@/lib/aave-v4/use-position-bars";
import { TOKEN_ADDR } from "@/lib/aave/prices";

/** DISPLAY toggle dropdown — Aave V4 variant. Bars + USD values are wired to
 *  the price-aware infra (Phase 9): change bars and balance bars read off
 *  AaveV4BarsContext, USD values render inside the event detail. Timeline
 *  values + timestamps + event numbers stay protocol-agnostic. */
function AaveV4TimelineDisplayToggle() {
  const {
    showTimestamps,
    showTimelineValues,
    showEventNumbers,
    showChangeBars,
    showBalanceBars,
    showUsdValues,
    toggle,
  } = useTimelineDisplay();
  const options: FilterOption[] = [
    { key: "timestamps", label: "Timestamps" },
    { key: "timeline-values", label: "Timeline values" },
    { key: "change-bars", label: "Change bars" },
    { key: "balance-bars", label: "Balance bars" },
    { key: "usd-values", label: "USD values" },
    { key: "event-numbers", label: "Event numbers" },
  ];
  const visible = new Set<string>();
  if (showTimestamps) visible.add("timestamps");
  if (showTimelineValues) visible.add("timeline-values");
  if (showChangeBars) visible.add("change-bars");
  if (showBalanceBars) visible.add("balance-bars");
  if (showUsdValues) visible.add("usd-values");
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
        else if (key === "usd-values") toggle("showUsdValues");
        else if (key === "event-numbers") toggle("showEventNumbers");
      }}
    />
  );
}

export default function AaveV4WalletPage() {
  return (
    <PricesProvider>
      <AaveV4WalletPageInner />
    </PricesProvider>
  );
}

function AaveV4WalletPageInner() {
  const params = useParams();
  const wallet = String(params.wallet ?? "").toLowerCase();
  const isValidWallet = /^0x[a-f0-9]{40}$/.test(wallet);

  const [events, setEvents] = useState<BaseActivityEvent[]>([]);
  const [positions, setPositions] = useState<AaveV4Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    hiddenActions,
    sortDirection,
    dateRange,
    heatmapOpen,
    selectedSpoke,
    hasHydrated: hasUiHydrated,
    setSortDirection,
    setHiddenActions,
    toggleHiddenAction,
    setDateRange,
    setHeatmapOpen,
    setSelectedSpoke,
  } = useAaveV4UiState(isValidWallet ? wallet : undefined);

  const hiddenSet = useMemo(() => new Set(hiddenActions), [hiddenActions]);

  // Surface the wallet in the global header pill / WalletMenu sessions, same
  // as the trove detail page does. Tagged with the canonical aave-v4 protocol
  // id so the recent-wallets list groups under the right protocol icon.
  const { setWallets } = useWalletContext();
  useEffect(() => {
    if (!isValidWallet) return;
    setWallets([wallet], { [wallet]: null });
    upsertSession([wallet], { [wallet]: null }, ["aave-v4"]);
  }, [wallet, isValidWallet, setWallets]);

  useEffect(() => {
    if (!isValidWallet) {
      setError("Invalid wallet address");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [timeline, posResult] = await Promise.all([
          fetchAaveV4Timeline({ wallet }),
          fetchAaveV4Positions({ wallet }),
        ]);
        if (cancelled) return;
        setEvents(timeline.events);
        setPositions(posResult.positions);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load wallet data");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [wallet, isValidWallet]);

  // Always sort ASC for the running pass — bars / spoke-card math walk the asc
  // list to compute deltas. Display order (asc/desc) is a render-time reverse
  // below.
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.blockNumber - b.blockNumber || a.timestamp - b.timestamp),
    [events],
  );

  // Spoke cards (HF / Liq Price / borrowing power / net APY). Built from the
  // entire wallet event log so closed spokes are still listed in the chooser
  // — selecting one scopes the activity timeline below to that spoke.
  const prices = usePrices();
  const spokeCards = useMemo(
    () => buildAaveV4SpokeCards(sortedEvents, undefined, prices),
    [sortedEvents, prices],
  );

  // Auto-select the most-active open spoke once events arrive (or fall back to
  // the highest-event-count spoke if everything is closed). Won't fire if the
  // user has already chosen one (state hydrates first; spoke matches a real
  // spoke name in the cards).
  useEffect(() => {
    if (!hasUiHydrated) return;
    if (spokeCards.length === 0) return;
    if (selectedSpoke && spokeCards.some((c) => c.name === selectedSpoke)) return;
    const ranked = [...spokeCards].sort((a, b) => {
      if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
      return b.totalSupplyUsd - a.totalSupplyUsd || b.eventCount - a.eventCount;
    });
    setSelectedSpoke(ranked[0].name);
  }, [hasUiHydrated, spokeCards, selectedSpoke, setSelectedSpoke]);

  // Spoke-scoped events drive everything below the position card — type
  // counts, heatmap, timeline list. Picking a different spoke from the
  // selector reshapes all three at once, mirroring rails-explorer.
  const spokeScopedEvents = useMemo(() => {
    if (!selectedSpoke) return sortedEvents;
    return sortedEvents.filter((e) => {
      if (!isAaveV4Event(e)) return false;
      return (e.context.data.spokeName ?? "Main") === selectedSpoke;
    });
  }, [sortedEvents, selectedSpoke]);

  // Action-type buckets for the FilterDropdown. Demoted (noisy) actions are
  // sorted to the bottom so the more meaningful ones are always at the top.
  const eventOptions = useMemo<FilterOption[]>(() => {
    const counts = new Map<string, number>();
    for (const e of spokeScopedEvents) {
      const key = getEventActionKey(e);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const demoted = new Set(DEMOTED_ACTIONS["aave-v4"] ?? []);
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
  }, [spokeScopedEvents]);

  const visibleActionKeys = useMemo(
    () => new Set(eventOptions.map((o) => o.key).filter((k) => !hiddenSet.has(k))),
    [eventOptions, hiddenSet],
  );

  const visibleEvents = useMemo(
    () => spokeScopedEvents.filter((e) => !hiddenSet.has(getEventActionKey(e))),
    [spokeScopedEvents, hiddenSet],
  );

  // Heatmap reflects the type-filtered set, so adjusting type filters reshapes
  // the heatmap; the date range narrows on top of that into the rendered list.
  const dateFilteredEvents = useMemo(() => {
    if (!dateRange) return visibleEvents;
    const [start, end] = dateRange;
    return visibleEvents.filter((e) => e.timestamp >= start && e.timestamp <= end);
  }, [visibleEvents, dateRange]);

  const displayedEvents = useMemo(
    () => sortDirection === "desc" ? [...dateFilteredEvents].reverse() : dateFilteredEvents,
    [dateFilteredEvents, sortDirection],
  );

  // Reserve addresses to enrol with PricesProvider. Pull from positions
  // (which carry reserveAddress) plus every symbol referenced anywhere on the
  // timeline (looked up via TOKEN_ADDR). The provider dedupes and only
  // refetches stale entries, so over-collecting here is cheap.
  const reserveAddresses = useMemo(() => {
    const out = new Set<string>();
    for (const p of positions) {
      if (p.reserveAddress) out.add(p.reserveAddress.toLowerCase());
      const fromSymbol = TOKEN_ADDR[p.reserveSymbol];
      if (fromSymbol) out.add(fromSymbol);
    }
    for (const e of sortedEvents) {
      if (!isAaveV4Event(e)) continue;
      const ctx = e.context.data;
      const symbols = [
        ctx.reserveSymbol,
        ctx.collateralSymbol,
        ...(ctx.allSupplies?.map((s) => s.symbol) ?? []),
        ...(ctx.allDebts?.map((d) => d.symbol) ?? []),
      ];
      for (const s of symbols) {
        if (!s) continue;
        const addr = TOKEN_ADDR[s];
        if (addr) out.add(addr);
      }
    }
    return [...out];
  }, [positions, sortedEvents]);

  useRequestPrices(reserveAddresses);

  if (loading) {
    return (
      <main className="min-h-screen">
        <FeedbackButton />
        <div className="max-w-7xl mx-auto py-8 space-y-6">
          <div className="h-32 bg-rb-100 dark:bg-rb-900 rounded-lg animate-pulse" />
          <div className="h-64 bg-rb-100 dark:bg-rb-900 rounded-lg animate-pulse" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen">
        <FeedbackButton />
        <div className="max-w-7xl mx-auto py-8">
          <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  const filtersActive = hiddenSet.size > 0 || dateRange !== null;
  const dateLabel = dateRange
    ? `${new Date(dateRange[0] * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(dateRange[1] * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "Date";
  const heatmapShown = heatmapOpen || dateRange !== null;

  return (
    <main className="min-h-screen">
      <FeedbackButton />
      <div className="max-w-7xl mx-auto py-8 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground">Aave V4</h1>
          <span className="text-rb-500">·</span>
          <span className="font-mono text-sm text-rb-500">{shortAddr(wallet)}</span>
        </div>

        <AaveV4SpokeCardSelector
          spokes={spokeCards}
          selected={selectedSpoke ?? undefined}
          onSelect={(name) => setSelectedSpoke(name)}
        />

        {(() => {
          const active = spokeCards.find((c) => c.name === selectedSpoke);
          return active ? <AaveV4SpokeRunwayStack spoke={active} /> : null;
        })()}

        <TimelineDisplayProvider>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-foreground">Activity</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-rb-500 tabular-nums">
                {filtersActive
                  ? `${dateFilteredEvents.length} of ${spokeScopedEvents.length}`
                  : `${spokeScopedEvents.length}`} event{spokeScopedEvents.length === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                aria-label={sortDirection === "asc" ? "Currently oldest first — click to flip to newest first" : "Currently newest first — click to flip to oldest first"}
                title={sortDirection === "asc" ? "Oldest first" : "Newest first"}
                className="cursor-pointer inline-flex items-center justify-center w-7 h-7 rounded-full text-rb-500 hover:text-foreground bg-rb-100 dark:bg-rb-900 hover:bg-rb-200 dark:hover:bg-rb-800 transition-colors"
              >
                <ArrowUpDown size={12} />
              </button>
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
              <button
                type="button"
                onClick={() => setHeatmapOpen(!heatmapOpen)}
                aria-pressed={heatmapShown}
                className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${
                  dateRange
                    ? "border-amber-500/60 bg-amber-500/15 text-amber-400 hover:text-amber-300"
                    : heatmapShown
                      ? "border-rb-400 dark:border-rb-600 bg-rb-200 dark:bg-rb-900 text-foreground"
                      : "border-rb-300/60 dark:border-rb-700/60 text-rb-500 hover:text-foreground hover:bg-rb-200/60 dark:hover:bg-rb-900/60"
                }`}
                title={heatmapShown ? "Hide activity heatmap" : "Filter by date range"}
              >
                {dateLabel}
              </button>
              <AaveV4TimelineDisplayToggle />
            </div>
          </div>

          {(heatmapOpen || dateRange !== null) && visibleEvents.length > 0 && (
            <div className="mb-3">
              <TransactionHeatmap
                events={visibleEvents}
                value={dateRange}
                onChange={setDateRange}
              />
            </div>
          )}

          {displayedEvents.length > 0 ? (
            <AaveV4BarsProvider events={spokeScopedEvents}>
            <div className="space-y-2">
              {displayedEvents.map((event, idx) => {
                if (!isAaveV4Event(event)) return null;
                // Day grouping in display order: only show the date prefix on
                // the first event of each calendar day. Works for both asc
                // and desc — compares against the previous DISPLAYED event.
                const prevDisplayed = idx > 0 ? displayedEvents[idx - 1] : undefined;
                const showDate =
                  !prevDisplayed || dayKey(event.timestamp) !== dayKey(prevDisplayed.timestamp);
                const datePrefix = showDate
                  ? `${shortDate(event.timestamp)} ${shortDateYear(event.timestamp)}`
                  : null;
                return (
                  <EventDateContext.Provider key={event.id} value={datePrefix}>
                    <AaveV4EventCard
                      event={event}
                      isFirst={idx === 0}
                      isLast={idx === displayedEvents.length - 1}
                    />
                  </EventDateContext.Provider>
                );
              })}
            </div>
            </AaveV4BarsProvider>
          ) : (
            <div className="text-center py-8 text-rb-500">
              {filtersActive && spokeScopedEvents.length > 0
                ? "All events filtered out — adjust the type or date filter to show some."
                : selectedSpoke && sortedEvents.length > 0
                  ? `No activity on the ${selectedSpoke} spoke — pick a different spoke from the card above.`
                  : "No Aave V4 activity for this wallet."}
            </div>
          )}
        </TimelineDisplayProvider>
      </div>
    </main>
  );
}
