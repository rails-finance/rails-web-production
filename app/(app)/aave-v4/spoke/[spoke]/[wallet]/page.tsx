"use client";

// Aave V4 spoke detail — the addressable per-spoke deep view for a wallet.
// The spoke is the unit of risk isolation (one shared health factor inside,
// fully independent between spokes), so it's the right URL-addressable unit
// for "this position." The wallet's other spokes live on the listing-filtered
// view at /aave-v4?wallet=… — that page is the spoke chooser.
//
// Ported almost verbatim from the now-removed /aave-v4/[wallet] page; the
// only structural change is that the spoke comes from the URL instead of
// `useAaveV4UiState`'s selectedSpoke. The SpokeCardSelector becomes a
// single-card breadcrumb and the auto-select effect is gone.
//
// Health factor, liq price, borrowing power, and net APY are computed
// client-side via lib/aave-v4/spoke-cards.ts → simulateAaveV4Position over a
// hard-coded LT table. No on-chain reads.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpDown, ArrowLeft } from "lucide-react";
import {
  fetchAaveV4Timeline,
  fetchAaveV4Positions,
  type AaveV4Position,
} from "@/lib/api/fetch-aave-v4";
import {
  fetchAaveV4SpokePosition,
  type AaveV4SpokePositionChainResponse,
} from "@/lib/api/fetch-aave-v4-spoke-position";
import {
  patchReservesWithChain,
  patchSpokeCardWithChain,
} from "@/lib/aave-v4/apply-chain-truth";

import { spokeFromSlug } from "@/lib/aave-v4/spoke-meta";

// Display-name → server spoke-key map. Mirrors SPOKE_BY_KEY in
// rails-server-mig/api/src/config/aave-v4-spokes.ts. Used to translate the
// resolved display name into the lowercase chain key the
// `/api/aave-v4/spoke-position` endpoint expects.
const SPOKE_NAME_TO_KEY: Record<string, string> = {
  "Main": "main",
  "Bluechip": "bluechip",
  "Forex": "forex",
  "Gold": "gold",
  "Ethena Correlated": "ethena_corr",
  "Ethena Ecosystem": "ethena_eco",
  "EtherFi": "etherfi",
  "Kelp": "kelp",
  "Lido": "lido",
  "Lombard BTC": "lombard",
  "Lombard": "lombard",
  "Treasury": "treasury",
};
import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isAaveV4Event } from "@/lib/shared/types/event-shape";
import { AaveV4EventCard } from "@/components/protocol/aave-v4/aave-v4-event-card";
import type { AaveV4TxGroup } from "@/components/protocol/aave-v4/aave-v4-event-header";
import { AaveV4SpokeCardSelector } from "@/components/protocol/aave-v4/aave-v4-spoke-card";
import { AaveV4SpokeRunwayStack } from "@/components/protocol/aave-v4/aave-v4-spoke-runway-stack";
import { AaveV4TowerChart } from "@/components/protocol/aave-v4/aave-v4-tower-chart";
import { buildAaveV4SpokeCards, groupBySpoke } from "@/lib/aave-v4/spoke-cards";
import { getLiquidationThreshold, isStable } from "@/lib/aave-v4/liquidation-thresholds";
import { simulateAaveV4Position, type SimPositionInputs } from "@/lib/aave-v4/utils/simulate";
import { resolvePrice, type PriceEntry } from "@/lib/aave/prices";
import type { ReserveStats } from "@/lib/aave-v4/spoke-cards";
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

export default function AaveV4SpokePage() {
  return (
    <PricesProvider>
      <AaveV4SpokePageInner />
    </PricesProvider>
  );
}

