"use client";

// Aave V4 list filters — multi-select Hubs + Spokes dropdowns mirroring
// the Aave V4 dashboard pattern. Filter dropdown carries the segmented
// Position / Health controls; the two CheckboxMultiSelect pills next to
// it slice the spoke universe by hub and by spoke independently (they
// AND together at query time on the server). Search + sort to the right.

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X, Filter } from "lucide-react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { CheckboxMultiSelect } from "@/components/shared/checkbox-multi-select";
import { WalletHistoryDropdown } from "@/components/shared/wallet-history-dropdown";
import { upsertSession } from "@/lib/shared/sessions";

export type AaveV4Debt = "all" | "withDebt" | "noDebt";
export type AaveV4Health = "all" | "atRisk" | "underwater";

export interface AaveV4ListFilterParams {
  wallet?: string;
  ownerEns?: string;
  /** Multi-select spoke keys. Empty = all spokes. */
  spokes: string[];
  /** Multi-select hub tiers (lowercase keys: "core", "plus", "prime"). */
  hubs: string[];
  debt: AaveV4Debt;
  health: AaveV4Health;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

interface Props {
  filters: AaveV4ListFilterParams;
  onFiltersChange: (next: AaveV4ListFilterParams) => void;
}

const HUB_OPTIONS = [
  { value: "core",  label: "Core"  },
  { value: "plus",  label: "Plus"  },
  { value: "prime", label: "Prime" },
];

const SPOKE_OPTIONS = [
  { value: "main",        label: "Main" },
  { value: "bluechip",    label: "Bluechip" },
  { value: "ethena_corr", label: "Ethena Correlated" },
  { value: "ethena_eco",  label: "Ethena Ecosystem" },
  { value: "etherfi",     label: "EtherFi" },
  { value: "forex",       label: "Forex" },
  { value: "gold",        label: "Gold" },
  { value: "kelp",        label: "Kelp" },
  { value: "lido",        label: "Lido" },
  { value: "lombard",     label: "Lombard BTC" },
];

const SORT_OPTIONS = [
  { value: "lastActivity", label: "Latest Activity" },
  { value: "debtUsd",      label: "Debt" },
  { value: "supplyUsd",    label: "Supply" },
  { value: "healthFactor", label: "Health Factor" },
];

export function AaveV4ListFilters({ filters, onFiltersChange }: Props) {
  const initialSearch = filters.wallet ?? filters.ownerEns ?? "";
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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

  const activeFilterCount =
    (filters.debt !== "all" ? 1 : 0) + (filters.health !== "all" ? 1 : 0);

  const setDebt = (debt: AaveV4Debt) => onFiltersChange({ ...filters, debt });
  const setHealth = (health: AaveV4Health) => onFiltersChange({ ...filters, health });
  const setSpokes = (spokes: string[]) => onFiltersChange({ ...filters, spokes });
  const setHubs = (hubs: string[]) => onFiltersChange({ ...filters, hubs });

  const resetFilters = () =>
    onFiltersChange({ ...filters, debt: "all", health: "all" });

  return (
    <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 xl:gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:flex-1">
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Filter dropdown — segmented position + health controls. */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex cursor-pointer items-center gap-2 px-4 h-10 py-2 bg-rb-200 dark:bg-rb-900 hover:bg-rb-300 dark:hover:bg-rb-800 rounded-lg text-foreground font-bold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-expanded={isFilterOpen}
              aria-label={`Filter positions${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}`}
            >
              <Filter className="w-4 h-4 text-rb-500" aria-hidden="true" />
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 bg-rb-100 dark:bg-rb-800 rounded-full text-xs text-rb-500">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-rb-500 transition-transform ${isFilterOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {isFilterOpen && (
              <div
                className="absolute top-full border border-rb-300 dark:border-rb-700 left-0 mt-2 bg-rb-100 dark:bg-rb-800 rounded-lg shadow-xl z-50 min-w-[280px] max-h-[460px] overflow-y-auto"
                role="menu"
              >
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
                              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 font-semibold"
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
                              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 font-semibold"
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

                {activeFilterCount > 0 && (
                  <div className="p-3">
                    <button
                      onClick={resetFilters}
                      className="cursor-pointer w-full px-3 py-1.5 bg-rb-300 dark:bg-rb-700 hover:bg-rb-400 dark:hover:bg-rb-600 rounded text-sm text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
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
            className="w-full px-4 py-2 pr-10 bg-rb-100 dark:bg-rb-900 h-10 border border-rb-300 dark:border-rb-700 rounded-lg text-foreground placeholder-rb-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rb-500 pointer-events-none" aria-hidden="true" />
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
          onClick={() =>
            onFiltersChange({ ...filters, sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" })
          }
          className="cursor-pointer flex items-center justify-center w-10 h-10 bg-rb-200 dark:bg-rb-900 hover:bg-rb-300 dark:hover:bg-rb-800 rounded-lg transition-colors text-foreground dark:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={filters.sortOrder === "asc" ? "Sort ascending" : "Sort descending"}
        >
          <span aria-hidden="true">{filters.sortOrder === "asc" ? "↑" : "↓"}</span>
        </button>
        <div className="relative h-10 flex-1 lg:flex-initial" ref={sortRef}>
          <button
            onClick={() => setIsSortOpen(!isSortOpen)}
            className="cursor-pointer w-full lg:w-auto flex items-center gap-2 px-4 py-2 bg-rb-200 dark:bg-rb-900 hover:bg-rb-300 dark:hover:bg-rb-800 rounded-lg text-foreground font-medium transition-colors lg:min-w-[160px] dark:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-expanded={isSortOpen}
          >
            <span>{SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.label ?? "Sort"}</span>
            <ChevronDown
              className={`w-4 h-4 text-rb-500 ml-auto transition-transform ${isSortOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {isSortOpen && (
            <div className="absolute top-full left-0 lg:left-auto right-0 mt-2 bg-rb-100 dark:bg-rb-900 border border-rb-300 dark:border-rb-700 rounded-lg shadow-xl z-50 min-w-[200px] overflow-hidden" role="menu">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => {
                    onFiltersChange({ ...filters, sortBy: o.value });
                    setIsSortOpen(false);
                  }}
                  className={`cursor-pointer block w-full text-left px-4 py-3 text-foreground hover:bg-rb-200 dark:hover:bg-rb-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    filters.sortBy === o.value ? "bg-rb-200 dark:bg-rb-800" : ""
                  }`}
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
