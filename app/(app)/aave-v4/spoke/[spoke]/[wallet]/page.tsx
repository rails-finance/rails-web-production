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
// Health factor, liq price, and borrowing power are computed client-side via
// lib/aave-v4/spoke-cards.ts → simulateAaveV4Position over a hard-coded LT
// table. Net interest carry comes from chain-truth balances vs. indexed
// deposits (computeAaveV4InterestPnl). No on-chain reads beyond chain-truth.

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowLeft } from "lucide-react";
import { fetchAaveV4Timeline, fetchAaveV4Positions, type AaveV4Position } from "@/lib/api/fetch-aave-v4";
import {
  fetchAaveV4SpokePosition,
  parseRiskPremiumFraction,
  type AaveV4SpokePositionChainResponse,
} from "@/lib/api/fetch-aave-v4-spoke-position";
import { patchReservesWithChain, patchSpokeCardWithChain } from "@/lib/aave-v4/apply-chain-truth";

import { spokeFromSlug } from "@/lib/aave-v4/spoke-meta";

// Display-name → server spoke-key map. Mirrors SPOKE_BY_KEY in
// rails-server-mig/api/src/config/aave-v4-spokes.ts. Used to translate the
// resolved display name into the lowercase chain key the
// `/api/aave-v4/spoke-position` endpoint expects.
const SPOKE_NAME_TO_KEY: Record<string, string> = {
  Main: "main",
  Bluechip: "bluechip",
  Forex: "forex",
  Gold: "gold",
  "Ethena Correlated": "ethena_corr",
  "Ethena Ecosystem": "ethena_eco",
  EtherFi: "etherfi",
  Kelp: "kelp",
  Lido: "lido",
  "Lombard BTC": "lombard",
  Lombard: "lombard",
  Treasury: "treasury",
};
import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isAaveV4Event } from "@/lib/shared/types/event-shape";
import { AaveV4EventCard } from "@/components/protocol/aave-v4/aave-v4-event-card";
import type { AaveV4TxGroup } from "@/components/protocol/aave-v4/aave-v4-event-header";
import { buildCrossSpokeMoves } from "@/lib/aave-v4/cross-spoke-moves";
import { AaveV4SpokeCardSelector } from "@/components/protocol/aave-v4/aave-v4-spoke-card";
import { AaveV4SpokeRunway } from "@/components/protocol/aave-v4/aave-v4-spoke-runway";
import { AaveV4PositionExposure } from "@/components/protocol/aave-v4/aave-v4-position-exposure";
import { InfoDisclosure } from "@/components/shared/info-disclosure";
import { LearnMore } from "@/components/shared/learn-more-modal";
import { aaveV4EconomicsContent } from "@/lib/shared/learn-more-content";
import { AaveV4TowerChart, computeAaveLifetimeTotals } from "@/components/protocol/aave-v4/aave-v4-tower-chart";
import {
  buildAaveV4SpokeCards,
  buildSpokeCards,
  groupBySpoke,
  computeAaveV4InterestPnl,
  resolveFallbackCollateral,
  liquidationBuffer,
} from "@/lib/aave-v4/spoke-cards";
import { AAVE_V4_FALLBACK_LT, isStable } from "@/lib/aave-v4/liquidation-thresholds";
import { simulateAaveV4Position, type SimPositionInputs } from "@/lib/aave-v4/utils/simulate";
import { resolvePrice, type PriceEntry } from "@/lib/aave/prices";
import { fmtUsd } from "@/lib/aave-v4/format";
import { PriceStrip, type PriceStripAsset } from "@/components/shared/price-strip";
import type { ReserveStats } from "@/lib/aave-v4/spoke-cards";
import { TimelineDisplayProvider, useTimelineDisplay } from "@/components/shared/timeline-display-context";
import { FilterDropdown, DisplaySettingsIcon, type FilterOption } from "@/components/shared/filter-dropdown";
import { TransactionHeatmap } from "@/components/shared/transaction-heatmap";
import { ExportMenu } from "@/components/shared/export-menu";
import { spokeToMarkdown } from "@/lib/aave-v4/spoke-to-markdown";
import {
  NAV_BUTTON,
  NAV_LINK,
  CTRL_GHOST,
  CTRL_OFF,
  CTRL_ON,
  CTRL_ON_ACCENT,
  PILL_META,
} from "@/lib/shared/ui-grammar";
import { EventDateContext } from "@/components/shared/event-time";
import { dayKey, shortDate, shortDateYear } from "@/lib/shared/format-event";
import { formatDate, formatDuration } from "@/lib/date";
import { Icon } from "@/components/icons/icon";
import { getEventActionKey, actionLabel, DEMOTED_ACTIONS } from "@/lib/shared/event-filter-helpers";
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
    showInterestRates,
    toggle,
  } = useTimelineDisplay();
  const options: FilterOption[] = [
    { key: "timestamps", label: "Timestamps" },
    { key: "timeline-values", label: "Timeline values" },
    { key: "change-bars", label: "Change bars" },
    { key: "balance-bars", label: "Balance bars" },
    { key: "usd-values", label: "USD values" },
    { key: "interest-rates", label: "Interest rate" },
    { key: "event-numbers", label: "Event numbers" },
  ];
  const visible = new Set<string>();
  if (showTimestamps) visible.add("timestamps");
  if (showTimelineValues) visible.add("timeline-values");
  if (showChangeBars) visible.add("change-bars");
  if (showBalanceBars) visible.add("balance-bars");
  if (showUsdValues) visible.add("usd-values");
  if (showInterestRates) visible.add("interest-rates");
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
        else if (key === "interest-rates") toggle("showInterestRates");
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
    return () => {
      cancelled = true;
    };
  }, [wallet, isValidWallet, spokeName]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.blockNumber - b.blockNumber || a.timestamp - b.timestamp),
    [events],
  );

  // Cross-spoke migration links, derived from the wallet's FULL timeline (all
  // spokes) — so a leg shown on this spoke page can point at the other spoke
  // it moved to/from in the same tx. Built off `events`, not the spoke-filtered
  // list, because the counterpart leg lives on a different spoke by definition.
  const crossSpokeMoves = useMemo(() => buildCrossSpokeMoves(events), [events]);

  const prices = usePrices();
  const spokeGroups = useMemo(() => groupBySpoke(sortedEvents, undefined, prices), [sortedEvents, prices]);
  const spokeCards = useMemo(() => buildAaveV4SpokeCards(sortedEvents, undefined, prices), [sortedEvents, prices]);
  // The one card we render (single-spoke breadcrumb). If the URL spoke doesn't
  // exist for this wallet we fall back to "no activity on this spoke" below.
  // When chain-truth data is available it overrides the event-derived headline
  // numbers (HF, total supply/debt USD, liq prices, per-asset balances).
  // History fields (peak debt, debt series, event count) stay event-derived.
  const eventActiveCard = useMemo(() => spokeCards.find((c) => c.name === spokeName), [spokeCards, spokeName]);
  const eventActiveGroup = useMemo(() => spokeGroups.find((g) => g.name === spokeName), [spokeGroups, spokeName]);
  const activeCard = useMemo(() => {
    if (!eventActiveCard) return undefined;
    if (!chainPosition || chainPosition.chainStale) {
      // No chain truth (skipped/failed fetch or stale RPC overlay). Re-derive
      // the headline numbers from event data, but resolve un-toggled supplies
      // to NON-collateral first so HF / borrowing-power / liq-price don't credit
      // collateral we can't confirm. See resolveFallbackCollateral.
      if (!eventActiveGroup) return eventActiveCard;
      const hardenedGroup = {
        ...eventActiveGroup,
        result: {
          ...eventActiveGroup.result,
          reserves: resolveFallbackCollateral(eventActiveGroup.result.reserves),
        },
      };
      return buildSpokeCards([hardenedGroup], prices)[0] ?? eventActiveCard;
    }
    const patched = patchSpokeCardWithChain(eventActiveCard, chainPosition, prices);
    // Interest carry needs both legs together: chain-truth current balances and
    // event-derived principal. Patched reserves carry both, so compute here and
    // hang it off the card for the headline footnote + explanation band.
    const patchedReserves = eventActiveGroup
      ? patchReservesWithChain(eventActiveGroup.result.reserves, chainPosition)
      : [];
    return { ...patched, interestPnl: computeAaveV4InterestPnl(patchedReserves, prices) };
  }, [eventActiveCard, eventActiveGroup, chainPosition, prices]);
  const activeGroup = useMemo(() => {
    if (!eventActiveGroup) return undefined;
    if (!chainPosition || chainPosition.chainStale) {
      // Same fallback as activeCard: resolve un-toggled supplies to
      // non-collateral so the economics band (tower, exposure, runway) reads
      // collateral consistently with the hardened headline card.
      return {
        ...eventActiveGroup,
        result: {
          ...eventActiveGroup.result,
          reserves: resolveFallbackCollateral(eventActiveGroup.result.reserves),
        },
      };
    }
    return {
      ...eventActiveGroup,
      result: {
        ...eventActiveGroup.result,
        reserves: patchReservesWithChain(eventActiveGroup.result.reserves, chainPosition),
      },
    };
  }, [eventActiveGroup, chainPosition]);

  // Assets relevant to the position in view — the union of what this spoke is
  // currently supplying and borrowing — for the fixed bottom price strip. Only
  // priced symbols make the cut (resolvePrice → null for unknowns).
  const stripAssets = useMemo<PriceStripAsset[]>(() => {
    if (!activeCard) return [];
    const symbols = [...new Set([...activeCard.supplyingSymbols, ...activeCard.borrowingSymbols].map((a) => a.symbol))];
    return symbols.flatMap((symbol) => {
      const price = resolvePrice(symbol, prices);
      return price != null ? [{ symbol, address: TOKEN_ADDR[symbol], price }] : [];
    });
  }, [activeCard, prices]);

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
    () => (sortDirection === "desc" ? [...dateFilteredEvents].reverse() : dateFilteredEvents),
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
    // Real back button (so the nav chrome doesn't pop in) above two
    // card-shaped blocks that pulse in place — one for the position stat card,
    // one for the economics panel. The economics panel's height fluctuates with
    // the asset count, so instead of guessing it we fade it into the page
    // background with a gradient: the bottom edge blends away and the skeleton
    // doesn't have to commit to a height.
    return (
      <div className="space-y-6 py-8">
        <SmartBackButton walletFilterHref={walletFilterHref} />
        <div className="h-44 rounded-2xl bg-raised animate-pulse" />
        <div className="h-72 rounded-2xl bg-gradient-to-b from-[var(--surface-raised)] to-[var(--background)] animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const filtersActive = hiddenSet.size > 0 || dateRange !== null;
  const dateLabel = dateRange
    ? `${new Date(dateRange[0] * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(dateRange[1] * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "Date";
  const heatmapShown = heatmapOpen || dateRange !== null;

  // Activity-header summary: derive the position lifespan from the spoke's own
  // event stream (sorted ascending) so the header mirrors Liquity's trove
  // timeline header ("Active since <date> · <duration> · <last-activity> ago").
  const positionOpenedAt = spokeScopedEvents[0]?.timestamp;
  const positionLastActivityAt = spokeScopedEvents[spokeScopedEvents.length - 1]?.timestamp;
  const positionClosed = activeCard?.isClosed ?? false;

  // If the URL points at a spoke that doesn't exist for this wallet (typo,
  // stale link), bail with a path back to the wallet's other spokes.
  if (!activeCard && !loading) {
    return (
      <>
        <div className="py-8 space-y-6">
          <SpokeBreadcrumb walletFilterHref={walletFilterHref} wallet={wallet} />
          <div className="text-center py-12">
            <p className="text-foreground text-lg mb-3">
              {shortAddr(wallet)} has no activity on the {spokeName} spoke
            </p>
            <p className="text-sm text-rb-500">
              <Link href={walletFilterHref} className={`underline ${NAV_LINK}`}>
                See this wallet&rsquo;s other spokes →
              </Link>
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="py-8 space-y-6">
        {/* Top toolbar: smart back on the left, export control aligned to the
            right edge — mirrors the Liquity trove page's placement so the two
            rails carry the export affordance in the same spot.
            Smart back: in-app history → browser back; fresh-tab / direct entry
            → up to the wallet's spokes (never dead-ends or leaves the site). */}
        <div className="flex items-center justify-between gap-2">
          <SmartBackButton walletFilterHref={walletFilterHref} />
          {activeCard && (
            <ExportMenu
              buildMarkdown={() =>
                spokeToMarkdown({
                  spokeName,
                  wallet,
                  card: activeCard,
                  reserves: activeGroup?.result.reserves ?? [],
                  prices,
                  events: spokeScopedEvents,
                  generatedAt: new Date(),
                })
              }
              events={spokeScopedEvents}
              csvFilename={`aave-v4-${rawSpoke}-${wallet.slice(0, 10)}-activity.csv`}
            />
          )}
        </div>

        {/* Position card in its own rounded panel — owner address sits in its
            top row, and the (i) at its bottom-right expands the explanation. The
            liquidation/price runway lives here too, beneath the stats: it's the
            gauge for the same current-state HF / borrowing-power numbers. */}
        {activeCard && (
          <div className="rounded-2xl bg-raised">
            <AaveV4SpokeCardSelector
              spokes={[activeCard]}
              selected={spokeName}
              onSelect={() => {}}
              wallet={wallet}
              walletHref={walletFilterHref}
            />
            <RiskPremiumNotice raw={chainPosition?.riskPremiumRaw ?? null} spokeName={spokeName} />
            {activeGroup && hasUiHydrated && (
              <AaveV4SpokeRunwayBlock reserves={activeGroup.result.reserves} prices={prices} runwayCard={activeCard} />
            )}
          </div>
        )}

        {/* Lifetime-flow towers sit directly above the timeline — the towers are
            the aggregate of the same flows the event list itemizes below. */}
        {activeGroup && hasUiHydrated ? (
          <AaveV4SpokeTowerBlock
            reserves={activeGroup.result.reserves}
            prices={prices}
            gasEth={activeGroup.result.totalGasCostEth}
            gasUsd={activeGroup.result.totalGasCostUsd}
          />
        ) : null}

        <TimelineDisplayProvider>
          {/* pl matches the panel content column (economics uses px-4 md:px-6)
              so "Active since" sits inside the notional container rather than
              flush to the box edge; no pr, so justify-between keeps the display
              cluster aligned to the box edge on the right. */}
          <div className="flex items-center justify-between flex-wrap gap-2 pl-4 md:pl-6">
            <div className="flex items-center gap-2 text-sm">
              {positionOpenedAt ? (
                <>
                  <span className="text-foreground">
                    {positionClosed ? "Opened" : "Active since"} {formatDate(positionOpenedAt)}
                  </span>
                  <span className={PILL_META}>
                    {formatDuration(
                      positionOpenedAt,
                      positionClosed ? (positionLastActivityAt ?? new Date()) : new Date(),
                    )}
                  </span>
                  {positionLastActivityAt && (
                    <span className={PILL_META}>
                      <Icon name="clock-zap" size={14} />
                      {formatDuration(positionLastActivityAt, new Date())} ago
                    </span>
                  )}
                </>
              ) : (
                <h2 className="text-sm font-semibold text-foreground">Activity</h2>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-rb-500 tabular-nums">
                {filtersActive
                  ? `${dateFilteredEvents.length} of ${spokeScopedEvents.length}`
                  : `${spokeScopedEvents.length}`}{" "}
                event{spokeScopedEvents.length === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                aria-label={
                  sortDirection === "asc"
                    ? "Currently oldest first — click to flip to newest first"
                    : "Currently newest first — click to flip to oldest first"
                }
                title={sortDirection === "asc" ? "Oldest first" : "Newest first"}
                className={`${CTRL_GHOST} ${CTRL_OFF} w-7 h-7 rounded-md`}
              >
                {sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
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
                className={`${CTRL_GHOST} h-7 px-2.5 rounded-md text-xs ${
                  dateRange ? CTRL_ON_ACCENT : heatmapShown ? CTRL_ON : CTRL_OFF
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
              <TransactionHeatmap events={visibleEvents} value={dateRange} onChange={setDateRange} />
            </div>
          )}

          {displayedEvents.length > 0 ? (
            <AaveV4BarsProvider events={spokeScopedEvents}>
              {/* -mr-1 cancels the EventCard's 4px outer pad on the right so an
                open card's panel reaches the same box edge as the economics /
                position panels above (the spine fills the left, so no -ml). */}
              <div className="space-y-2 -mr-1">
                {displayedEvents.map((event, idx) => {
                  if (!isAaveV4Event(event)) return null;
                  const prevDisplayed = idx > 0 ? displayedEvents[idx - 1] : undefined;
                  const showDate = !prevDisplayed || dayKey(event.timestamp) !== dayKey(prevDisplayed.timestamp);
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
                        migration={crossSpokeMoves.get(event.id)}
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
      <PriceStrip assets={stripAssets} />
    </>
  );
}

function SpokeBreadcrumb({ walletFilterHref, wallet }: { walletFilterHref: string; wallet: string }) {
  return (
    <Link href={walletFilterHref} className={`inline-flex items-center gap-1.5 text-sm ${NAV_LINK}`}>
      <ArrowLeft size={14} />
      <span className="font-mono">{shortAddr(wallet)}</span>
    </Link>
  );
}

// Back affordance above the position card. Prefers browser-history back when
// the user navigated here in-app; on a fresh tab / direct link (history
// length 1) it routes up to the wallet's spokes instead, so it never dead-ends
// or leaves the site. (A bulletproof internal-vs-external check would need a
// nav-tracking provider; this hybrid covers the common cases two lines.)
function SmartBackButton({ walletFilterHref }: { walletFilterHref: string }) {
  const router = useRouter();
  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(walletFilterHref);
    }
  };
  return (
    <button type="button" onClick={onBack} className={NAV_BUTTON}>
      <ArrowLeft size={14} />
      <span>Back</span>
    </button>
  );
}

// ── Risk-premium notice ──────────────────────────────────────────────────────
// V4 prices risk per position: a collateral mix the DAO deems riskier accrues a
// premium on top of the hub's base borrow rate (see the spoke-meta rateNote).
// Premiums are zeroed protocol-wide for now and turned on gradually, so this
// renders NOTHING until a position actually carries one — at which point it
// surfaces the captured chain value. Neutral styling only: per house rule we
// never color-code cost/risk, so the number carries the meaning, not a hue.
//
// NOTE: the displayed magnitude depends on parseRiskPremiumFraction's wad
// assumption, which is best-evidence not contract-confirmed (it's 0 everywhere
// today). Verify against Aave Pro the first time a non-zero premium appears.
function RiskPremiumNotice({ raw, spokeName }: { raw: string | null; spokeName: string }) {
  const frac = parseRiskPremiumFraction(raw);
  if (!frac) return null;
  return (
    <div className="px-4 md:px-6 pb-4 -mt-1">
      <span className={PILL_META}>Risk premium {(frac * 100).toFixed(2)}%</span>
      <p className="mt-1.5 text-xs text-rb-500 max-w-prose">
        Aave V4 prices risk per position. The collateral held here carries a risk premium that increases the borrow
        interest accruing on top of the {spokeName} hub&rsquo;s base rate.
      </p>
    </div>
  );
}

// ── Liquidation / price runway (current state) ───────────────────────────────
// Lives inside the position card, beneath the headline HF / borrowing-power
// stats: the runway is the gauge for those same chain-truth numbers, so it
// belongs next to them rather than a panel away. Renders nothing when there's
// no debt — there's no liquidation story to show.
function AaveV4SpokeRunwayBlock({
  reserves,
  prices,
  runwayCard,
}: {
  reserves: ReserveStats[];
  prices: Record<string, PriceEntry | number>;
  runwayCard: import("@/lib/aave-v4/spoke-cards").AaveSpokeCardInfo | undefined;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  const showRunway = !!runwayCard && runwayCard.totalDebtUsd > 0 && runwayCard.healthFactor != null;
  // Which runway mode is ACTUALLY on screen — drives the explainer copy so it
  // describes only what's shown (a single-collateral price runway OR a
  // health-factor runway), never both as a "with one asset… with several…"
  // hypothetical the reader can't see. Mirrors AaveV4SpokeRunway's own branch.
  const runwaySingle = showRunway && runwayCard ? !!liquidationBuffer(runwayCard).single : false;
  // Only gloss non-collateral supplies when the position has some — otherwise
  // it's another absent-state aside.
  const hasNonCollateralSupply = reserves.some((r) => {
    const netSupply = r.currentSupplied ?? Math.max(0, r.supplied - r.withdrawn - r.liquidatedCollateral);
    return netSupply > 0.0001 && (r.collateralEnabled ?? true) === false;
  });

  if (!showRunway || !runwayCard) return null;

  return (
    <div className="border-t border-rb-200 dark:border-rb-800 px-4 md:px-6 py-5 space-y-3">
      <AaveV4SpokeRunway spoke={runwayCard} />

      {/* Collateral-exposure read as a quiet caption to the runway — what the
          collateral is made of (its blended-LT parameter), not its own panel. */}
      <AaveV4PositionExposure reserves={reserves} prices={prices} blendedLt={runwayCard.blendedLt} variant="footnote" />

      {/* Footnote scoped to the runway only; the lifetime-flow towers carry
          their own footnote down by the timeline now. */}
      <InfoDisclosure
        open={infoOpen}
        onToggle={setInfoOpen}
        label={runwaySingle ? "collateral price runway" : "liquidation runway"}
      >
        <div className="space-y-2 text-sm text-rb-500">
          <div className="flex items-start gap-2 leading-relaxed">
            <span className="select-none text-rb-500">•</span>
            <span>
              {runwaySingle ? (
                <>
                  The runway shows how close this position is to liquidation. It tracks the collateral asset&apos;s
                  price: liquidation triggers if it falls to the liquidation price shown. The marker is the current
                  price; the red zone is liquidation.
                </>
              ) : (
                <>
                  The runway shows how close this position is to liquidation. It tracks the health factor down to 1.0 —
                  Aave&apos;s liquidation trigger, read straight from chain. The marker is the current health factor;
                  the red zone is liquidation.
                </>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2 leading-relaxed">
            <span className="select-none text-rb-500">•</span>
            <span>
              {runwaySingle ? (
                <>The gap is the buffer — how far the collateral&apos;s price can fall before liquidation.</>
              ) : (
                <>
                  The gap is the buffer — how far the collateral can fall before liquidation. It&apos;s shown as a
                  percentage across all collateral rather than one asset&apos;s price, since a single asset&apos;s solo
                  move would overstate the safety of a correlated basket.
                </>
              )}
              {hasNonCollateralSupply && (
                <>
                  {" "}
                  Supplied assets not enabled as collateral don&apos;t back the loan, so they don&apos;t affect this.
                </>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2 leading-relaxed">
            <span className="select-none text-rb-500">•</span>
            <span>
              Reaching that point doesn&apos;t close the position — Aave liquidates only partially, repaying enough debt
              to nudge the health factor back above 1.0.
            </span>
          </div>
          <div className="flex items-start gap-2 leading-relaxed">
            <span className="select-none text-rb-500">•</span>
            <span>
              Outstanding debt already includes accrued borrow interest — it&apos;s the live on-chain balance.
            </span>
          </div>
          <LearnMore content={aaveV4EconomicsContent()} />
        </div>
      </InfoDisclosure>
    </div>
  );
}

// ── Lifetime-flow towers (history) ───────────────────────────────────────────
// Sits directly above the event timeline: the towers are the aggregate of the
// same lifetime flows the timeline itemizes (every supply, withdrawal, borrow
// and repayment), so the two read as summary-then-detail.
function AaveV4SpokeTowerBlock({
  reserves,
  prices,
  gasEth,
  gasUsd,
}: {
  reserves: ReserveStats[];
  prices: Record<string, PriceEntry | number>;
  gasEth: number;
  gasUsd: number;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  const simBase: SimPositionInputs = useMemo(
    () => ({
      supplies: reserves
        .map((r) => {
          const netSupply = r.currentSupplied ?? Math.max(0, r.supplied - r.withdrawn - r.liquidatedCollateral);
          if (netSupply <= 0.0001) return null;
          const price = resolvePrice(r.symbol, prices) ?? 1;
          // Chain-truth LT from the chain-patched reserve; conservative fallback
          // only when no on-chain read was applied (see liquidation-thresholds).
          const lt = r.lt ?? AAVE_V4_FALLBACK_LT;
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
    }),
    [reserves, prices],
  );

  const [surplusSymbols, hideSurplus, setHideSurplus] = useSurplusState(simBase);

  // Lifetime totals that mirror the tower legend, narrated in the footnote.
  const totals = useMemo(() => computeAaveLifetimeTotals(reserves, prices), [reserves, prices]);
  // Figures mirrored in the breakdown legend render foreground-bold; the rest of
  // the prose stays muted (same grammar as the Liquity economics footnote).
  const fig = (n: number) => <span className="font-semibold text-foreground tabular-nums">{fmtUsd(n).title}</span>;

  return (
    <div className="rounded-2xl bg-raised px-4 md:px-6 py-6 space-y-3">
      {/* Section header mirrors the runway's (same 11px uppercase tracking) now
          that the towers stand alone rather than sharing the old band. */}
      <div className="text-[11px] uppercase tracking-wider text-rb-500">Lifetime flows</div>
      <AaveV4TowerChart
        reserves={reserves}
        prices={prices}
        surplusSymbols={surplusSymbols}
        hideSurplus={hideSurplus}
        onToggleHideSurplus={() => setHideSurplus((v) => !v)}
      />

      <InfoDisclosure open={infoOpen} onToggle={setInfoOpen} label="lifetime flows">
        <div className="space-y-2 text-sm text-rb-500">
          {/* Value-bearing narration of the tower legend — figures that mirror
              the breakdown rows render foreground-bold (the same grammar the
              Liquity economics footnote uses). Two bullets: the collateral
              story, then the debt story when this position ever held debt. */}
          <div className="flex items-start gap-2 leading-relaxed">
            <span className="select-none text-rb-500">•</span>
            <span>
              {fig(totals.depositedUsd)} of collateral has moved through this position over its life
              {totals.withdrawnUsd > 0.01 && <> — {fig(totals.withdrawnUsd)} withdrawn</>}
              {totals.liquidatedCollUsd > 0.01 && (
                <>
                  {totals.withdrawnUsd > 0.01 ? " and " : " — "}
                  {fig(totals.liquidatedCollUsd)} liquidated
                </>
              )}
              , leaving {fig(totals.inProtocolUsd)} in protocol today.
            </span>
          </div>
          {totals.hasDebtHistory && (
            <div className="flex items-start gap-2 leading-relaxed">
              <span className="select-none text-rb-500">•</span>
              <span>
                {fig(totals.borrowedUsd)} borrowed over the position&apos;s life
                {totals.repaidUsd > 0.01 && <>, then {fig(totals.repaidUsd)} repaid</>}
                {totals.liquidatedDebtUsd > 0.01 && (
                  <>
                    {totals.repaidUsd > 0.01 ? " and " : ", then "}
                    {fig(totals.liquidatedDebtUsd)} cleared by liquidation
                  </>
                )}
                , leaving {fig(totals.outstandingUsd)} owed today.
              </span>
            </div>
          )}
          {gasEth > 0 && (
            <div className="flex items-start gap-2 leading-relaxed">
              <span className="select-none text-rb-500">•</span>
              <span>
                A total of {gasEth.toFixed(4)} ETH (${gasUsd.toFixed(2)}) has been spent on gas fees across these
                transactions — each event&apos;s own gas is in its footnote below.
              </span>
            </div>
          )}
          <LearnMore content={aaveV4EconomicsContent()} />
        </div>
      </InfoDisclosure>
    </div>
  );
}

function useSurplusState(
  simBase: SimPositionInputs,
): [Set<string>, boolean, React.Dispatch<React.SetStateAction<boolean>>] {
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
