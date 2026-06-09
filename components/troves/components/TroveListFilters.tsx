"use client";

// Liquity V2 list filters — per-section filter dropdowns (Status / Collateral /
// Redemptions / Delegation / Zombies) up top beside the wallet/trove search and
// sort controls, with the active predicates as removable chips in a row beneath.
// The predicates are declared as a dimension registry in
// lib/liquity-v2/list-filter-dimensions and rendered by the shared
// <FilterSections> + <FilterChips>; this component only owns search + sort and
// the collateral token-icon options. Mirrors AaveV4ListFilters.

import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Search, X, ArrowUp, ArrowDown } from "lucide-react";
import { CTRL_GHOST, CTRL_OFF, CTRL_ON } from "@/lib/shared/ui-grammar";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { WalletHistoryDropdown } from "@/components/shared/wallet-history-dropdown";
import { upsertSession } from "@/lib/shared/sessions";
import { FilterSections } from "@/components/shared/filter-bar/filter-sections";
import { FilterChips } from "@/components/shared/filter-bar/filter-chips";
import type { FilterOptionDef } from "@/components/shared/filter-bar/types";
import { troveFilterDimensions } from "@/lib/liquity-v2/list-filter-dimensions";

// Re-export the param shape (moved to list-filter-types so the dimension
// registry can import it without a cycle) for existing callers (the page).
export { type TroveListFilterParams } from "@/lib/liquity-v2/list-filter-types";

import type { TroveListFilterParams } from "@/lib/liquity-v2/list-filter-types";

interface TroveListFiltersProps {
  filters: TroveListFilterParams;
  onFiltersChange: (filters: TroveListFilterParams) => void;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSortChange?: (sortBy: string, sortOrder?: "asc" | "desc") => void;
  availableCollateralTypes?: string[];
}

// Sort options — map UI labels to backend field names.
const SORT_OPTIONS = [
  { value: "lastActivity", label: "Latest Activity" },
  { value: "debt", label: "Debt" },
  { value: "coll", label: "Collateral" },
  { value: "ratio", label: "Ratio" },
  { value: "interestRate", label: "Interest Rate" },
];

export function TroveListFilters({
  filters,
  onFiltersChange,
  sortBy = "lastActivity",
  sortOrder = "desc",
  onSortChange,
  availableCollateralTypes = ["WETH", "wstETH", "rETH"],
}: TroveListFiltersProps) {
  // Initialize with whichever identity filter is set (troveId, address, or ENS).
  const initialSearchValue = filters.troveId || filters.ownerAddress || filters.ownerEns || "";
  const [searchInput, setSearchInput] = useState<string>(initialSearchValue);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearchInput = useDebounce(searchInput, 500);

  // Keep search input in sync with filters from props.
  useEffect(() => {
    const filterValue = filters.troveId || filters.ownerAddress || filters.ownerEns || "";
    setSearchInput(filterValue);
  }, [filters.troveId, filters.ownerAddress, filters.ownerEns]);

  // Trigger search when the debounced value changes.
  useEffect(() => {
    if (!debouncedSearchInput.trim()) {
      if (filters.troveId || filters.ownerAddress || filters.ownerEns) {
        handleClearSearch();
      }
      return;
    }
    handleSearchSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchInput]);

  // Close the sort dropdown on outside click / Escape.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsSortDropdownOpen(false);
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
    const isTroveId = trimmedValue && /^\d+$/.test(trimmedValue);
    const isEns = trimmedValue && trimmedValue.toLowerCase().endsWith(".eth");
    const isAddress = trimmedValue && /^0x[a-fA-F0-9]{40}$/.test(trimmedValue);

    onFiltersChange({
      ...filters,
      troveId: isTroveId ? trimmedValue : undefined,
      ownerAddress: isAddress ? trimmedValue : undefined,
      ownerEns: isEns ? trimmedValue : undefined,
    });
    // Record this wallet in the Liquity V2 recents list. ENS-typed entries
    // aren't recorded here (no resolution yet); they get picked up on the
    // wallet's detail page.
    if (isAddress) {
      const lowered = trimmedValue.toLowerCase();
      upsertSession([lowered], { [lowered]: null }, "liquity-v2");
    }
  };

  const handleClearSearch = () => {
    setSearchInput("");
    onFiltersChange({ ...filters, troveId: undefined, ownerAddress: undefined, ownerEns: undefined });
  };

  // Collateral options carry the token + BOLD overlay icon pair used across the
  // Liquity rail.
  const collateralOptions = useMemo<FilterOptionDef[]>(
    () =>
      availableCollateralTypes.map((type) => ({
        value: type,
        label: type,
        icon: (
          <span className="inline-flex">
            <svg className="w-5 h-5" aria-hidden="true">
              <use href={`#icon-${type.toLowerCase().replace("weth", "eth")}`} />
            </svg>
            <svg className="w-5 h-5 -ml-2.5" aria-hidden="true">
              <use href="#icon-bold" />
            </svg>
          </span>
        ),
      })),
    [availableCollateralTypes],
  );

  const dimensions = useMemo(() => troveFilterDimensions({ collateralOptions }), [collateralOptions]);

  return (
    <div className="mb-6 flex flex-col gap-3">
      {/* Top row: per-section filter dropdowns (preceding the address), then the
          wallet/trove search (primary — the listing doubles as a wallet view)
          and sort. */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <FilterSections dimensions={dimensions} filters={filters} onChange={onFiltersChange} />

        <form ref={searchRef} onSubmit={handleSearchSubmit} className="relative w-full lg:flex-1">
          <input
            type="text"
            placeholder="Address, ENS, or ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            className="w-full px-3 py-2 pr-10 bg-field h-8 border border-rb-300 dark:border-rb-700 rounded-md text-sm text-foreground placeholder-rb-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rb-500 pointer-events-none"
              aria-hidden="true"
            />
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

        <div className="flex items-center gap-1 w-full lg:w-auto">
          <button
            onClick={() => onSortChange?.(sortBy, sortOrder === "asc" ? "desc" : "asc")}
            className={`${CTRL_GHOST} ${CTRL_OFF} w-8 h-8 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-label={sortOrder === "asc" ? "Sort ascending" : "Sort descending"}
          >
            {sortOrder === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>
          <div className="relative h-8 flex-1 lg:flex-initial" ref={sortDropdownRef}>
            <button
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              className={`${CTRL_GHOST} ${isSortDropdownOpen ? CTRL_ON : CTRL_OFF} w-full lg:w-auto gap-2 px-3 h-8 rounded-md text-xs font-medium lg:min-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-500`}
              aria-expanded={isSortDropdownOpen}
              aria-label={`Sort by ${SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Sort"}`}
            >
              <span>{SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Sort"}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-rb-500 ml-auto transition-transform ${isSortDropdownOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            {isSortDropdownOpen && (
              <div
                className="absolute top-full left-0 lg:left-auto right-0 mt-2 z-50 min-w-[200px] overflow-hidden overlay-panel"
                role="menu"
              >
                <div className="flex items-center px-4 py-3">
                  <span className="text-xs uppercase tracking-wider font-bold">Sort</span>
                </div>
                <div className="my-1 mx-3 border-t border-rb-300 dark:border-rb-700" />
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSortChange?.(option.value);
                      setIsSortDropdownOpen(false);
                    }}
                    className={`overlay-item ${
                      sortBy === option.value ? "overlay-item-active" : ""
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
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

      {/* Active predicates as removable chips — renders nothing when none are
          set, so the wallet-view resting state stays quiet. */}
      <FilterChips dimensions={dimensions} filters={filters} onChange={onFiltersChange} />
    </div>
  );
}
