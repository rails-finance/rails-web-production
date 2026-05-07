"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProtocolStats } from "@/types/api/stats";
import { TroveSummary } from "@/types/api/trove";
import { OraclePricesData, OraclePricesResponse } from "@/types/api/oracle";
import { CollateralBreakdown } from "@/components/stats/CollateralBreakdown";
import { TroveListingCard } from "@/components/troves/TroveListingCard";
import { ProtocolSearchBar } from "@/components/shared/protocol-search-bar";

const RECENT_LIMIT = 3;

export default function LiquityV2LandingPage() {
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recent, setRecent] = useState<TroveSummary[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [prices, setPrices] = useState<OraclePricesData | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch("/api/stats");
        const j = await r.json();
        if (!cancelled && j.success && j.data) setStats(j.data);
      } catch (e) {
        console.error("stats fetch failed", e);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    (async () => {
      try {
        const params = new URLSearchParams({
          status: "open",
          sortBy: "lastActivity",
          sortOrder: "desc",
          limit: String(RECENT_LIMIT),
          offset: "0",
        });
        const r = await fetch(`/api/troves?${params}`);
        const j = await r.json();
        if (!cancelled && j.success && Array.isArray(j.data)) setRecent(j.data);
      } catch (e) {
        console.error("recent troves fetch failed", e);
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    })();

    (async () => {
      try {
        const r = await fetch("/api/oracle/liquity-v2");
        if (!r.ok) return;
        const j: OraclePricesResponse = await r.json();
        if (!cancelled && j.success && j.data) setPrices(j.data);
      } catch {
        /* prices are optional */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="py-8 md:py-12 space-y-12">
      {/* ═══ HEADER ═══ */}
      <header className="text-center max-w-2xl mx-auto px-2">
        <div className="flex items-center justify-center gap-3 mb-4">
          <svg className="w-12 h-12" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <use href="#icon-liquity" />
          </svg>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Liquity V2</h1>
        </div>
        <p className="text-rb-700 dark:text-rb-300 text-base md:text-lg leading-relaxed">
          Deposit ETH, wstETH, or rETH as collateral, mint BOLD stablecoins,
          and set your own interest rate.
        </p>
      </header>

      {/* ═══ SEARCH ═══ */}
      <section className="max-w-lg mx-auto w-full px-4 sm:px-0">
        <ProtocolSearchBar />
        <p className="text-[11px] text-rb-500 mt-2.5 text-center font-light">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="inline-block align-[-1px] mr-1"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m4.9 4.9 14.2 14.2" />
          </svg>
          Rails is read-only.
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="inline-block align-[-1px] mx-0.5"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          No wallet connection or login required.
        </p>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-foreground">Protocol stats</h2>
        </div>
        <CollateralBreakdown
          data={stats?.byCollateral || {}}
          mode="overview"
          loading={statsLoading}
        />
      </section>

      {/* ═══ RECENT ACTIVITY ═══ */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recently active troves</h2>
          <Link
            href="/troves"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors"
          >
            View all
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {recentLoading ? (
          <div className="grid grid-cols-1 gap-6">
            {Array.from({ length: RECENT_LIMIT }).map((_, i) => (
              <div
                key={i}
                className="bg-rb-100 dark:bg-rb-900 rounded-xl h-40 animate-pulse"
              />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-10 text-rb-500 text-sm">
            No recent activity.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {recent.map((trove) => (
              <TroveListingCard key={trove.id} trove={trove} prices={prices} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
