"use client";

// Aave V4 list filters — multi-select Hubs + Spokes dropdowns mirroring
// the Aave V4 dashboard pattern. Filter dropdown carries the segmented
// Position / Health controls; the two CheckboxMultiSelect pills next to
// it slice the spoke universe by hub and by spoke independently (they
// AND together at query time on the server). Search + sort to the right.

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X, ListFilter, ArrowUp, ArrowDown } from "lucide-react";
import { CTRL_GHOST, CTRL_OFF, CTRL_ON, COUNT_BADGE, RESET_LINK } from "@/lib/shared/ui-grammar";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { CheckboxMultiSelect } from "@/components/shared/checkbox-multi-select";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { WalletHistoryDropdown } from "@/components/shared/wallet-history-dropdown";
import { upsertSession } from "@/lib/shared/sessions";
import { fetchAaveV4AssetUniverse } from "@/lib/api/fetch-aave-v4-asset-universe";

export type AaveV4Debt = "all" | "withDebt" | "noDebt";
export type AaveV4Health = "all" | "atRisk" | "underwater";
/** Tri-state liquidation filter. "with" → positions liquidated at least
 *  once, "without" → positions never liquidated, "all" → no restriction. */
export type AaveV4Liquidations = "all" | "with" | "without";
/** Visibility tier. "active" hides effectively-closed positions (supply and
 *  debt both ~$0); "nodust" additionally hides anything under the dust line;
 *  "all" shows everything including closed. */
export type AaveV4Show = "all" | "active" | "nodust";

/** Dust line for the "No dust" tier — combined supply + debt below this (USD)
 *  is hidden. Closed/near-zero (the "active" tier) is a fixed <$1 server-side. */
export const AAVE_V4_DUST_USD = 100;

/** The listing doubles as a wallet view. The bare directory hides closed /
 *  near-zero positions by default; a wallet/ENS-scoped query relaxes to "all"
 *  so a wallet's full history is visible (see the Liquity rail for the same
 *  rule). `show` carries raw intent — undefined means "use this default". */
export function aaveV4ShowDefault(f: { wallet?: string; ownerEns?: string }): AaveV4Show {
  return f.wallet || f.ownerEns ? "all" : "active";
}

export function effectiveAaveV4Show(f: { show?: AaveV4Show; wallet?: string; ownerEns?: string }): AaveV4Show {
  return f.show ?? aaveV4ShowDefault(f);
}

