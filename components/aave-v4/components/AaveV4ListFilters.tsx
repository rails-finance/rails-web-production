"use client";

// Aave V4 list filters — visual analog of TroveListFilters.
// Filter dropdown (status + advanced filters) + 3 spoke quick-pills +
// search input + sort dropdown. The 11-spoke universe is too wide for an
// all-pill row, so we keep the three most-trafficked spokes (Main,
// Bluechip, EtherFi) as pills and surface the rest as a dropdown in the
// filter menu — same affordance pattern as Liquity V2's collateral pills.

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X, Filter } from "lucide-react";
import { useDebounce } from "@/lib/hooks/useDebounce";

export type AaveV4Debt = "all" | "withDebt" | "noDebt";
export type AaveV4Health = "all" | "atRisk" | "underwater";

export interface AaveV4ListFilterParams {
  wallet?: string;
  ownerEns?: string;
  spoke?: string;
  debt: AaveV4Debt;
  health: AaveV4Health;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

interface Props {
  filters: AaveV4ListFilterParams;
  onFiltersChange: (next: AaveV4ListFilterParams) => void;
}

const PILL_SPOKES = [
  { key: "main", label: "Main" },
  { key: "bluechip", label: "Bluechip" },
  { key: "etherfi", label: "EtherFi" },
];

const ALL_SPOKES = [
  { value: "",            label: "All spokes" },
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
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [hoveredSpoke, setHoveredSpoke] = useState<string | null>(null);
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
    onFiltersChange({
      ...filters,
      wallet: isAddress ? trimmed.toLowerCase() : undefined,
      ownerEns: isEns ? trimmed.toLowerCase() : undefined,
    });
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
    (filters.debt !== "all" ? 1 : 0) +
    (filters.health !== "all" ? 1 : 0) +
    (filters.spoke && !PILL_SPOKES.some((p) => p.key === filters.spoke) ? 1 : 0);

  const setDebt = (debt: AaveV4Debt) => onFiltersChange({ ...filters, debt });
  const setHealth = (health: AaveV4Health) => onFiltersChange({ ...filters, health });
  const setSpoke = (spoke: string) =>
    onFiltersChange({ ...filters, spoke: spoke || undefined });

  const resetFilters = () =>
    onFiltersChange({
      ...filters,
      debt: "all",
      health: "all",
      spoke: undefined,
    });

  return (
    <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 xl:gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:flex-1">
        <div className="flex items-center gap-2 w-full lg:w-auto">
          {/* Filter dropdown */}
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
                {/* Debt segmented */}
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

                {/* Health segmented */}
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

                {/* Spoke select — all 11 spokes here so the 3 pills outside
                    stay focused on the most-trafficked subset. */}
                <div className="p-3">
                  <div className="text-xs text-rb-500 uppercase tracking-wider mb-2">All spokes</div>
                  <select
                    value={filters.spoke ?? ""}
                    onChange={(e) => setSpoke(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-rb-300 dark:border-rb-700 bg-rb-50 dark:bg-rb-900 text-foreground text-sm font-medium cursor-pointer"
                  >
                    {ALL_SPOKES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
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

          {/* Spoke quick-pills */}
          <div
            className="flex items-center gap-2 flex-1 lg:flex-initial"
            role="group"
            aria-label="Filter by spoke"
          >
            {PILL_SPOKES.map((p) => {
              const isVisible = !filters.spoke || filters.spoke === p.key;
              const isExclusive = filters.spoke === p.key;
              const isPreview =
                filters.spoke && hoveredSpoke && hoveredSpoke !== p.key && filters.spoke === hoveredSpoke;
              return (
                <button
                  key={p.key}
                  onMouseEnter={() => setHoveredSpoke(p.key)}
                  onMouseLeave={() => setHoveredSpoke(null)}
                  onClick={() => setSpoke(filters.spoke === p.key ? "" : p.key)}
                  className={`cursor-pointer relative flex items-center duration-150 border-2 h-10 justify-center gap-1 lg:gap-2 px-2 lg:px-3 py-2 rounded-lg transition-colors flex-1 lg:flex-initial group focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isExclusive
                      ? "border-blue-700"
                      : isVisible
                      ? "border-rb-300 dark:border-rb-700 hover:border-blue-700/50"
                      : isPreview
                      ? "border-blue-400 dark:border-rb-700/50 opacity-75"
                      : "border-rb-300 dark:border-rb-700 hover:dark:border-blue-700/50"
                  }`}
                  aria-pressed={isExclusive}
                >
                  <img
                    src="/icons/protocols/aave-v4.png"
                    alt=""
                    className="w-5 h-5 rounded-[4px]"
                  />
                  <span className="hidden sm:inline text-foreground font-bold text-sm lg:text-base">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full lg:flex-1">
          <input
            type="text"
            placeholder="Address or ENS…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
