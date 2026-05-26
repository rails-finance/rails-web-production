"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, X, Filter } from "lucide-react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { CheckboxMultiSelect } from "@/components/shared/checkbox-multi-select";
import { WalletHistoryDropdown } from "@/components/shared/wallet-history-dropdown";
import { upsertSession } from "@/lib/shared/sessions";

export interface TroveListFilterParams {
  troveId?: string;
  status?: string;
  /** Multi-select collateral types. Empty/undefined = all. */
  collateralTypes?: string[];
  ownerAddress?: string;
  ownerEns?: string;
  activeWithin?: string;
  createdWithin?: string;
  batchOnly?: boolean;
  individualOnly?: boolean;
  hasRedemptions?: boolean;
  showZombie?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface TroveListFiltersProps {
  filters: TroveListFilterParams;
  onFiltersChange: (filters: TroveListFilterParams) => void;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSortChange?: (sortBy: string, sortOrder?: "asc" | "desc") => void;
  availableCollateralTypes?: string[];
}

export function TroveListFilters({
  filters,
  onFiltersChange,
  sortBy = "lastActivity",
  sortOrder = "desc",
  onSortChange,
  availableCollateralTypes = ["WETH", "wstETH", "rETH"],
}: TroveListFiltersProps) {
  // Initialize with actual filter value that's set (troveId, address, or ENS)
  const initialSearchValue = filters.troveId || filters.ownerAddress || filters.ownerEns || "";
  const [searchInput, setSearchInput] = useState<string>(initialSearchValue);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search input to reduce API calls
  const debouncedSearchInput = useDebounce(searchInput, 500);

  // Keep search input in sync with filters from props
  useEffect(() => {
    // Sync with the actual filter value that was set
    const filterValue = filters.troveId || filters.ownerAddress || filters.ownerEns || "";
    setSearchInput(filterValue);
  }, [filters.troveId, filters.ownerAddress, filters.ownerEns]);

  // Trigger search when debounced value changes
  useEffect(() => {
    // If empty, clear immediately (no debounce delay)
    if (!debouncedSearchInput.trim()) {
      if (filters.troveId || filters.ownerAddress || filters.ownerEns) {
        handleClearSearch();
      }
      return;
    }

    // Trigger search with debounced value
    handleSearchSubmit();
  }, [debouncedSearchInput]);

  // Close dropdowns on outside click and Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSortDropdownOpen(false);
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedValue = searchInput.trim();

    // Detect input type
    const isTroveId = trimmedValue && /^\d+$/.test(trimmedValue);
    const isEns = trimmedValue && trimmedValue.toLowerCase().endsWith(".eth");
    const isAddress = trimmedValue && /^0x[a-fA-F0-9]{40}$/.test(trimmedValue);

    onFiltersChange({
      ...filters,
      troveId: isTroveId ? trimmedValue : undefined,
      ownerAddress: isAddress ? trimmedValue : undefined,
      ownerEns: isEns ? trimmedValue : undefined,
    });
    // Record this wallet in the Liquity V2 recents list so it appears in
    // the dropdown next time. Each rail keeps its own list — no cross-rail
    // bleed. ENS-typed entries aren't recorded here (no resolution yet);
    // they'll get picked up when the user drills into a wallet's detail page.
    if (isAddress) {
      const lowered = trimmedValue.toLowerCase();
      upsertSession([lowered], { [lowered]: null }, "liquity-v2");
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    onFiltersChange({
      ...filters,
      troveId: undefined,
      ownerAddress: undefined,
      ownerEns: undefined,
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.status) count++;
    if (filters.batchOnly) count++;
    if (filters.individualOnly) count++;
    if (filters.hasRedemptions !== undefined) count++;
    if (filters.showZombie !== undefined) count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  const handleFilterChange = (updates: Partial<TroveListFilterParams>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const resetFilters = () => {
    onFiltersChange({
      ...filters,
      status: undefined,
      batchOnly: undefined,
      individualOnly: undefined,
      hasRedemptions: undefined,
      showZombie: undefined,
    });
  };

  // Sort options - map UI labels to backend field names
  const sortOptions = [
    { value: "lastActivity", label: "Latest Activity" },
    { value: "debt", label: "Debt" },
    { value: "coll", label: "Collateral" },
    { value: "ratio", label: "Ratio" },
    { value: "interestRate", label: "Interest Rate" },
  ];

  return (
    <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 xl:gap-4">
      {/* Filter and Collateral row on mobile, inline on desktop */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:flex-1">
        {/* First row on mobile: Filter button and collateral buttons */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          {/* Filter Dropdown */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex cursor-pointer items-center gap-2 px-4 h-10 py-2 bg-rb-200 dark:bg-rb-900 hover:bg-rb-300 dark:hover:bg-rb-800 rounded-lg text-foreground font-bold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-expanded={isFilterDropdownOpen}
              aria-label={`Filter troves${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
            >
              <Filter className="w-4 h-4 text-rb-500" aria-hidden="true" />
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 bg-rb-100 dark:bg-rb-800 rounded-full text-xs text-rb-500" aria-hidden="true">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-rb-500 transition-transform ${isFilterDropdownOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {isFilterDropdownOpen && (
              <div className="absolute top-full border border-rb-300 dark:border-rb-700 left-0 mt-2 bg-rb-100 dark:bg-rb-800 rounded-lg shadow-xl z-50 min-w-[280px] max-h-[400px] overflow-y-auto" role="menu">
                {/* Status Toggle */}
                <div className="p-3 ">
                  <div className="text-xs text-rb-500 uppercase tracking-wider mb-2">Status</div>
                  <div className="flex bg-rb-200 dark:bg-rb-900 rounded-lg p-1" role="group" aria-label="Filter by trove status">
                    <button
                      onClick={() => handleFilterChange({ status: "all" })}
                      className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        !filters.status
                          ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 font-semibold"
                          : "text-rb-500 hover:text-foreground"
                      }`}
                      aria-pressed={!filters.status}
                      aria-label="Show all trove statuses"
                    >
                      All
                    </button>
                    <button
                      onClick={() => handleFilterChange({ status: "open" })}
                      className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        filters.status === "open"
                          ? "text-white bg-green-500 dark:bg-green-950 dark:text-green-500 rounded"
                          : "text-rb-500 hover:text-foreground"
                      }`}
                      aria-pressed={filters.status === "open"}
                      aria-label="Show only active troves"
                    >
                      Active
                    </button>
                    <button
                      onClick={() => handleFilterChange({ status: "closed" })}
                      className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        filters.status === "closed"
                          ? "bg-rb-300 dark:bg-rb-700 text-foreground font-semibold"
                          : "text-rb-500 hover:text-foreground"
                      }`}
                      aria-pressed={filters.status === "closed"}
                      aria-label="Show only closed troves"
                    >
                      Closed
                    </button>
                  </div>
                </div>

                {/* Liquidations — thin shortcut over `status`. Liquity troves
                    are terminal entities (a liquidated trove can't be reopened
                    with the same ID), so "with liquidations" is just
                    status=liquidated. Picking this overrides the Status group;
                    picking a Status option resets this back to Any. */}
                <div className="p-3">
                  <div className="text-xs text-rb-500 uppercase tracking-wider mb-2">
                    Liquidations
                  </div>
                  <div className="flex bg-rb-200 dark:bg-rb-900 rounded-lg p-1" role="group" aria-label="Filter by liquidation history">
                    <button
                      onClick={() =>
                        handleFilterChange({
                          status: filters.status === "liquidated" ? undefined : filters.status,
                        })
                      }
                      className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        filters.status !== "liquidated"
                          ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 font-semibold"
                          : "text-rb-500 hover:text-foreground"
                      }`}
                      aria-pressed={filters.status !== "liquidated"}
                    >
                      Any
                    </button>
                    <button
                      onClick={() => handleFilterChange({ status: "liquidated" })}
                      className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        filters.status === "liquidated"
                          ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 font-semibold"
                          : "text-rb-500 hover:text-foreground"
                      }`}
                      aria-pressed={filters.status === "liquidated"}
                    >
                      Liquidated
                    </button>
                  </div>
                </div>

                {/* Advanced Filters */}
                <div className="p-3 space-y-3">
                  {/* Redemptions Filter */}
                  <div>
                    <div className="text-xs text-rb-500 uppercase tracking-wider mb-2">
                      Redemptions
                    </div>
                    <div className="flex bg-rb-200 dark:bg-rb-900 rounded-lg p-1" role="group" aria-label="Filter by redemptions">
                      <button
                        onClick={() => handleFilterChange({ hasRedemptions: undefined })}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          filters.hasRedemptions === undefined
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={filters.hasRedemptions === undefined}
                        aria-label="Show troves with or without redemptions"
                      >
                        All
                      </button>
                      <button
                        onClick={() => handleFilterChange({ hasRedemptions: true })}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          filters.hasRedemptions === true
                            ? "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-400 font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={filters.hasRedemptions === true}
                        aria-label="Show only troves with redemptions"
                      >
                        With
                      </button>
                      <button
                        onClick={() => handleFilterChange({ hasRedemptions: false })}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          filters.hasRedemptions === false
                            ? "bg-rb-300 dark:bg-rb-700 text-foreground font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={filters.hasRedemptions === false}
                        aria-label="Show only troves without redemptions"
                      >
                        Without
                      </button>
                    </div>
                  </div>

                  {/* Interest Rate Management Filter */}
                  <div>
                    <div className="text-xs text-rb-500 uppercase tracking-wider mb-2">
                      Interest Rate Management
                    </div>
                    <div className="flex bg-rb-200 dark:bg-rb-900 rounded-lg p-1" role="group" aria-label="Filter by interest rate management">
                      <button
                        onClick={() => handleFilterChange({ batchOnly: undefined, individualOnly: undefined })}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !filters.batchOnly && !filters.individualOnly
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={!filters.batchOnly && !filters.individualOnly}
                        aria-label="Show all troves regardless of interest rate management"
                      >
                        All
                      </button>
                      <button
                        onClick={() => handleFilterChange({ batchOnly: true, individualOnly: undefined })}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          filters.batchOnly
                            ? "bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-400 font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={filters.batchOnly === true}
                        aria-label="Show only troves with delegated interest rate management"
                      >
                        Delegated
                      </button>
                      <button
                        onClick={() => handleFilterChange({ batchOnly: undefined, individualOnly: true })}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          filters.individualOnly
                            ? "bg-rb-300 dark:bg-rb-700 text-foreground font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={filters.individualOnly === true}
                        aria-label="Show only troves with individual interest rate management"
                      >
                        Individual
                      </button>
                    </div>
                  </div>

                  {/* Zombie Troves Filter */}
                  <div>
                    <div className="text-xs text-rb-500 uppercase tracking-wider mb-2">
                      Zombie Troves
                    </div>
                    <div className="flex bg-rb-200 dark:bg-rb-900 rounded-lg p-1" role="group" aria-label="Filter zombie troves">
                      <button
                        onClick={() => handleFilterChange({ showZombie: undefined })}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          filters.showZombie === undefined
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={filters.showZombie === undefined}
                        aria-label="Show all troves including zombie troves"
                      >
                        All
                      </button>
                      <button
                        onClick={() => handleFilterChange({ showZombie: true })}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          filters.showZombie === true
                            ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={filters.showZombie === true}
                        aria-label="Show only zombie troves"
                      >
                        Show
                      </button>
                      <button
                        onClick={() => handleFilterChange({ showZombie: false })}
                        className={`cursor-pointer flex-1 px-3 py-1.5 rounded text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          filters.showZombie === false
                            ? "bg-rb-300 dark:bg-rb-700 text-foreground font-semibold"
                            : "text-rb-500 hover:text-foreground"
                        }`}
                        aria-pressed={filters.showZombie === false}
                        aria-label="Hide zombie troves"
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reset Filters */}
                {activeFilterCount > 0 && (
                  <div className="p-3">
                    <button
                      onClick={resetFilters}
                      className="cursor-pointer w-full px-3 py-1.5 bg-rb-300 dark:bg-rb-700 hover:bg-rb-400 dark:hover:bg-rb-600 rounded text-sm text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Reset all filters"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Collateral Type — multi-select with token icons */}
          <CheckboxMultiSelect
            label="Collateral"
            allLabel="All collateral"
            value={filters.collateralTypes ?? []}
            onChange={(next) =>
              onFiltersChange({ ...filters, collateralTypes: next.length > 0 ? next : undefined })
            }
            options={availableCollateralTypes.map((type) => ({
              value: type,
              label: type,
              icon: (
                <span className="inline-flex">
                  <svg className="w-5 h-5" aria-hidden="true">
                    <use href={`#icon-${type.toLowerCase().replace("weth", "eth")}`} />
                  </svg>
                  <svg className="w-5 h-5 -ml-2.5" aria-hidden="true">
                    <use href={`#icon-bold`} />
                  </svg>
                </span>
              ),
            }))}
          />
        </div>

        {/* Second row on mobile: Search Input. The relatively-positioned form
            anchors the recent/pinned dropdown when focused-empty. Picking a
            row just fills the input — the existing debounce/filter pipeline
            handles everything else, keeping the search Liquity-scoped. */}
        <form ref={searchRef} onSubmit={handleSearchSubmit} className="relative w-full lg:flex-1">
          <input
            type="text"
            placeholder="Address, ENS, or ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            className="w-full px-4 py-2 pr-10 bg-rb-100 dark:bg-rb-900 h-10 border border-rb-300 dark:border-rb-700 rounded-lg text-foreground placeholder-rb-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            aria-label="Search by wallet address, ENS name, or trove ID"
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
            protocol="liquity-v2"
            onClose={() => setSearchFocused(false)}
            onPick={(address) => {
              setSearchInput(address);
              setSearchFocused(false);
            }}
          />
        </form>
      </div>

      {/* Third row on mobile: Sort controls */}
      <div className="flex items-center gap-1 w-full lg:w-auto">
        <button
          onClick={() => onSortChange?.(sortBy, sortOrder === "asc" ? "desc" : "asc")}
          className="cursor-pointer flex items-center justify-center w-10 h-10 bg-rb-200 dark:bg-rb-900 hover:bg-rb-300 dark:hover:bg-rb-800 rounded-lg transition-colors text-foreground dark:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={sortOrder === "asc" ? "Sort ascending" : "Sort descending"}
        >
          <span aria-hidden="true">{sortOrder === "asc" ? "↑" : "↓"}</span>
        </button>
        <div className="relative h-10 flex-1 lg:flex-initial" ref={sortDropdownRef}>
          <button
            onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
            className="cursor-pointer w-full lg:w-auto flex items-center gap-2 px-4 py-2 bg-rb-200 dark:bg-rb-900 hover:bg-rb-300 dark:hover:bg-rb-800 rounded-lg text-foreground font-medium transition-colors lg:min-w-[160px] dark:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-expanded={isSortDropdownOpen}
            aria-label={`Sort by ${sortOptions.find((o) => o.value === sortBy)?.label || "Sort"}`}
          >
            <span>{sortOptions.find((o) => o.value === sortBy)?.label || "Sort"}</span>
            <ChevronDown
              className={`w-4 h-4 text-rb-500 ml-auto transition-transform ${isSortDropdownOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {isSortDropdownOpen && (
            <div className="absolute top-full left-0 lg:left-auto right-0 mt-2 bg-rb-100 dark:bg-rb-900 border border-rb-300 dark:border-rb-700 rounded-lg shadow-xl z-50 min-w-[200px] overflow-hidden" role="menu">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onSortChange?.(option.value);
                    setIsSortDropdownOpen(false);
                  }}
                  className={`cursor-pointer block w-full text-left px-4 py-3 text-foreground hover:bg-rb-200 dark:hover:bg-rb-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    sortBy === option.value ? "bg-rb-200 dark:bg-rb-800" : ""
                  }`}
                  role="menuitem"
                  aria-label={`Sort by ${option.label}`}
                  aria-current={sortBy === option.value ? "true" : undefined}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
