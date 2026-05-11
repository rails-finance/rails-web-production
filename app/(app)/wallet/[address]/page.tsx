"use client";

// Cross-protocol wallet umbrella. Renders the wallet's positions across every
// protocol the explorer covers, with each protocol's existing per-protocol
// position card. Each card links into the protocol's mono-rail for depth.
//
// The umbrella is the multi-protocol fallback for the search bar: 0 or 2+
// protocols with hits land here (single-protocol wallets are dispatched
// directly to /[protocol]/[wallet] without passing through this page). Direct
// /wallet/[address] URLs also work — useful for bookmarks/sharing.
//
// Slug accepts either a 0x address or an ENS name. ENS resolution leans on
// the API filters (ownerEns / ownerAddress) on each protocol; the page does
// not call viem directly.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TroveSummaryCard } from "@/components/trove/TroveSummaryCard";
import { AaveV4PositionListingCard } from "@/components/aave-v4/AaveV4PositionListingCard";
import { FeedbackButton } from "@/components/FeedbackButton";
import { TroveSummary, TrovesResponse } from "@/types/api/trove";
import type {
  AaveV4SpokePositionRow,
  AaveV4SpokePositionsResponse,
} from "@/lib/api/fetch-aave-v4-spoke-positions";
import { OraclePricesData, OraclePricesResponse } from "@/types/api/oracle";
import { useWalletContext } from "@/components/nav/wallet-context";
import { upsertSession } from "@/lib/shared/sessions";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const LOWER_ADDRESS_RE = /^0x[a-f0-9]{40}$/;