export interface AaveV4ListFilterParams {
  wallet?: string;
  ownerEns?: string;
  /** Multi-select spoke keys. Empty = all spokes. */
  spokes: string[];
  /** Multi-select hub tiers (lowercase keys: "core", "plus", "prime"). */
  hubs: string[];
  /** Multi-select token symbols on the supply side. "???" matches unknown
   *  reserves. Empty = no restriction. */
  supplyAssets: string[];
  /** Multi-select token symbols on the debt side. ANDs with `supplyAssets`
   *  server-side. Empty = no restriction. */
  borrowAssets: string[];
  debt: AaveV4Debt;
  health: AaveV4Health;
  liquidations: AaveV4Liquidations;
  /** Visibility tier. Raw intent: undefined = use the contextual default
   *  (active on the bare directory, all on a wallet-scoped query). */
  show?: AaveV4Show;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

interface Props {
  filters: AaveV4ListFilterParams;
  onFiltersChange: (next: AaveV4ListFilterParams) => void;
}

const HUB_OPTIONS = [
  { value: "core", label: "Core" },
  { value: "plus", label: "Plus" },
  { value: "prime", label: "Prime" },
];

const SPOKE_OPTIONS = [
  { value: "main", label: "Main" },
  { value: "bluechip", label: "Bluechip" },
  { value: "ethena_corr", label: "Ethena Correlated" },
  { value: "ethena_eco", label: "Ethena Ecosystem" },
  { value: "etherfi", label: "EtherFi" },
  { value: "forex", label: "Forex" },
  { value: "gold", label: "Gold" },
  { value: "kelp", label: "Kelp" },
  { value: "lido", label: "Lido" },
  { value: "lombard", label: "Lombard BTC" },
];

const SORT_OPTIONS = [
  { value: "lastActivity", label: "Latest Activity" },
  { value: "debtUsd", label: "Debt" },
  { value: "supplyUsd", label: "Supply" },
  { value: "healthFactor", label: "Health Factor" },
];

export function AaveV4ListFilters({ filters, onFiltersChange }: Props) {
  const initialSearch = filters.wallet ?? filters.ownerEns ?? "";
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  // Asset universe — fetched once on mount, drives the Supplying / Borrowing
  // multi-select option lists. Empty until the network call returns; the
  // pills render but their dropdowns just show the "All …" radio in the
  // interim. Failure is non-fatal — pills stay empty rather than throwing.
  const [assetUniverse, setAssetUniverse] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchAaveV4AssetUniverse()
      .then((r) => {
        if (cancelled) return;
        setAssetUniverse(r.assets.map((a) => a.symbol));
      })
      .catch(() => {
        // Non-fatal — leave the pills empty.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const searchRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(searchInput, 500);

  useEffect(() => {
    setSearchInput(filters.wallet ?? filters.ownerEns ?? "");
  }, [filters.wallet, filters.ownerEns]);

  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (!trimmed) {
      if (filters.wallet || filters.ownerEns) {
        onFiltersChange({ ...filters, wallet: undefined, ownerEns: undefined });
      }
      return;
    }
    const isEns = trimmed.toLowerCase().endsWith(".eth");
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
    if (!isEns && !isAddress) return;
    const lowered = trimmed.toLowerCase();
    onFiltersChange({
      ...filters,
      wallet: isAddress ? lowered : undefined,
      ownerEns: isEns ? lowered : undefined,
    });
    // Record this wallet in the Aave V4 recents list so it appears in the
    // dropdown next time. Each rail keeps its own list — no cross-rail
    // bleed. ENS-typed entries aren't recorded here (no resolution yet);
    // they'll get picked up when the user drills into a wallet's detail page.
    if (isAddress) {
      upsertSession([lowered], { [lowered]: null }, "aave-v4");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSortOpen(false);
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const handleClearSearch = () => {
    setSearchInput("");
    onFiltersChange({ ...filters, wallet: undefined, ownerEns: undefined });
  };

  // Visibility resolves against the contextual default so the badge only
  // counts it as "active" when the user has overridden it (and the relaxed
  // wallet view doesn't read as filtered).
  const effShow = effectiveAaveV4Show(filters);
  const showDefault = aaveV4ShowDefault(filters);

  const activeFilterCount =
    (effShow !== showDefault ? 1 : 0) +
    (filters.debt !== "all" ? 1 : 0) +
    (filters.health !== "all" ? 1 : 0) +
    (filters.liquidations !== "all" ? 1 : 0);

  const setShow = (show: AaveV4Show) => onFiltersChange({ ...filters, show });
  const setDebt = (debt: AaveV4Debt) => onFiltersChange({ ...filters, debt });
  const setHealth = (health: AaveV4Health) => onFiltersChange({ ...filters, health });
  const setLiquidations = (liquidations: AaveV4Liquidations) => onFiltersChange({ ...filters, liquidations });
  const setSpokes = (spokes: string[]) => onFiltersChange({ ...filters, spokes });
  const setHubs = (hubs: string[]) => onFiltersChange({ ...filters, hubs });
  const setSupplyAssets = (supplyAssets: string[]) => onFiltersChange({ ...filters, supplyAssets });
  const setBorrowAssets = (borrowAssets: string[]) => onFiltersChange({ ...filters, borrowAssets });

  // Render each option with a small token chip — "???" gets the unknown
  // placeholder by passing the literal sentinel through to TokenChipIcon,
  // which falls through to its UnknownTokenSvg branch.
  const assetOptions = assetUniverse.map((symbol) => ({
    value: symbol,
    label: symbol === "???" ? "Unknown" : symbol,
    icon: (
      <span className="inline-flex">
        <TokenChipIcon symbol={symbol} size={18} filterable={false} />
      </span>
    ),
  }));

  const resetFilters = () =>
    onFiltersChange({ ...filters, show: undefined, debt: "all", health: "all", liquidations: "all" });

  return (
    <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 xl:gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:flex-1">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Filter dropdown — segmented position + health controls. */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`${CTRL_GHOST} ${isFilterOpen || activeFilterCount > 0 ? CTRL_ON : CTRL_OFF} gap-2 px-3 h-8 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500`}
              aria-expanded={isFilterOpen}
              aria-label={`Filter positions${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}`}
            >
              <ListFilter className="w-3.5 h-3.5 text-rb-500" aria-hidden="true" />
              {activeFilterCount > 0 && <span className={COUNT_BADGE}>{activeFilterCount}</span>}
              <ChevronDown
                className={`w-3.5 h-3.5 text-rb-500 transition-transform ${isFilterOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {isFilterOpen && (
              <div
                className="absolute top-full left-0 mt-2 z-50 min-w-[280px] max-h-[460px] overflow-y-auto overlay-panel"
                role="menu"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-rb-300 dark:border-rb-700">
                  <span className="text-xs uppercase tracking-wider font-bold">Filters</span>
                  {activeFilterCount > 0 && (
                    <button onClick={resetFilters} className={RESET_LINK}>
                      Reset
                    </button>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-xs text-rb-500 uppercase tracking-wider mb-2">Show</div>
                  <div className="flex bg-rb-200 dark:bg-rb-900 rounded-lg p-1" role="group">
                    {(
                      [
                        { v: "all", l: "All" },
                        { v: "active", l: "Active" },
                        { v: "nodust", l: "No dust" },
                      ] as { v: AaveV4Show; l: string }[]
                    ).map(({ v, l }) => (
                      <button
                        key={v}
                        onClick={() => setShow(v)}
                        title={v === "nodust" ? `Hide positions under $${AAVE_V4_DUST_USD}` : undefined}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          effShow === v
                            ? "bg-rb-300 dark:bg-rb-700 text-foreground font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={effShow === v}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3">
                  <div className="text-xs text-rb-500 uppercase tracking-wider mb-2">Position</div>
                  <div className="flex bg-rb-200 dark:bg-rb-900 rounded-lg p-1" role="group">
                    {(
                      [
                        { v: "all", l: "Any" },
                        { v: "withDebt", l: "With debt" },
                        { v: "noDebt", l: "Supply only" },
                      ] as { v: AaveV4Debt; l: string }[]
                    ).map(({ v, l }) => (
                      <button
                        key={v}
                        onClick={() => setDebt(v)}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          filters.debt === v
                            ? v === "all"
                              ? "bg-rb-300 dark:bg-rb-700 text-foreground font-semibold"
                              : v === "withDebt"
                                ? "text-white bg-green-500 dark:bg-green-950 dark:text-green-500 rounded"
                                : "bg-rb-300 dark:bg-rb-700 text-foreground font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={filters.debt === v}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3">
                  <div className="text-xs text-rb-500 uppercase tracking-wider mb-2">Health</div>
                  <div className="flex bg-rb-200 dark:bg-rb-900 rounded-lg p-1" role="group">
                    {(
                      [
                        { v: "all", l: "Any" },
                        { v: "atRisk", l: "At risk" },
                        { v: "underwater", l: "Underwater" },
                      ] as { v: AaveV4Health; l: string }[]
                    ).map(({ v, l }) => (
                      <button
                        key={v}
                        onClick={() => setHealth(v)}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          filters.health === v
                            ? v === "all"
                              ? "bg-rb-300 dark:bg-rb-700 text-foreground font-semibold"
                              : v === "atRisk"
                                ? "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-400 font-semibold"
                                : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={filters.health === v}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3">
                  <div className="text-xs text-rb-500 uppercase tracking-wider mb-2">Liquidations</div>
                  <div className="flex bg-rb-200 dark:bg-rb-900 rounded-lg p-1" role="group">
                    {(
                      [
                        { v: "all", l: "Any" },
                        { v: "with", l: "Liquidated" },
                        { v: "without", l: "Never" },
                      ] as { v: AaveV4Liquidations; l: string }[]
                    ).map(({ v, l }) => (
                      <button
                        key={v}
                        onClick={() => setLiquidations(v)}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          filters.liquidations === v
                            ? v === "all"
                              ? "bg-rb-300 dark:bg-rb-700 text-foreground font-semibold"
                              : v === "with"
                                ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 font-semibold"
                                : "bg-rb-300 dark:bg-rb-700 text-foreground font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={filters.liquidations === v}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Hubs + Spokes multi-select pills */}
          <CheckboxMultiSelect
            label="Hubs"
            allLabel="All hubs"
            value={filters.hubs}
            onChange={setHubs}
            options={HUB_OPTIONS}
          />
          <CheckboxMultiSelect
            label="Spokes"
            allLabel="All spokes"
            value={filters.spokes}
            onChange={setSpokes}
            options={SPOKE_OPTIONS}
          />
          {/* Asset-side pills — independent multi-selects ANDed server-side.
              Both draw from the same data-driven universe; pick the same
              symbol in both pills to express "holds X on either side". */}
          <CheckboxMultiSelect
            label="Supplying"
            allLabel="Any supply"
            value={filters.supplyAssets}
            onChange={setSupplyAssets}
            options={assetOptions}
          />
          <CheckboxMultiSelect
            label="Borrowing"
            allLabel="Any debt"
            value={filters.borrowAssets}
            onChange={setBorrowAssets}
            options={assetOptions}
          />
        </div>

        {/* Search input — wraps in a relative container so the recent/pinned
            dropdown can anchor beneath it when focused-empty. The dropdown's
            session list is shared across protocols (cross-rail memory), but
            picking a row just fills this input — same code path as typing —
            so the filter stays Aave-V4-scoped. */}
        <div ref={searchRef} className="relative w-full lg:flex-1">
          <input
            type="text"
            placeholder="Address or ENS…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            className="w-full px-3 py-2 pr-10 bg-rb-50 dark:bg-rb-800 h-8 border border-rb-300 dark:border-rb-700 rounded-md text-sm text-foreground placeholder-rb-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            aria-label="Search by wallet address or ENS name"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 p-1 text-rb-500 hover:text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rb-500 pointer-events-none"
              aria-hidden="true"
            />
          )}
          <WalletHistoryDropdown
            show={searchFocused && searchInput.trim() === ""}
            containerRef={searchRef}
            protocol="aave-v4"
            onClose={() => setSearchFocused(false)}
            onPick={(address) => {
              setSearchInput(address);
              setSearchFocused(false);
            }}
          />
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-1 w-full lg:w-auto">
        <button
          onClick={() => onFiltersChange({ ...filters, sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })}
          className={`${CTRL_GHOST} ${CTRL_OFF} w-8 h-8 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
          aria-label={filters.sortOrder === "asc" ? "Sort ascending" : "Sort descending"}
        >
          {filters.sortOrder === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </button>
        <div className="relative h-8 flex-1 lg:flex-initial" ref={sortRef}>
          <button
            onClick={() => setIsSortOpen(!isSortOpen)}
            className={`${CTRL_GHOST} ${isSortOpen ? CTRL_ON : CTRL_OFF} w-full lg:w-auto gap-2 px-3 h-8 rounded-md text-xs font-medium lg:min-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-expanded={isSortOpen}
          >
            <span>{SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.label ?? "Sort"}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-rb-500 ml-auto transition-transform ${isSortOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {isSortOpen && (
            <div
              className="absolute top-full left-0 lg:left-auto right-0 mt-2 z-50 min-w-[200px] overflow-hidden overlay-panel"
              role="menu"
            >
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => {
                    onFiltersChange({ ...filters, sortBy: o.value });
                    setIsSortOpen(false);
                  }}
                  className={`overlay-item ${
                    filters.sortBy === o.value ? "overlay-item-active" : ""
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  role="menuitem"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
