"use client";

// Aave V4 cross-hub comparison (/aave-v4/hubs). Protocol-aggregate, read-only:
// the three hubs (Core / Plus / Prime) side by side — size, composition,
// per-asset credit-line utilisation and spoke summary. Distinct from every
// other Aave V4 surface (which is position-level); this is the researcher /
// governance view. Framing: present, don't rank — fixed canonical column order,
// no score, no risk valence. See migration/aave-v4-hub-comparison.md.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { fetchAaveV4Hubs, type AaveV4HubsResponse } from "@/lib/api/fetch-aave-v4-hubs";
import { buildHubViews, hubUnderlyings } from "@/lib/aave-v4/hub-view";
import { AaveV4HubColumn } from "@/components/protocol/aave-v4/aave-v4-hub-column";
import { PricesProvider, usePrices, useRequestPrices } from "@/lib/shared/prices-context";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

function HubsContent() {
  const [data, setData] = useState<AaveV4HubsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAaveV4Hubs()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load hubs");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Enrol every hub asset's price so USD totals + composition resolve.
  useRequestPrices(data ? hubUnderlyings(data) : []);
  const prices = usePrices();

  const views = data ? buildHubViews(data, prices) : [];
  const hasLines = data != null && data.lines.length > 0;

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <header className="mb-6">
          <div className="mb-1 text-[11px] uppercase tracking-wider text-rb-500">
            <Link href="/aave-v4" className="hover:text-foreground">
              Aave V4
            </Link>{" "}
            / Hubs
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Hub comparison</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-rb-500">
            Aave V4 lends through three hubs. Spokes hold collateral and draw liquidity from a hub; a single spoke can
            draw from more than one. Below: each hub&apos;s size, what it&apos;s made of, and how much of each
            asset&apos;s credit line is in use — presented side by side, not ranked.
          </p>
          {data?.updatedAt && (
            <p className="mt-2 text-[11px] text-rb-500">
              Chain snapshot{data.blockNumber ? ` · block ${data.blockNumber.toLocaleString()}` : ""}
            </p>
          )}
        </header>

        {loading && !data ? (
          <div className="py-12 text-center text-rb-500">Loading hubs…</div>
        ) : error ? (
          <div className="py-12 text-center text-rb-500">
            <p className="mb-1">Couldn&apos;t load hub data.</p>
            <p className="text-sm">{error}</p>
          </div>
        ) : !hasLines ? (
          <div className="py-12 text-center text-rb-500">
            <p className="mb-1">Hub data isn&apos;t available yet.</p>
            <p className="text-sm">The credit-line snapshot populates on the next refresh cycle.</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-6 lg:grid-cols-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {views.map((hub) => (
              <motion.div key={hub.hub} variants={itemVariants}>
                <AaveV4HubColumn hub={hub} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </main>
  );
}

export default function AaveV4HubsPage() {
  return (
    <PricesProvider>
      <HubsContent />
    </PricesProvider>
  );
}