export default function WalletUmbrellaPage() {
  const params = useParams();
  const slug = decodeURIComponent(params.address as string);
  const isAddress = ADDRESS_RE.test(slug);
  const isEns = slug.toLowerCase().endsWith(".eth");
  const validInput = isAddress || isEns;

  const [troves, setTroves] = useState<TroveSummary[]>([]);
  const [aaveRows, setAaveRows] = useState<AaveV4SpokePositionRow[]>([]);
  const [prices, setPrices] = useState<OraclePricesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setWallets } = useWalletContext();

  useEffect(() => {
    if (!validInput) {
      setError("Invalid address or ENS name");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const lowered = slug.toLowerCase();
        const trovesQuery = isAddress
          ? `ownerAddress=${lowered}`
          : `ownerEns=${encodeURIComponent(slug)}`;
        const aaveQuery = isAddress
          ? `wallet=${lowered}`
          : `ownerEns=${encodeURIComponent(slug)}`;

        const [trovesSettled, aaveSettled, pricesSettled] = await Promise.allSettled([
          fetch(`/api/troves?${trovesQuery}&limit=100`),
          fetch(`/api/aave-v4/spoke-positions?${aaveQuery}&limit=100`),
          fetch("/api/oracle/liquity-v2"),
        ]);

        if (cancelled) return;

        if (trovesSettled.status === "fulfilled" && trovesSettled.value.ok) {
          const data = (await trovesSettled.value.json()) as TrovesResponse;
          setTroves(data.data ?? []);
        }
        if (aaveSettled.status === "fulfilled" && aaveSettled.value.ok) {
          const data = (await aaveSettled.value.json()) as AaveV4SpokePositionsResponse;
          setAaveRows(data.rows ?? []);
        }
        if (pricesSettled.status === "fulfilled" && pricesSettled.value.ok) {
          const data = (await pricesSettled.value.json()) as OraclePricesResponse;
          if (data.success && data.data) setPrices(data.data);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load wallet positions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, isAddress, isEns, validInput]);

  // Surface the wallet in the header pill + sessions list. Resolve from
  // returned rows when input was ENS.
  useEffect(() => {
    let resolved: string | null = isAddress ? slug.toLowerCase() : null;
    if (!resolved && troves.length > 0) {
      const o = (troves[0].owner ?? troves[0].lastOwner)?.toLowerCase();
      if (o && LOWER_ADDRESS_RE.test(o)) resolved = o;
    }
    if (!resolved && aaveRows.length > 0) {
      const w = aaveRows[0].wallet?.toLowerCase();
      if (w && LOWER_ADDRESS_RE.test(w)) resolved = w;
    }
    if (!resolved) return;

    const protocols: string[] = [];
    if (troves.length > 0) protocols.push("liquity-v2-troves");
    if (aaveRows.length > 0) protocols.push("aave-v4");

    const ensMap = { [resolved]: isEns ? slug : null };
    setWallets([resolved], ensMap);
    if (protocols.length > 0) {
      upsertSession([resolved], ensMap, protocols);
    }
  }, [isAddress, isEns, slug, troves, aaveRows, setWallets]);

  if (error) {
    return (
      <main className="min-h-screen">
        <FeedbackButton />
        <div className="max-w-7xl mx-auto py-8">
          <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  const totalPositions = troves.length + aaveRows.length;
  const protocolsActive = (troves.length > 0 ? 1 : 0) + (aaveRows.length > 0 ? 1 : 0);

  return (
    <main className="min-h-screen">
      <FeedbackButton />
      <div className="max-w-7xl mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">
            {isEns ? slug : `${slug.slice(0, 6)}…${slug.slice(-4)}`}
          </h1>
          <p className="text-sm text-rb-500 mt-1">
            {loading
              ? "Searching across protocols…"
              : totalPositions === 0
                ? "No positions found across covered protocols."
                : `${totalPositions} position${totalPositions === 1 ? "" : "s"} across ${protocolsActive} protocol${protocolsActive === 1 ? "" : "s"}`}
          </p>
        </div>

        {!loading && totalPositions === 0 && (
          <div className="text-center py-12">
            <div className="text-rb-500">
              <p className="mb-2 text-lg">No positions found</p>
              <p className="text-sm">
                This wallet has no Liquity V2 troves or Aave V4 positions. Check the address, or try a wallet you know is active.
              </p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {troves.length > 0 && (
            <motion.section
              key="liquity"
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="mb-10"
            >
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Liquity V2</h2>
                <Link
                  href={`/liquity-v2/${isAddress ? slug.toLowerCase() : encodeURIComponent(slug)}`}
                  className="text-sm text-blue-500 hover:text-blue-400"
                >
                  View all {troves.length} trove{troves.length === 1 ? "" : "s"} →
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {troves.map((trove) => (
                  <motion.div key={trove.id} variants={itemVariants}>
                    <Link
                      href={`/liquity-v2/trove/${trove.collateralType}/${trove.id}`}
                      className="group/card block w-full text-left rounded-lg transition-all cursor-pointer border border-transparent bg-rb-200/50 dark:bg-rb-900 hover:border-blue-500 px-5 py-4"
                    >
                      <TroveSummaryCard trove={trove} prices={prices ?? undefined} />
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {aaveRows.length > 0 && (
            <motion.section
              key="aave"
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="mb-10"
            >
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Aave V4</h2>
                <Link
                  href={`/aave-v4/${(aaveRows[0].wallet ?? "").toLowerCase()}`}
                  className="text-sm text-blue-500 hover:text-blue-400"
                >
                  View {aaveRows.length} spoke{aaveRows.length === 1 ? "" : "s"} →
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-6">
                {aaveRows.map((row) => (
                  <motion.div key={`${row.wallet}:${row.spoke}`} variants={itemVariants}>
                    <Link
                      href={`/aave-v4/${row.wallet.toLowerCase()}`}
                      className="group/card block w-full text-left rounded-lg transition-all cursor-pointer border border-transparent bg-rb-200/50 dark:bg-rb-900 hover:border-blue-500 px-5 py-4"
                    >
                      <AaveV4PositionListingCard row={row} />
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {loading && totalPositions === 0 && (
          <div className="space-y-6 py-8">
            <div className="bg-rb-100 dark:bg-rb-800 rounded-lg h-32 animate-pulse" />
            <div className="bg-rb-100 dark:bg-rb-800 rounded-lg h-32 animate-pulse" />
          </div>
        )}
      </div>
    </main>
  );
}
