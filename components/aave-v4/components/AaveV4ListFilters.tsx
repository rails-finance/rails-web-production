"use client";

// Aave V4 list filters — per-section filter dropdowns (Risk / Market / Assets /
// View) up top beside the wallet search and sort controls, with the active
// predicates as removable chips in a row beneath. The filter predicates (health,
// debt, liquidations, hubs, spokes, supply/borrow assets, visibility) are
// declared as a dimension registry in lib/aave-v4/list-filter-dimensions and
// rendered by the shared <FilterSections> + <FilterChips>; this component only
// owns search + sort and the async asset universe that feeds the asset
// dimensions.

import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Search, X, ArrowUp, ArrowDown } from "lucide-react";
import { CTRL_GHOST, CTRL_OFF, CTRL_ON, OVERLAY_HEADING } from "@/lib/shared/ui-grammar";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { WalletHistoryDropdown } from "@/components/shared/wallet-history-dropdown";
import { upsertSession } from "@/lib/shared/sessions";
import { fetchAaveV4AssetUniverse, type AaveV4AssetUniverseEntry } from "@/lib/api/fetch-aave-v4-asset-universe";
import { FilterSections } from "@/components/shared/filter-bar/filter-sections";
import { FilterChips } from "@/components/shared/filter-bar/filter-chips";
import type { FilterOptionDef } from "@/components/shared/filter-bar/types";
import { aaveV4FilterDimensions, spokeOptionsForHubs } from "@/lib/aave-v4/list-filter-dimensions";

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
  // Asset universe — drives the Supplying / Borrowing dimension option lists.
  // Refetched whenever the selected market (spokes/hubs) changes: with a market
  // selected the response carries config-truthful canSupply/canBorrow so the
  // pills can hide assets that market doesn't offer; unscoped it's the global
  // empirical list. Empty until the network call returns; failure is non-fatal.
  const [assetUniverse, setAssetUniverse] = useState<AaveV4AssetUniverseEntry[]>([]);
  // Stable primitive deps so the effect only refires on actual market changes,
  // not on every parent re-render handing us a fresh array identity.
  const spokesKey = filters.spokes.join(",");
  const hubsKey = filters.hubs.join(",");

  useEffect(() => {
    let cancelled = false;
    const spokes = spokesKey ? spokesKey.split(",") : [];
    const hubs = hubsKey ? hubsKey.split(",") : [];
    fetchAaveV4AssetUniverse({ spokes, hubs })
      .then((r) => {
        if (cancelled) return;
        setAssetUniverse(r.assets);
      })
      .catch(() => {
        // Non-fatal — leave the asset dimensions empty.
      });
    return () => {
      cancelled = true;
    };
  }, [spokesKey, hubsKey]);

  // Prune downward: once the (market-scoped) universe loads, drop any selected
  // supply/borrow asset that no longer has positions on that side in scope —
  // it's now absent from its own dropdown (we only list assets with positions),
  // so without this it'd be an invisible active predicate guaranteeing zero
  // results with no way to clear it but the chip. Mirrors the hub→spoke
  // pruning, completing the Hub ⊃ Spoke ⊃ Asset scope flow. Guard on a loaded
  // universe so an empty pre-fetch state can't wipe URL-provided selections;
  // keyed on universe change so toggling an asset within a valid scope can't loop.
  useEffect(() => {
    if (assetUniverse.length === 0) return;
    const supplyAvail = new Set(assetUniverse.filter((e) => e.asSupply).map((e) => e.symbol));
    const borrowAvail = new Set(assetUniverse.filter((e) => e.asDebt).map((e) => e.symbol));
    const nextSupply = filters.supplyAssets.filter((s) => supplyAvail.has(s));
    const nextBorrow = filters.borrowAssets.filter((s) => borrowAvail.has(s));
    if (nextSupply.length !== filters.supplyAssets.length || nextBorrow.length !== filters.borrowAssets.length) {
      onFiltersChange({ ...filters, supplyAssets: nextSupply, borrowAssets: nextBorrow });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetUniverse]);

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
  // placeholder inside TokenChipIcon. A filter exists to narrow positions that
  // exist, so each side lists exactly the assets that actually HAVE positions
  // on that side in the current scope (asSupply / asDebt, market-scoped by the
  // fetch above). Assets with no positions are omitted — selecting one is
  // guaranteed zero results (the empirical flag and the server-side position
  // filter read the same MV balances), so offering it would be a dead choice.
  // Note this is empirical, not protocol-config: a frozen reserve that still
  // holds existing debt correctly stays filterable.
  const { supplyOptions, borrowOptions } = useMemo(() => {
    const toOption = (e: AaveV4AssetUniverseEntry): FilterOptionDef => ({
      value: e.symbol,
      label: e.symbol === "???" ? "Unknown" : e.symbol,
      icon: <TokenChipIcon symbol={e.symbol} size={18} filterable={false} />,
    });
    return {
      supplyOptions: assetUniverse.filter((e) => e.asSupply).map(toOption),
      borrowOptions: assetUniverse.filter((e) => e.asDebt).map(toOption),
    };
  }, [assetUniverse]);

  // Spoke options narrow to the selected hub(s) — the hub→spoke layer of the
  // same parent-scopes-child logic the asset pills use.
  const spokeOptions = useMemo(() => spokeOptionsForHubs(hubsKey ? hubsKey.split(",") : []), [hubsKey]);

  const dimensions = useMemo(
    () => aaveV4FilterDimensions({ supplyOptions, borrowOptions, spokeOptions }),
    [supplyOptions, borrowOptions, spokeOptions],
  );

  return (
    <div className="mb-6 flex flex-col gap-3">
      {/* Top row: per-section filter dropdowns (preceding the address), then the
          wallet search (primary — the listing doubles as a wallet view) and sort. */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <FilterSections dimensions={dimensions} filters={filters} onChange={onFiltersChange} />
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
                  <span className={OVERLAY_HEADING}>Sort</span>
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

      {/* Active predicates as removable chips — renders nothing when none are
          set, so the wallet-view resting state stays quiet. */}
      <FilterChips dimensions={dimensions} filters={filters} onChange={onFiltersChange} />
    </div>
  );
}
