"use client";

// Liquity V2 wallet view — the protocol's mono-rail wallet page.
//
// Renders the wallet's troves as cards (per §7 of phase-1-inventory: per-
// protocol position layer, no cross-trove aggregation). Each card links to
// the canonical trove detail at /liquity-v2/trove/[c]/[id].
//
// Slug accepts either a 0x address or an ENS name; the API resolves both.
// Aave-parity (aggregated timeline below cards) was rejected as a content
// choice in §7 — Liquity troves are structurally independent positions.

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TroveSummaryCard } from "@/components/trove/TroveSummaryCard";
import { TroveListLoadingSkeleton } from "@/components/troves/components/TroveListLoadingSkeleton";
import { TroveListError } from "@/components/troves/components/TroveListError";
import { FeedbackButton } from "@/components/FeedbackButton";
import { TroveSummary, TrovesResponse } from "@/types/api/trove";
import { OraclePricesData, OraclePricesResponse } from "@/types/api/oracle";
import { useWalletContext } from "@/components/nav/wallet-context";
import { upsertSession } from "@/lib/shared/sessions";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

export default function LiquityWalletPage() {
  const params = useParams();
  const walletSlug = decodeURIComponent(params.wallet as string);
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(walletSlug);
  const isEns = walletSlug.toLowerCase().endsWith(".eth");

  const [troves, setTroves] = useState<TroveSummary[]>([]);
  const [prices, setPrices] = useState<OraclePricesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setWallets } = useWalletContext();

  useEffect(() => {
    if (!isAddress && !isEns) {
      setError("Invalid address or ENS name");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const query = isAddress
          ? `ownerAddress=${walletSlug.toLowerCase()}`
          : `ownerEns=${encodeURIComponent(walletSlug)}`;

        const [trovesRes, pricesRes] = await Promise.all([
          fetch(`/api/troves?${query}&limit=100`),
          fetch("/api/oracle/liquity-v2").catch(() => null),
        ]);

        if (cancelled) return;

        if (!trovesRes.ok) {
          throw new Error(`Failed to load troves: ${trovesRes.statusText}`);
        }

        const trovesData: TrovesResponse = await trovesRes.json();
        setTroves(trovesData.data ?? []);

        if (pricesRes && pricesRes.ok) {
          const pricesData: OraclePricesResponse = await pricesRes.json();
          if (pricesData.success && pricesData.data) {
            setPrices(pricesData.data);
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load wallet troves");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [walletSlug, isAddress, isEns]);

  // Surface the wallet in the header pill + recent list. For ENS the resolved
  // address comes back on the trove rows; fall back to the first trove's
  // owner for that. Mirrors the trove detail page's setWallets pattern.
  useEffect(() => {
    if (isAddress) {
      const lower = walletSlug.toLowerCase();
      setWallets([lower], { [lower]: null });
      upsertSession([lower], { [lower]: null }, ["liquity-v2-troves"]);
      return;
    }
    if (isEns && troves.length > 0) {
      const resolved = (troves[0].owner ?? troves[0].lastOwner)?.toLowerCase();
      if (resolved && /^0x[a-f0-9]{40}$/.test(resolved)) {
        setWallets([resolved], { [resolved]: walletSlug });
        upsertSession([resolved], { [resolved]: walletSlug }, ["liquity-v2-troves"]);
      }
    }
  }, [isAddress, isEns, walletSlug, troves, setWallets]);

  if (loading) return <TroveListLoadingSkeleton />;
  if (error) return <TroveListError message={error} />;

  return (
    <main className="min-h-screen">
      <FeedbackButton />
      <div className="max-w-7xl mx-auto py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">
            {isEns ? walletSlug : `${walletSlug.slice(0, 6)}…${walletSlug.slice(-4)}`}
          </h1>
          <p className="text-sm text-rb-500 mt-1">
            Liquity V2 · {troves.length} trove{troves.length === 1 ? "" : "s"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {troves.length > 0 ? (
            <motion.div
              key="troves"
              className="grid grid-cols-1 gap-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
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
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12"
            >
              <p className="text-foreground text-lg mb-3">
                {isEns ? walletSlug : `${walletSlug.slice(0, 6)}…${walletSlug.slice(-4)}`}{" "}
                has no Liquity V2 positions
              </p>
              <p className="text-sm text-rb-500">
                <Link href="/liquity-v2" className="underline hover:text-foreground transition-colors">
                  Browse the latest Liquity V2 events
                </Link>
                <span className="px-2 text-rb-400">·</span>
                <Link
                  href={`/wallet/${encodeURIComponent(walletSlug)}`}
                  className="underline hover:text-foreground transition-colors"
                >
                  see this wallet across all rails →
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
