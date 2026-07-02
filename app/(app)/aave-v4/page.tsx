"use client";

// Aave V4 landing — visual analog of /liquity-v2. Discovery list of every
// (wallet, spoke) open position from mv_aave_v4_spoke_positions, filtered
// by spoke / debt / health with motion-staggered entry and Liquity-styled
// position cards. Direct wallet jump still works via the search input.

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AaveV4PositionListingCard } from "@/components/aave-v4/AaveV4PositionListingCard";
import {
  AaveV4ListFilters,
  type AaveV4ListFilterParams,
  type AaveV4Debt,
  type AaveV4Health,
  type AaveV4Liquidations,
  AAVE_V4_DUST_USD,
  effectiveAaveV4Show,
} from "@/components/aave-v4/components/AaveV4ListFilters";
import {
  bucketsToWireStatuses,
  canonicalStatuses,
  defaultStatuses,
  effectiveStatuses,
  sameStatusSet,
} from "@/lib/aave-v4/listing-visibility";
import { AaveV4PaginationControls } from "@/components/aave-v4/components/AaveV4PaginationControls";
import { AaveV4ListLoadingSkeleton } from "@/components/aave-v4/components/AaveV4ListLoadingSkeleton";
import { AaveV4ListError } from "@/components/aave-v4/components/AaveV4ListError";
import {
  fetchAaveV4SpokePositions,
  type AaveV4SpokePositionRow,
  type AaveV4SpokePositionSort,
} from "@/lib/api/fetch-aave-v4-spoke-positions";
import { slugifySpoke } from "@/lib/aave-v4/spoke-meta";
import { useWalletContext } from "@/components/nav/wallet-context";
import { upsertSession } from "@/lib/shared/sessions";

const ITEMS_PER_PAGE = 20;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