function AaveV4SpokePageInner() {
  const params = useParams();
  const wallet = String(params.wallet ?? "").toLowerCase();
  // The URL segment is a slug ("ethena-ecosystem"); resolve to the display
  // name the rest of the app uses. Fall back to URL-decoding the raw param so
  // legacy `Spoke%20Name`-shape bookmarks still resolve until the 308s catch
  // them.
  const rawSpoke = String(params.spoke ?? "");
  const spokeName = spokeFromSlug(rawSpoke) ?? decodeURIComponent(rawSpoke);
  const isValidWallet = /^0x[a-f0-9]{40}$/.test(wallet);
  const walletFilterHref = `/aave-v4?wallet=${wallet}`;

  const [events, setEvents] = useState<BaseActivityEvent[]>([]);
  const [positions, setPositions] = useState<AaveV4Position[]>([]);
  const [chainPosition, setChainPosition] = useState<AaveV4SpokePositionChainResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    hiddenActions,
    sortDirection,
    dateRange,
    heatmapOpen,
    hasHydrated: hasUiHydrated,
    setSortDirection,
    setHiddenActions,
    toggleHiddenAction,
    setDateRange,
    setHeatmapOpen,
  } = useAaveV4UiState(isValidWallet ? wallet : undefined);

  const hiddenSet = useMemo(() => new Set(hiddenActions), [hiddenActions]);

  const { setWallets } = useWalletContext();
  useEffect(() => {
    if (!isValidWallet) return;
    setWallets([wallet], { [wallet]: null });
    upsertSession([wallet], { [wallet]: null }, "aave-v4");
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
        const spokeKey = SPOKE_NAME_TO_KEY[spokeName];
        const [timeline, posResult, chainResult] = await Promise.all([
          fetchAaveV4Timeline({ wallet }),
          fetchAaveV4Positions({ wallet }),
          // Best-effort: when the URL spoke name doesn't map to a known
          // server key, skip the chain fetch and fall back to event-derived
          // numbers (the "no activity on this spoke" path below will catch it).
          spokeKey
            ? fetchAaveV4SpokePosition({ wallet, spoke: spokeKey }).catch((err) => {
                console.warn("Chain-truth fetch failed; falling back to indexed", err);
                return null;
              })
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setEvents(timeline.events);
        setPositions(posResult.positions);
        setChainPosition(chainResult);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load spoke data");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [wallet, isValidWallet, spokeName]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.blockNumber - b.blockNumber || a.timestamp - b.timestamp),
    [events],
  );

  const prices = usePrices();
  const spokeGroups = useMemo(
    () => groupBySpoke(sortedEvents, undefined, prices),
    [sortedEvents, prices],
  );
  const spokeCards = useMemo(
    () => buildAaveV4SpokeCards(sortedEvents, undefined, prices),
    [sortedEvents, prices],
  );
  // The one card we render (single-spoke breadcrumb). If the URL spoke doesn't
  // exist for this wallet we fall back to "no activity on this spoke" below.
  // When chain-truth data is available it overrides the event-derived headline
  // numbers (HF, total supply/debt USD, liq prices, per-asset balances).
  // History fields (peak debt, debt series, event count) stay event-derived.
  const eventActiveCard = useMemo(
    () => spokeCards.find((c) => c.name === spokeName),
    [spokeCards, spokeName],
  );
  const eventActiveGroup = useMemo(
    () => spokeGroups.find((g) => g.name === spokeName),
    [spokeGroups, spokeName],
  );
  const activeCard = useMemo(() => {
    if (!eventActiveCard) return undefined;
    if (!chainPosition || chainPosition.chainStale) return eventActiveCard;
    return patchSpokeCardWithChain(eventActiveCard, chainPosition, prices);
  }, [eventActiveCard, chainPosition, prices]);
  const activeGroup = useMemo(() => {
    if (!eventActiveGroup) return undefined;
    if (!chainPosition || chainPosition.chainStale) return eventActiveGroup;
    return {
      ...eventActiveGroup,
      result: {
        ...eventActiveGroup.result,
        reserves: patchReservesWithChain(eventActiveGroup.result.reserves, chainPosition),
      },
    };
  }, [eventActiveGroup, chainPosition]);

  const spokeScopedEvents = useMemo(() => {
    return sortedEvents.filter((e) => {
      if (!isAaveV4Event(e)) return false;
      return (e.context.data.spokeName ?? "Main") === spokeName;
    });
  }, [sortedEvents, spokeName]);

  // Stable chronological index (1-based) keyed by event id — survives
  // asc/desc display flips so "event 3" is always the same event.
  // Composite-tx grouping: when several spoke events share a txHash,
  // each gets { index, count } so the header can render "1 OF 2", "2 OF 2".
  // Both maps are built from spokeScopedEvents (chronological asc).
  const { eventNumbers, txGroups } = useMemo(() => {
    const eventNumbers = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const e of spokeScopedEvents) {
      const tx = e.txHash ?? "";
      if (tx) counts.set(tx, (counts.get(tx) ?? 0) + 1);
    }
    const txGroups = new Map<string, AaveV4TxGroup>();
    const seen = new Map<string, number>();
    spokeScopedEvents.forEach((e, idx) => {
      eventNumbers.set(e.id, idx + 1);
      const tx = e.txHash ?? "";
      const total = tx ? (counts.get(tx) ?? 1) : 1;
      if (total > 1) {
        const next = (seen.get(tx) ?? 0) + 1;
        seen.set(tx, next);
        txGroups.set(e.id, { index: next, count: total });
      }
    });
    return { eventNumbers, txGroups };
  }, [spokeScopedEvents]);

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

  const dateFilteredEvents = useMemo(() => {
    if (!dateRange) return visibleEvents;
    const [start, end] = dateRange;
    return visibleEvents.filter((e) => e.timestamp >= start && e.timestamp <= end);
  }, [visibleEvents, dateRange]);

  const displayedEvents = useMemo(
    () => sortDirection === "desc" ? [...dateFilteredEvents].reverse() : dateFilteredEvents,
    [dateFilteredEvents, sortDirection],
  );

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
    // Chain reserves win for the position card; make sure their prices are
    // requested even if the indexer hasn't seen the asset yet.
    if (chainPosition) {
      for (const r of chainPosition.reserves) {
        if (r.address) out.add(r.address.toLowerCase());
      }
    }
    return [...out];
  }, [positions, sortedEvents, chainPosition]);

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

  // If the URL points at a spoke that doesn't exist for this wallet (typo,
  // stale link), bail with a path back to the wallet's other spokes.
  if (!activeCard && !loading) {
    return (
      <main className="min-h-screen">
        <FeedbackButton />
        <div className="max-w-7xl mx-auto py-8 space-y-6">
          <SpokeBreadcrumb walletFilterHref={walletFilterHref} wallet={wallet} />
          <div className="text-center py-12">
            <p className="text-foreground text-lg mb-3">
              {shortAddr(wallet)} has no activity on the {spokeName} spoke
            </p>
            <p className="text-sm text-rb-500">
              <Link href={walletFilterHref} className="underline hover:text-foreground transition-colors">
                See this wallet&rsquo;s other spokes →
              </Link>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <FeedbackButton />
      <div className="max-w-7xl mx-auto py-8 space-y-6">
        <SpokeBreadcrumb walletFilterHref={walletFilterHref} wallet={wallet} />

        {/* Single spoke card — keeps visual parity with the multi-spoke
            selector on the listing page while making it clear this is the
            *one* spoke being viewed. */}
        {activeCard && (
          <AaveV4SpokeCardSelector
            spokes={[activeCard]}
            selected={spokeName}
            onSelect={() => {}}
            wallet={wallet}
          />
        )}

        {activeGroup && hasUiHydrated ? (
          <div className="relative left-1/2 -translate-x-1/2 w-screen bg-rb-100 dark:bg-rb-900 py-6">
            <div className="max-w-7xl mx-auto px-4 md:px-6">
              <AaveV4SpokeEconomicsBand
                activeName={activeGroup.name}
                reserves={activeGroup.result.reserves}
                prices={prices}
                runwayCard={activeCard}
              />
            </div>
          </div>
        ) : null}

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
                      txGroup={txGroups.get(event.id)}
                      eventNumber={eventNumbers.get(event.id)}
                    />
                  </EventDateContext.Provider>
                );
              })}
            </div>
            </AaveV4BarsProvider>
          ) : (
            <div className="text-center py-8 text-rb-500">
              {filtersActive
                ? "All events filtered out — adjust the type or date filter to show some."
                : `No activity on the ${spokeName} spoke for this wallet.`}
            </div>
          )}
        </TimelineDisplayProvider>
      </div>
    </main>
  );
}

