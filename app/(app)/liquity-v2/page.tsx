"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TroveSummaryCard } from "@/components/trove/TroveSummaryCard";
import { TroveListFilters, TroveListFilterParams } from "@/components/troves/components/TroveListFilters";
import { TroveSummary } from "@/types/api/trove";
import { PaginationControls } from "@/components/troves/components/PaginationControls";
import { TroveListLoadingSkeleton } from "@/components/troves/components/TroveListLoadingSkeleton";
import { TroveListError } from "@/components/troves/components/TroveListError";
import { OraclePricesData, OraclePricesResponse } from "@/types/api/oracle";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletContext } from "@/components/nav/wallet-context";
import { upsertSession } from "@/lib/shared/sessions";
import {
  ALL_STATUS_BUCKETS,
  canonicalStatuses,
  defaultStatuses,
  effectiveStatuses,
  isAllStatuses,
  sameStatusSet,
  type StatusBucket,
} from "@/lib/liquity-v2/listing-visibility";

// Parse the `status` URL param into a bucket selection. The canonical form is a
// comma-separated list of buckets (active,zombie,closed,liquidated). For inbound
// bookmark stability we also translate the legacy raw form (status=open/closed/
// liquidated + the old showZombie flag) into buckets. Returns undefined when no
// status intent is present so the contextual default applies at read time.
function parseStatusParam(statusRaw: string | null, showZombieRaw: string | null): StatusBucket[] | undefined {
  const tokens = (statusRaw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // Canonical: every token is already a bucket (or explicit "all").
  if (tokens.length > 0 && tokens.every((t) => t === "all" || (ALL_STATUS_BUCKETS as string[]).includes(t))) {
    if (tokens.includes("all")) return [...ALL_STATUS_BUCKETS];
    return canonicalStatuses(tokens);
  }

  // Legacy raw status (+ showZombie) → buckets.
  const z = showZombieRaw?.toLowerCase();
  const buckets = new Set<StatusBucket>();
  const has = (t: string) => tokens.includes(t);
  if (tokens.length === 0) {
    // status absent: a lone legacy showZombie still carries intent.
    if (z === "all") return [...ALL_STATUS_BUCKETS];
    if (z === "true") return canonicalStatuses(["active", "zombie"]);
    if (z === "false") return ["active"];
    return undefined;
  }
  if (has("all")) return [...ALL_STATUS_BUCKETS];
  if (has("open")) {
    if (z === "true") buckets.add("zombie");
    else if (z === "false") buckets.add("active");
    else {
      // open without an explicit zombie flag → both open sub-states (safe superset)
      buckets.add("active");
      buckets.add("zombie");
    }
  }
  if (has("closed")) buckets.add("closed");
  if (has("liquidated")) buckets.add("liquidated");
  const out = canonicalStatuses([...buckets]);
  return out.length > 0 ? out : undefined;
}

// Constants
const ITEMS_PER_PAGE = 20;
const AVAILABLE_COLLATERAL_TYPES = ["WETH", "wstETH", "rETH"];

// Animation variants for staggered list
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // 0.1s delay between each child
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut" as const,
    },
  },
};

function TrovesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // State management
  const [troves, setTroves] = useState<TroveSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [prices, setPrices] = useState<OraclePricesData | null>(null);
  const [dataKey, setDataKey] = useState(() => searchParams.toString());

  // Get page from URL
  const currentPage = Number(searchParams.get("page")) || 1;

  // Parse filters from URL - simple and direct
  const getFiltersFromUrl = (): TroveListFilterParams => {
    const filters: TroveListFilterParams = {};

    const troveId = searchParams.get("troveId");
    if (troveId) filters.troveId = troveId;

    // Carry RAW status intent as a bucket selection. Absence stays undefined so
    // the contextual default (active on the bare directory, everything on a
    // scoped query) is applied at use via effectiveStatuses(). The canonical URL
    // form is `status=active,zombie,...`; the legacy raw form (status=open +
    // showZombie) is translated for bookmark stability. See lib/liquity-v2/
    // listing-visibility.ts.
    const statuses = parseStatusParam(searchParams.get("status"), searchParams.get("showZombie"));
    if (statuses) filters.statuses = statuses;

    // collateralTypes (multi) is the canonical form; honor the legacy
    // collateralType (single) for old links.
    const collateralTypesRaw = searchParams.get("collateralTypes");
    if (collateralTypesRaw) {
      const parts = collateralTypesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 0) filters.collateralTypes = parts;
    } else {
      const collateralType = searchParams.get("collateralType");
      if (collateralType) filters.collateralTypes = [collateralType];
    }

    const ownerAddress = searchParams.get("ownerAddress");
    const ownerEns = searchParams.get("ownerEns");
    if (ownerAddress) {
      filters.ownerAddress = ownerAddress;
    }
    if (ownerEns) {
      filters.ownerEns = ownerEns;
    }

    const activeWithin = searchParams.get("activeWithin");
    if (activeWithin) filters.activeWithin = activeWithin;

    const createdWithin = searchParams.get("createdWithin");
    if (createdWithin) filters.createdWithin = createdWithin;

    // Parse boolean parameters
    const batchOnlyParam = searchParams.get("batchOnly");
    if (batchOnlyParam === "true") filters.batchOnly = true;

    const individualOnlyParam = searchParams.get("individualOnly");
    if (individualOnlyParam === "true") filters.individualOnly = true;

    // Handle hasRedemptions with true/false values
    const hasRedemptionsParam = searchParams.get("hasRedemptions");
    if (hasRedemptionsParam === "true") filters.hasRedemptions = true;
    if (hasRedemptionsParam === "false") filters.hasRedemptions = false;

    const sortBy = searchParams.get("sortBy");
    if (sortBy) filters.sortBy = sortBy;

    const sortOrder = searchParams.get("sortOrder");
    if (sortOrder === "asc" || sortOrder === "desc") filters.sortOrder = sortOrder;

    return filters;
  };

  const filters = getFiltersFromUrl();

  // When the troves page is being used as a wallet view (filter set via the
  // WalletMenu pin/recent links), surface the address in the header pill and
  // record the visit. Mirrors what the trove detail page does — the troves
  // page is the de-facto `/address/<addr>` until a dedicated route exists.
  const { setWallets } = useWalletContext();
  useEffect(() => {
    if (!filters.ownerAddress) return;
    const lower = filters.ownerAddress.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(lower)) return;
    setWallets([lower], { [lower]: null });
    upsertSession([lower], { [lower]: null }, "liquity-v2");
  }, [filters.ownerAddress, setWallets]);

  // ENS wallet view: forward-resolve the name to an address so the header
  // pill and recents reflect the wallet (the /api/troves proxy resolves
  // independently for the listing query itself). Skip when an explicit
  // address is present — that branch above already handles it.
  useEffect(() => {
    const ens = filters.ownerEns;
    if (filters.ownerAddress || !ens) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ens/resolve?name=${encodeURIComponent(ens)}`);
        if (!res.ok) return;
        const { address } = (await res.json()) as { address: string | null };
        if (cancelled || !address) return;
        const lower = address.toLowerCase();
        setWallets([lower], { [lower]: ens });
        upsertSession([lower], { [lower]: ens }, "liquity-v2");
      } catch {
        /* resolution is best-effort — the listing still loads via the proxy */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.ownerEns, filters.ownerAddress, setWallets]);

  // Helper to build URL search params from filters
  const buildSearchParams = (filterParams: TroveListFilterParams, page?: number, includePageAndLimit?: boolean) => {
    const params = new URLSearchParams();
    const forApi = Boolean(includePageAndLimit);

    // Add pagination if requested
    if (includePageAndLimit) {
      params.set("limit", ITEMS_PER_PAGE.toString());
      // For API calls, we need to calculate offset from the page number
      params.set("offset", (((page || currentPage) - 1) * ITEMS_PER_PAGE).toString());
    } else if (page && page > 1) {
      // For URL updates, only include page if > 1
      params.set("page", page.toString());
    }

    // Add filters
    if (filterParams.troveId) params.set("troveId", filterParams.troveId);

    // Status (multi-select buckets). The same builder feeds both the shareable
    // URL (forApi=false) and the /api/troves request (forApi=true):
    //   - URL: write the comma-separated buckets only when the selection differs
    //     from the contextual default, so directory + wallet-view URLs stay clean
    //     and the absence of the param is what drives auto-relax on the next read.
    //   - API: send the resolved bucket selection; the full set ("everything")
    //     is sent as no `status` param, which the backend reads as no filter.
    if (forApi) {
      if (!isAllStatuses(filterParams)) {
        params.set("status", effectiveStatuses(filterParams).join(","));
      }
    } else {
      const eff = effectiveStatuses(filterParams);
      if (!sameStatusSet(eff, defaultStatuses(filterParams))) {
        params.set("status", eff.join(","));
      }
    }

    if (filterParams.collateralTypes && filterParams.collateralTypes.length > 0) {
      params.set("collateralTypes", filterParams.collateralTypes.join(","));
    }
    if (filterParams.ownerAddress) params.set("ownerAddress", filterParams.ownerAddress);
    if (filterParams.ownerEns) params.set("ownerEns", filterParams.ownerEns);
    if (filterParams.activeWithin) params.set("activeWithin", filterParams.activeWithin);
    if (filterParams.createdWithin) params.set("createdWithin", filterParams.createdWithin);
    if (filterParams.batchOnly) params.set("batchOnly", "true");
    if (filterParams.individualOnly) params.set("individualOnly", "true");
    if (filterParams.hasRedemptions !== undefined) {
      params.set("hasRedemptions", String(filterParams.hasRedemptions));
    }
    if (filterParams.sortBy) params.set("sortBy", filterParams.sortBy);
    if (filterParams.sortOrder) params.set("sortOrder", filterParams.sortOrder);

    return params;
  };

  // Update URL when filters change - simple push to let page reload
  const updateUrl = (newFilters?: TroveListFilterParams, newPage?: number) => {
    const appliedFilters = newFilters || filters;
    const page = newPage || currentPage;
    const params = buildSearchParams(appliedFilters, page);
    // URLSearchParams over-encodes commas as %2C; a comma is a legal query
    // sub-delimiter (RFC 3986), so un-encode it for readable list params
    // (status=active,zombie,liquidated). API requests don't go through here.
    const qs = params.toString().replace(/%2C/gi, ",");
    const url = qs ? `/liquity-v2?${qs}` : "/liquity-v2";
    router.push(url);
  };

  const goToPage = (page: number) => {
    updateUrl(filters, page);
  };

  const handleFiltersChange = (newFilters: TroveListFilterParams) => {
    updateUrl(newFilters, 1); // Reset to page 1 when filters change
  };

  const handleSortChange = (newSortBy: string, newSortOrder?: "asc" | "desc") => {
    const updatedFilters = {
      ...filters,
      sortBy: newSortBy,
      sortOrder: newSortOrder || filters.sortOrder || "desc",
    };
    updateUrl(updatedFilters, currentPage);
  };

  // Load oracle prices - one-time fetch
  const loadPrices = async () => {
    try {
      const response = await fetch("/api/oracle/liquity-v2");
      if (response.ok) {
        const data: OraclePricesResponse = await response.json();
        if (data.success && data.data) {
          setPrices(data.data);
        }
      }
    } catch (err) {
      console.error("Error loading oracle prices:", err);
      // Silently fail - prices are optional enhancement
    }
  };

  // Load troves - simple single API call based on URL params
  const loadTroves = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = buildSearchParams(filters, currentPage, true);
      const response = await fetch(`/api/troves?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch troves: ${response.statusText}`);
      }

      const data = await response.json();
      setTroves(data.data || []);
      if (data.pagination) {
        setTotalCount(data.pagination.total || 0);
      }
      setDataKey(searchParams.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load troves");
      console.error("Error loading troves:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load prices once on mount
  useEffect(() => {
    loadPrices();
  }, []);

  // Load troves when URL changes (filters or pagination)
  useEffect(() => {
    loadTroves();
  }, [currentPage, searchParams]); // React to URL changes

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  if (loading && troves.length === 0) {
    return <TroveListLoadingSkeleton />;
  }

  if (error) {
    return <TroveListError message={error} />;
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto py-8">
        {/* Filters */}
        <TroveListFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          sortBy={filters.sortBy || "lastActivity"}
          sortOrder={filters.sortOrder || "desc"}
          onSortChange={handleSortChange}
          availableCollateralTypes={AVAILABLE_COLLATERAL_TYPES}
        />

        {/* Troves */}
        <AnimatePresence mode="wait">
          {troves.length > 0 ? (
            <motion.div
              key={dataKey}
              className={`grid grid-cols-1 gap-6 ${loading ? "pointer-events-none" : ""}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {troves.map((trove) => (
                <motion.div key={trove.id} variants={itemVariants}>
                  <Link
                    href={`/liquity-v2/trove/${trove.collateralType}/${trove.id}`}
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        sessionStorage.setItem("troves-scroll-position", String(window.scrollY));
                      }
                    }}
                    className="group/card block w-full text-left rounded-lg transition-all cursor-pointer border border-transparent bg-raised hover:border-blue-500 px-5 py-4"
                  >
                    <TroveSummaryCard trove={trove} prices={prices ?? undefined} compact />
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <div className="text-rb-500 text-lg">
                <p className="mb-2">No troves found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={goToPage}
        />
      </div>
    </main>
  );
}

export default function TrovesPage() {
  return (
    <Suspense fallback={<TroveListLoadingSkeleton />}>
      <TrovesPageContent />
    </Suspense>
  );
}
