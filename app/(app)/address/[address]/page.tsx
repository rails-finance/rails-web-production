"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TroveSummary, TrovesResponse } from "@/types/api/trove";
import { OraclePricesData, OraclePricesResponse } from "@/types/api/oracle";
import { AddressTroveSection } from "@/components/address/AddressTroveSection";
import { FeedbackButton } from "@/components/FeedbackButton";

export default function AddressPage() {
  const params = useParams();
  const raw = decodeURIComponent(params.address as string);
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(raw);
  const isEns = raw.toLowerCase().endsWith(".eth");

  const [troves, setTroves] = useState<TroveSummary[]>([]);
  const [prices, setPrices] = useState<OraclePricesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isAddress && !isEns) {
      setError("Invalid address — expected 0x… (40 hex chars) or an ENS name ending in .eth");
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (isAddress) params.set("ownerAddress", raw);
    if (isEns) params.set("ownerEns", raw);
    params.set("status", "all");

    Promise.all([
      fetch(`/api/troves?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch troves: ${r.statusText}`);
        return r.json() as Promise<TrovesResponse>;
      }),
      fetch("/api/oracle/liquity-v2")
        .then((r) => (r.ok ? (r.json() as Promise<OraclePricesResponse>) : null))
        .catch(() => null),
    ])
      .then(([trovesResp, pricesResp]) => {
        if (cancelled) return;
        setTroves(trovesResp.data ?? []);
        if (pricesResp?.success && pricesResp.data) setPrices(pricesResp.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [raw, isAddress, isEns]);

  // Display label: ENS preferred, else short address
  const ensFromTroves = troves.find((t) => t.ownerEns)?.ownerEns ?? null;
  const displayLabel = isEns
    ? raw
    : ensFromTroves ?? `${raw.slice(0, 6)}…${raw.slice(-4)}`;
  const showAddressUnderEns = isEns ? null : isAddress ? raw : null;

  return (
    <>
      <FeedbackButton />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Link
          href="/troves"
          className="inline-flex items-center gap-1 text-sm text-rb-500 hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to troves
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground break-all">{displayLabel}</h1>
          {showAddressUnderEns && (
            <p className="mt-1 text-xs text-rb-500 font-mono break-all">{showAddressUnderEns}</p>
          )}
          {!loading && !error && (
            <p className="mt-2 text-sm text-rb-500">
              {troves.length === 0
                ? "No Liquity V2 troves found for this address"
                : `${troves.length} ${troves.length === 1 ? "trove" : "troves"}`}
            </p>
          )}
        </header>

        {loading && (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-40 bg-rb-200 dark:bg-rb-800 rounded-xl animate-pulse" />
                <div className="space-y-2 pl-4">
                  <div className="h-16 bg-rb-200/75 dark:bg-rb-800/75 rounded-lg animate-pulse" />
                  <div className="h-16 bg-rb-200/50 dark:bg-rb-800/50 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && troves.length === 0 && (
          <div className="text-center py-12">
            <p className="text-rb-500">
              No troves owned by this {isEns ? "ENS name" : "address"}.
            </p>
            <Link
              href="/troves"
              className="inline-block mt-4 text-sm text-blue-500 hover:text-blue-600 transition-colors"
            >
              Browse all troves
            </Link>
          </div>
        )}

        {!loading && !error && troves.length > 0 && (
          <div className="space-y-10">
            {troves.map((trove) => (
              <AddressTroveSection key={trove.id} trove={trove} prices={prices} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