function SpokeBreadcrumb({
  walletFilterHref,
  wallet,
}: {
  walletFilterHref: string;
  wallet: string;
}) {
  return (
    <Link
      href={walletFilterHref}
      className="inline-flex items-center gap-1.5 text-sm text-rb-500 hover:text-foreground transition-colors"
    >
      <ArrowLeft size={14} />
      <span className="font-mono">{shortAddr(wallet)}</span>
    </Link>
  );
}

// ── Spoke economics band ─────────────────────────────────────────────────────
function AaveV4SpokeEconomicsBand({
  activeName,
  reserves,
  prices,
  runwayCard,
}: {
  activeName: string;
  reserves: ReserveStats[];
  prices: Record<string, PriceEntry | number>;
  runwayCard: import("@/lib/aave-v4/spoke-cards").AaveSpokeCardInfo | undefined;
}) {
  const simBase: SimPositionInputs = useMemo(() => ({
    supplies: reserves
      .map((r) => {
        const netSupply = r.currentSupplied ?? Math.max(0, r.supplied - r.withdrawn - r.liquidatedCollateral);
        if (netSupply <= 0.0001) return null;
        const price = resolvePrice(r.symbol, prices) ?? 1;
        const lt = getLiquidationThreshold(activeName, r.symbol);
        const collateralEnabled = r.collateralEnabled ?? true;
        return { symbol: r.symbol, amount: netSupply, price, lt, collateralEnabled };
      })
      .filter(Boolean) as SimPositionInputs["supplies"],
    debts: reserves
      .map((r) => {
        const netDebt = r.currentBorrowed ?? Math.max(0, r.borrowed - r.repaid - r.liquidatedDebt);
        if (netDebt <= 0.0001) return null;
        const price = resolvePrice(r.symbol, prices) ?? 1;
        return { symbol: r.symbol, amount: netDebt, price };
      })
      .filter(Boolean) as SimPositionInputs["debts"],
  }), [reserves, prices, activeName]);

  const [surplusSymbols, hideSurplus, setHideSurplus] = useSurplusState(simBase);

  return (
    <div className="rounded-lg p-3 border border-transparent space-y-3">
      <AaveV4TowerChart
        reserves={reserves}
        prices={prices}
        surplusSymbols={surplusSymbols}
        hideSurplus={hideSurplus}
        onToggleHideSurplus={() => setHideSurplus((v) => !v)}
      />

      {runwayCard && <AaveV4SpokeRunwayStack spoke={runwayCard} />}
    </div>
  );
}

function useSurplusState(simBase: SimPositionInputs): [Set<string>, boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [hideSurplus, setHideSurplus] = useState(false);
  const surplusSymbols = useMemo(() => {
    const out = new Set<string>();
    if (simBase.supplies.length > 0 && simBase.debts.length > 0) {
      const axis = simulateAaveV4Position({ supplies: simBase.supplies, debts: simBase.debts });
      for (let i = 0; i < simBase.supplies.length; i++) {
        if (axis.assetLiqPrices[i]?.liqPrice === 0 && !isStable(simBase.supplies[i].symbol)) {
          out.add(simBase.supplies[i].symbol);
        }
      }
    }
    return out;
  }, [simBase]);
  return [surplusSymbols, hideSurplus, setHideSurplus];
}