function AaveV4ListPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters: AaveV4ListFilterParams = {
    wallet: searchParams.get("wallet") ?? undefined,
    ownerEns: searchParams.get("ownerEns") ?? undefined,
    spokes: (searchParams.get("spokes") ?? "").split(",").filter(Boolean),
    hubs: (searchParams.get("hubs") ?? "").split(",").filter(Boolean),
    supplyAssets: (searchParams.get("supplyAssets") ?? "").split(",").filter(Boolean),
    borrowAssets: (searchParams.get("borrowAssets") ?? "").split(",").filter(Boolean),
    debt: (searchParams.get("debt") as AaveV4Debt | null) ?? "all",
    health: (searchParams.get("health") as AaveV4Health | null) ?? "all",
    liquidations: (searchParams.get("liquidations") as AaveV4Liquidations | null) ?? "all",
    // Lifecycle status buckets. Absent → undefined → the full-set default
    // (everything, resolved at read time); a comma-separated subset is an
    // explicit narrowing. Garbage tokens or the full set reduce to undefined so
    // the default is never baked into the filter object.
    statuses: (() => {
      const raw = searchParams.get("status");
      if (!raw) return undefined;
      const sel = canonicalStatuses(raw.split(","));
      return sel.length === 0 || sameStatusSet(sel, defaultStatuses()) ? undefined : sel;
    })(),
    // Dust visibility — undefined = default ("all"); only "nodust" is carried, so
    // a stale `show=active` bookmark (pre-taxonomy) degrades to the default
    // rather than being cast to an invalid tier.
    show: searchParams.get("show") === "nodust" ? "nodust" : undefined,
    sortBy: searchParams.get("sortBy") ?? "lastActivity",
    sortOrder: (searchParams.get("sortOrder") as "asc" | "desc" | null) ?? "desc",
  };

  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);

  // Wallet view: surface the searched wallet in the header pill + this rail's
  // recents. A plain address goes straight in; an ENS name is forward-resolved
  // via /api/ens/resolve (the spoke-positions proxy resolves independently for
  // the listing query itself).
  const { setWallets } = useWalletContext();
  useEffect(() => {
    const wallet = filters.wallet?.toLowerCase();
    if (wallet && /^0x[a-f0-9]{40}$/.test(wallet)) {
      setWallets([wallet], { [wallet]: null });
      upsertSession([wallet], { [wallet]: null }, "aave-v4");
      return;
    }
    const ens = filters.ownerEns;
    if (!ens) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ens/resolve?name=${encodeURIComponent(ens)}`);
        if (!res.ok) return;
        const { address } = (await res.json()) as { address: string | null };
        if (cancelled || !address) return;
        const lower = address.toLowerCase();
        setWallets([lower], { [lower]: ens });
        upsertSession([lower], { [lower]: ens }, "aave-v4");
      } catch {
        /* resolution is best-effort — the listing still loads via the proxy */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.wallet, filters.ownerEns, setWallets]);

  const [rows, setRows] = useState<AaveV4SpokePositionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataKey, setDataKey] = useState(() => searchParams.toString());

  const buildSearchParams = (next: AaveV4ListFilterParams, page: number) => {
    const p = new URLSearchParams();
    if (next.wallet) p.set("wallet", next.wallet);
    if (next.ownerEns) p.set("ownerEns", next.ownerEns);
    if (next.spokes.length > 0) p.set("spokes", next.spokes.join(","));
    if (next.hubs.length > 0) p.set("hubs", next.hubs.join(","));
    if (next.supplyAssets.length > 0) p.set("supplyAssets", next.supplyAssets.join(","));
    if (next.borrowAssets.length > 0) p.set("borrowAssets", next.borrowAssets.join(","));
    // Lifecycle status: write only a genuine subset. The full set (or an absent
    // selection) is the default "show everything" — emit no `status=` param so
    // directory + wallet-view URLs stay clean and clearing resolves back to all.
    {
      const sel = canonicalStatuses(next.statuses ?? []);
      if (sel.length > 0 && !sameStatusSet(sel, defaultStatuses())) p.set("status", sel.join(","));
    }
    // Dust: only "nodust" is a non-default state; "all" is the default so it's
    // never written, keeping directory + wallet-view URLs clean.
    if (next.show === "nodust") p.set("show", next.show);
    if (next.debt !== "all") p.set("debt", next.debt);
    if (next.health !== "all") p.set("health", next.health);
    if (next.liquidations !== "all") p.set("liquidations", next.liquidations);
    if (next.sortBy !== "lastActivity") p.set("sortBy", next.sortBy);
    if (next.sortOrder !== "desc") p.set("sortOrder", next.sortOrder);
    if (page > 1) p.set("page", String(page));
    return p;
  };

  const updateUrl = (next: AaveV4ListFilterParams, page: number) => {
    const p = buildSearchParams(next, page);
    // URLSearchParams over-encodes commas as %2C; a comma is a legal query
    // sub-delimiter (RFC 3986), so un-encode it for readable list params
    // (spokes=core,plus). API requests don't go through here.
    const qs = p.toString().replace(/%2C/gi, ",");
    const url = qs ? `/aave-v4?${qs}` : "/aave-v4";
    router.push(url);
  };

  const handleFiltersChange = (next: AaveV4ListFilterParams) => {
    updateUrl(next, 1);
  };

  const goToPage = (page: number) => {
    updateUrl(filters, page);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAaveV4SpokePositions({
      wallet: filters.wallet,
      ownerEns: filters.ownerEns,
      spokes: filters.spokes,
      hubs: filters.hubs,
      supplyAssets: filters.supplyAssets,
      borrowAssets: filters.borrowAssets,
      hasDebt: filters.debt === "withDebt",
      noDebt: filters.debt === "noDebt",
      hasLiquidations: filters.liquidations === "with" ? true : filters.liquidations === "without" ? false : undefined,
      healthBelow: filters.health === "underwater" ? 1.0 : undefined,
      // Dust → server floor. "nodust" hides positions under the dust line; the
      // open/closed axis is the `status` filter below, not a USD cut.
      minTotalUsd: effectiveAaveV4Show(filters) === "nodust" ? AAVE_V4_DUST_USD : undefined,
      // Lifecycle status (server migration 034) — map the structural buckets
      // (open / closed) onto the wire statuses. "closed" expands to closed +
      // liquidated; the default is the full set, which the server returns in full
      // (bucketsToWireStatuses of ["open","closed"] → all three wire statuses).
      status: bucketsToWireStatuses(effectiveStatuses(filters)),
      sortBy: filters.sortBy as AaveV4SpokePositionSort,
      sortOrder: filters.sortOrder,
      limit: ITEMS_PER_PAGE,
      offset: (currentPage - 1) * ITEMS_PER_PAGE,
    })
      .then((r) => {
        if (cancelled) return;
        setRows(r.rows);
        setTotal(r.total);
        setDataKey(searchParams.toString());
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  if (loading && rows.length === 0 && !error) {
    return <AaveV4ListLoadingSkeleton />;
  }

  if (error) {
    return <AaveV4ListError message={error} />;
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto py-8">
        <AaveV4ListFilters filters={filters} onFiltersChange={handleFiltersChange} />

        <AnimatePresence mode="wait">
          {rows.length > 0 ? (
            <motion.div
              key={dataKey}
              className={`grid grid-cols-1 gap-6 ${loading ? "pointer-events-none" : ""}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {rows.map((row) => (
                <motion.div key={`${row.wallet}:${row.spoke}`} variants={itemVariants}>
                  <Link
                    href={`/aave-v4/spoke/${slugifySpoke(row.spokeName) ?? encodeURIComponent(row.spokeName)}/${row.wallet}`}
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        sessionStorage.setItem("aave-v4-scroll-position", String(window.scrollY));
                      }
                    }}
                    className="group/card block w-full text-left rounded-lg transition-all cursor-pointer border border-transparent bg-raised hover:border-blue-500 px-5 py-4"
                  >
                    <AaveV4PositionListingCard row={row} />
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
                <p className="mb-2">No positions found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AaveV4PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={total}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={goToPage}
        />
      </div>
    </main>
  );
}

export default function AaveV4LandingPage() {
  return (
    <Suspense fallback={<AaveV4ListLoadingSkeleton />}>
      <AaveV4ListPageContent />
    </Suspense>
  );
}
