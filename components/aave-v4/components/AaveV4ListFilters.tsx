"use client";

// Aave V4 list filters — a quiet-at-rest predicate FilterBar (+ Filter → chips)
// alongside the wallet search and sort controls. The filter predicates (health,
// debt, liquidations, hubs, spokes, supply/borrow assets, visibility) are
// declared as a dimension registry in lib/aave-v4/list-filter-dimensions and
// rendered by the shared <FilterBar>; this component only owns search + sort and
// the async asset universe that feeds the asset dimensions.

import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Search, X, ArrowUp, ArrowDown } from "lucide-react";
import { CTRL_GHOST, CTRL_OFF, CTRL_ON } from "@/lib/shared/ui-grammar";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { WalletHistoryDropdown } from "@/components/shared/wallet-history-dropdown";
import { upsertSession } from "@/lib/shared/sessions";
import { fetchAaveV4AssetUniverse } from "@/lib/api/fetch-aave-v4-asset-universe";
import { FilterBar } from "@/components/shared/filter-bar/filter-bar";
import type { FilterOptionDef } from "@/components/shared/filter-bar/types";
import { aaveV4FilterDimensions } from "@/lib/aave-v4/list-filter-dimensions";

// Re-export the param shape + visibility helpers (moved to list-filter-types so
// the dimension registry can import them without a cycle) for existing callers.
export {
  type AaveV4ListFilterParams,
  type AaveV4Debt,
  type AaveV4Health,
  type AaveV4Liquidations,
  type AaveV4Show,
  AAVE_V4_DUST_USD,
  aaveV4ShowDefault,
  effectiveAaveV4Show,
} from "@/lib/aave-v4/list-filter-types";

import type { AaveV4ListFilterParams } from "@/lib/aave-v4/list-filter-types";

interface Props {
  filters: AaveV4ListFilterParams;
  onFiltersChange: (next: AaveV4ListFilterParams) => void;
}

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
  // Asset universe — fetched once on mount, drives the Supplying / Borrowing
  // dimension option lists. Empty until the network call returns; the dimensions
  // still render, just with no asset options to pick yet. Failure is non-fatal.
  const [assetUniverse, setAssetUniverse] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchAaveV4AssetUniverse()
      .then((r) => {
        if (cancelled) return;
        setAssetUniverse(r.assets.map((a) => a.symbol));
      })
      .catch(() => {
        // Non-fatal — leave the asset dimensions empty.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

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
    // dropdown next time. ENS-typed entries aren't recorded here (no resolution
    // yet); they'll get picked up when the user drills into a wallet detail page.
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
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSortOpen(false);
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

  // Asset options carry a small token chip; "???" falls through to the unknown
  // placeholder inside TokenChipIcon.
  const assetOptions = useMemo<FilterOptionDef[]>(
    () =>
      assetUniverse.map((symbol) => ({
        value: symbol,
        label: symbol === "???" ? "Unknown" : symbol,
        icon: <TokenChipIcon symbol={symbol} size={18} filterable={false} />,
      })),
    [assetUniverse],
  );

  const dimensions = useMemo(() => aaveV4FilterDimensions({ assetOptions }), [assetOptions]);

  return (
    <div className="mb-6 flex flex-col gap-3">
      {/* Top row: wallet search (primary — the listing doubles as a wallet view)
          and sort. */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div ref={searchRef} className="relative w-full lg:flex-1">
          <input
            type="text"
            placeholder="Address or ENS…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            className="w-full px-3 py-2 pr-10 bg-field h-8 border border-rb-300 dark:border-rb-700 rounded-md text-sm text-foreground placeholder-rb-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                <div className="flex items-center px-4 py-3">
                  <span className="text-xs uppercase tracking-wider font-bold">Sort</span>
                </div>
                <div className="my-1 mx-3 border-t border-rb-300 dark:border-rb-700" />
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

      {/* Predicate bar: quiet `+ Filter` at rest, removable chips when engaged. */}
      <FilterBar dimensions={dimensions} filters={filters} onChange={onFiltersChange} />
    </div>
  );
}
