"use client";

// LlamaLend wallet detail.
//
// Parallel fetches: /api/llamalend/positions for currently-open
// (controller, positionEpoch) lifecycles (rendered as position cards at the
// top — including the bands-vs-oracle axis when LLAMMA constants resolved),
// and /api/llamalend/timeline for the full event history. PricesProvider
// wraps both so the position-card health column + bands axis can resolve
// oracle prices via /api/prices.
//
// Timeline chrome matches /aave-v4/[wallet]: type filter, date filter (with
// transaction heatmap), display toggle, sort flip, day grouping.
// useLlamalendUiState persists those preferences per wallet.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { fetchLlamalendTimeline, fetchLlamalendPositions } from "@/lib/api/fetch-llamalend";
import type { LlamalendPosition } from "@/lib/api/fetch-llamalend";
import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isLlamalendEvent } from "@/lib/shared/types/event-shape";
import { LlamalendEventCard } from "@/components/protocol/llamalend/llamalend-event-card";
import { LlamalendPositionCardSelector } from "@/components/shared/llamalend-position-card-selector";
import { LlamalendTowerChart } from "@/components/protocol/llamalend/llamalend-tower-chart";
import { buildLlamalendEconomics } from "@/lib/llamalend/economics";
import { PricesProvider } from "@/lib/shared/prices-context";
import {
  TimelineDisplayProvider,
  useTimelineDisplay,
} from "@/components/shared/timeline-display-context";
import { SingleWalletProvider } from "@/components/shared/activity-timeline";
import {
  FilterDropdown,
  DisplaySettingsIcon,
  type FilterOption,
} from "@/components/shared/filter-dropdown";
import { TransactionHeatmap } from "@/components/shared/transaction-heatmap";
import { EventDateContext } from "@/components/shared/event-time";
import {
  dayKey,
  shortDate,
  shortDateYear,
  shortAddr,
} from "@/lib/shared/format-event";
import {
  getEventActionKey,
  actionLabel,
  DEMOTED_ACTIONS,
} from "@/lib/shared/event-filter-helpers";
import { useLlamalendUiState } from "@/hooks/useLlamalendUiState";

const VALID_WALLET = /^0x[a-f0-9]{40}$/;

function LlamalendTimelineDisplayToggle() {
  const {
    showTimestamps,
    showTimelineValues,
    showEventNumbers,
    toggle,
  } = useTimelineDisplay();
  const options: FilterOption[] = [
    { key: "timestamps", label: "Timestamps" },
    { key: "timeline-values", label: "Timeline values" },
    { key: "event-numbers", label: "Event numbers" },
  ];
  const visible = new Set<string>();
  if (showTimestamps) visible.add("timestamps");
  if (showTimelineValues) visible.add("timeline-values");
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
        else if (key === "event-numbers") toggle("showEventNumbers");
      }}
    />
  );
}

export default function LlamalendWalletPage() {
  return (
    <PricesProvider>
      <SingleWalletProvider value={true}>
        <TimelineDisplayProvider>
          <LlamalendWalletPageInner />
        </TimelineDisplayProvider>
      </SingleWalletProvider>
    </PricesProvider>
  );
}

