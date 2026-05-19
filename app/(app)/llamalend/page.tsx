"use client";

// LlamaLend discovery — markets feed.
//
// Two-family list (LlamaLend lend + crvUSD mint) backed by /api/llamalend/
// markets (Phase 5, B4 — aggregates over llamalend_markets ⨝
// mv_llamalend_positions). Each row is a market summary, not a per-wallet
// position; the wallet search in the header still routes individual wallet
// jumps to /llamalend/[wallet]. Motion-staggered entry matches /aave-v4 and
// /liquity-v2 chrome.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { fetchLlamalendMarkets, type LlamalendMarket } from "@/lib/api/fetch-llamalend";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { formatNum } from "@/lib/shared/format-event";

type FamilyFilter = "all" | "lend" | "mint";
type SortKey = "debt" | "collateral" | "positions";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

const SORT_LABEL: Record<SortKey, string> = {
  debt: "Total Debt",
  collateral: "Total Collateral",
  positions: "Open Positions",
};

const FAMILY_LABEL: Record<FamilyFilter, string> = {
  all: "All",
  lend: "Lend",
  mint: "crvUSD Mint",
};

function MarketCard({ market }: { market: LlamalendMarket }) {
  const familyLabel = market.family === "mint" ? "crvUSD mint" : "LlamaLend lend";
  return (
    <div className="rounded-lg border border-transparent bg-rb-200/50 dark:bg-rb-900 px-5 py-4 transition-colors">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <TokenChipIcon symbol={market.collateralSymbol} size={20} />
          <span className="font-semibold">{market.collateralSymbol}</span>
          <span className="text-rb-500">/</span>
          <TokenChipIcon symbol={market.borrowedSymbol} size={20} />
          <span className="font-semibold">{market.borrowedSymbol}</span>
          <span className="ml-2 inline-flex items-center rounded-full bg-rb-300/60 dark:bg-rb-800/60 px-2 py-0.5 text-xs text-rb-500">
            {familyLabel}
          </span>
        </div>
        <span className="font-mono text-xs text-rb-500">{market.controller.slice(0, 10)}…{market.controller.slice(-4)}</span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wider text-rb-500">Open Positions</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{market.openPositions.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-rb-500">Total Collateral</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatNum(market.totalCollateral, 2)}{" "}
            <span className="text-rb-500">{market.collateralSymbol}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-rb-500">Total Debt</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {formatNum(market.totalDebt, 0)}{" "}
            <span className="text-rb-500">{market.borrowedSymbol}</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function LlamalendDiscoveryPage() {
  const [markets, setMarkets] = useState<LlamalendMarket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<FamilyFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("debt");

  useEffect(() => {
    let cancelled = false;
    fetchLlamalendMarkets()
      .then((r) => {
        if (!cancelled) setMarkets(r.markets);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!markets) return null;
    const subset = family === "all" ? markets : markets.filter((m) => m.family === family);
    const sorted = [...subset].sort((a, b) => {
      if (sortKey === "debt") return b.totalDebt - a.totalDebt;
      if (sortKey === "collateral") return b.totalCollateral - a.totalCollateral;
      return b.openPositions - a.openPositions;
    });
    return sorted;
  }, [markets, family, sortKey]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-foreground">
      <header className="mb-6">
        <Link href="/" className="text-xs text-rb-text-500 hover:text-foreground">
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Curve LlamaLend</h1>
        <p className="mt-2 max-w-2xl text-sm text-rb-text-500">
          Band-based CDP markets across two families — LlamaLend lend markets
          and crvUSD mint markets — with continuous monetary-policy interest
          and soft liquidation via LLAMMA.
        </p>
      </header>

      {/* Filter strip — family on the left, sort on the right. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md bg-rb-200/50 dark:bg-rb-900 p-0.5 text-sm">
          {(Object.keys(FAMILY_LABEL) as FamilyFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFamily(f)}
              className={`rounded px-3 py-1 transition-colors ${
                family === f
                  ? "bg-rb-300/80 dark:bg-rb-800 text-foreground"
                  : "text-rb-500 hover:text-foreground"
              }`}
            >
              {FAMILY_LABEL[f]}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-rb-500">
          <span>Sort by</span>
          <div className="inline-flex rounded-md bg-rb-200/50 dark:bg-rb-900 p-0.5">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSortKey(k)}
                className={`rounded px-3 py-1 transition-colors ${
                  sortKey === k
                    ? "bg-rb-300/80 dark:bg-rb-800 text-foreground"
                    : "text-rb-500 hover:text-foreground"
                }`}
              >
                {SORT_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Failed to load markets: {error}
        </div>
      ) : filtered === null ? (
        <div className="text-sm text-rb-text-500">Loading markets…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded border border-rb-text-100/10 bg-rb-bg-100/40 p-6 text-sm text-rb-text-500">
          No markets match this filter.
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${family}:${sortKey}`}
            className="grid grid-cols-1 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {filtered.map((m) => (
              <motion.div key={m.controller} variants={itemVariants}>
                <MarketCard market={m} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      <p className="mt-8 text-xs text-rb-500">
        Looking for a specific wallet? Use the wallet search in the header — any
        address with LlamaLend activity routes to its full timeline.
      </p>
    </main>
  );
}