function LlamalendWalletPageInner() {
  const params = useParams<{ wallet: string }>();
  const wallet = (params?.wallet ?? "").toLowerCase();
  const isValidWallet = VALID_WALLET.test(wallet);

  const [events, setEvents] = useState<BaseActivityEvent[] | null>(null);
  const [positions, setPositions] = useState<LlamalendPosition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    hiddenActions,
    sortDirection,
    dateRange,
    heatmapOpen,
    selectedPosition,
    setSortDirection,
    setHiddenActions,
    toggleHiddenAction,
    setDateRange,
    setHeatmapOpen,
    setSelectedPosition,
  } = useLlamalendUiState(isValidWallet ? wallet : undefined);

  const hiddenSet = useMemo(() => new Set(hiddenActions), [hiddenActions]);

  useEffect(() => {
    if (!isValidWallet) {
      setError("Invalid wallet address");
      return;
    }
    let cancelled = false;
    setEvents(null);
    setPositions(null);
    setError(null);
    Promise.allSettled([
      fetchLlamalendTimeline({ wallet }),
      fetchLlamalendPositions({ wallet }),
    ]).then((results) => {
      if (cancelled) return;
      const [timelineR, positionsR] = results;
      if (timelineR.status === "fulfilled") {
        setEvents(timelineR.value.events);
      } else {
        const e = timelineR.reason;
        setError(e instanceof Error ? e.message : String(e));
      }
      if (positionsR.status === "fulfilled") {
        setPositions(positionsR.value.positions);
      } else {
        setPositions([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [wallet, isValidWallet]);

  // Always sort asc as the canonical order; display order is a render-time
  // reverse below. Matches the AaveV4 page convention.
  const sortedEvents = useMemo(
    () =>
      events
        ? [...events].sort((a, b) => a.blockNumber - b.blockNumber || a.timestamp - b.timestamp)
        : null,
    [events],
  );

  // When a position card is selected, scope the activity timeline to events on
  // that one (controller, positionEpoch) lifecycle. The MV already stamps every
  // event with its lifecycle's positionEpoch.
  const positionScopedEvents = useMemo(() => {
    if (!sortedEvents) return null;
    if (!selectedPosition) return sortedEvents;
    const [ctrl, epochRaw] = selectedPosition.split(":");
    const epoch = Number(epochRaw);
    if (!ctrl || !Number.isFinite(epoch)) return sortedEvents;
    return sortedEvents.filter((e) => {
      if (!isLlamalendEvent(e)) return false;
      return (
        e.context.data.controller?.toLowerCase() === ctrl.toLowerCase() &&
        (e.context.data.positionEpoch ?? 0) === epoch
      );
    });
  }, [sortedEvents, selectedPosition]);

  const eventOptions = useMemo<FilterOption[]>(() => {
    if (!positionScopedEvents) return [];
    const counts = new Map<string, number>();
    for (const e of positionScopedEvents) {
      const key = getEventActionKey(e);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const demoted = new Set(DEMOTED_ACTIONS["llamalend"] ?? []);
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
  }, [positionScopedEvents]);

  const visibleActionKeys = useMemo(
    () => new Set(eventOptions.map((o) => o.key).filter((k) => !hiddenSet.has(k))),
    [eventOptions, hiddenSet],
  );

  const visibleEvents = useMemo(
    () =>
      positionScopedEvents
        ? positionScopedEvents.filter((e) => !hiddenSet.has(getEventActionKey(e)))
        : null,
    [positionScopedEvents, hiddenSet],
  );

  const dateFilteredEvents = useMemo(() => {
    if (!visibleEvents) return null;
    if (!dateRange) return visibleEvents;
    const [start, end] = dateRange;
    return visibleEvents.filter((e) => e.timestamp >= start && e.timestamp <= end);
  }, [visibleEvents, dateRange]);

  const displayedEvents = useMemo(
    () =>
      dateFilteredEvents
        ? sortDirection === "desc"
          ? [...dateFilteredEvents].reverse()
          : dateFilteredEvents
        : null,
    [dateFilteredEvents, sortDirection],
  );

  // Economics tower is computed over position-scoped events when a position
  // is selected, otherwise over every event for the wallet. Always uses
  // asc-sorted events so the inflow/outflow accumulation order is stable.
  const economics = useMemo(
    () => (positionScopedEvents ? buildLlamalendEconomics(positionScopedEvents) : null),
    [positionScopedEvents],
  );

  const filtersActive = hiddenSet.size > 0 || dateRange !== null;
  const dateLabel = dateRange
    ? `${new Date(dateRange[0] * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(dateRange[1] * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "Date";
  const heatmapShown = heatmapOpen || dateRange !== null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-foreground">
      <header className="mb-6">
        <Link href="/" className="text-xs text-rb-text-500 hover:text-foreground">
          ← Home
        </Link>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold">Curve LlamaLend</h1>
          <span className="text-rb-500">·</span>
          <span className="font-mono text-sm text-rb-500">{shortAddr(wallet)}</span>
        </div>
      </header>

      {positions && positions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-rb-500">
            Open positions
          </h2>
          <div className="rounded-lg bg-rb-200/50 dark:bg-rb-900">
            <LlamalendPositionCardSelector
              positions={positions}
              selected={selectedPosition ?? undefined}
              onSelect={(key) =>
                setSelectedPosition(key === selectedPosition ? null : key)
              }
            />
          </div>
          {selectedPosition && (
            <button
              type="button"
              onClick={() => setSelectedPosition(null)}
              className="mt-2 text-xs text-rb-500 underline hover:text-foreground"
            >
              Show activity for all positions
            </button>
          )}
        </section>
      )}

      {economics && (economics.collateral.length > 0 || economics.debt.length > 0) && (
        <section className="mb-8 rounded-lg bg-rb-200/50 dark:bg-rb-900 px-4 py-4">
          <LlamalendTowerChart economics={economics} />
        </section>
      )}

      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-rb-500 tabular-nums">
            {displayedEvents === null
              ? "Loading…"
              : filtersActive
                ? `${dateFilteredEvents?.length ?? 0} of ${positionScopedEvents?.length ?? 0}`
                : `${positionScopedEvents?.length ?? 0}`}{" "}
            event{(positionScopedEvents?.length ?? 0) === 1 ? "" : "s"}
          </span>
          <button
            onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
            aria-label={sortDirection === "asc" ? "Currently oldest first" : "Currently newest first"}
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
          <LlamalendTimelineDisplayToggle />
        </div>
      </div>

      {(heatmapOpen || dateRange !== null) && visibleEvents && visibleEvents.length > 0 && (
        <div className="mb-3">
          <TransactionHeatmap events={visibleEvents} value={dateRange} onChange={setDateRange} />
        </div>
      )}

      {error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Failed to load: {error}
        </div>
      ) : displayedEvents === null ? (
        <div className="text-sm text-rb-text-500">Fetching timeline…</div>
      ) : displayedEvents.length === 0 ? (
        <div className="rounded border border-rb-text-100/10 bg-rb-bg-100/40 p-6 text-sm text-rb-text-500">
          {filtersActive
            ? "All events filtered out — adjust the type or date filter to show some."
            : selectedPosition
              ? "No events on this position — pick a different one or clear the selection."
              : "No LlamaLend activity for this wallet."}
        </div>
      ) : (
        <ol className="space-y-2">
          {displayedEvents.map((event, idx) => {
            if (!isLlamalendEvent(event)) return null;
            const prevDisplayed = idx > 0 ? displayedEvents[idx - 1] : undefined;
            const showDate =
              !prevDisplayed || dayKey(event.timestamp) !== dayKey(prevDisplayed.timestamp);
            const datePrefix = showDate
              ? `${shortDate(event.timestamp)} ${shortDateYear(event.timestamp)}`
              : null;
            return (
              <li key={event.id}>
                <EventDateContext.Provider value={datePrefix}>
                  <LlamalendEventCard
                    event={event}
                    isFirst={idx === 0}
                    isLast={idx === displayedEvents.length - 1}
                  />
                </EventDateContext.Provider>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
