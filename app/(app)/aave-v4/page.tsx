"use client";

// Aave V4 landing — discovery list + wallet search hybrid (the analog of
// /liquity-v2). Surfaces every (wallet, spoke) open position from the
// mv_aave_v4_spoke_positions MV with spoke / debt / health-factor filters
// and lightweight pagination. Direct-search by address still works (the
// search input falls through to /aave-v4/<wallet>).

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AaveV4SpokePositionCard } from "@/components/protocol/aave-v4/aave-v4-spoke-position-card";
import {
  fetchAaveV4SpokePositions,
  type AaveV4SpokePositionRow,
  type AaveV4SpokePositionSort,
} from "@/lib/api/fetch-aave-v4-spoke-positions";

const PAGE_SIZE = 20;

// Spoke key + display name. Mirror of api/src/config/aave-v4-spokes.ts —
// the keys are the source-of-truth lowercase identifiers in the MV.
const SPOKE_OPTIONS: { value: string; label: string }[] = [
  { value: "",            label: "All spokes" },
  { value: "main",        label: "Main" },
  { value: "bluechip",    label: "Bluechip" },
  { value: "ethena_corr", label: "Ethena Correlated" },
  { value: "ethena_eco",  label: "Ethena Ecosystem" },
  { value: "etherfi",     label: "EtherFi" },
  { value: "forex",       label: "Forex" },
  { value: "gold",        label: "Gold" },
  { value: "kelp",        label: "Kelp" },
  { value: "lido",        label: "Lido" },
  { value: "lombard",     label: "Lombard BTC" },
];

type DebtFilter = "all" | "withDebt" | "noDebt";
type HealthFilter = "all" | "atRisk" | "underwater";

interface SortOption {
  value: AaveV4SpokePositionSort;
  order: "asc" | "desc";
  label: string;
}
const SORT_OPTIONS: SortOption[] = [
  { value: "lastActivity", order: "desc", label: "Most recent" },
  { value: "debtUsd",      order: "desc", label: "Largest debt" },
  { value: "supplyUsd",    order: "desc", label: "Largest supply" },
  { value: "healthFactor", order: "asc",  label: "Lowest health factor" },
];

function AaveV4ListPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-derived state
  const spoke       = searchParams.get("spoke") ?? "";
  const debtFilter  = (searchParams.get("debt") as DebtFilter | null) ?? "all";
  const healthFilter = (searchParams.get("health") as HealthFilter | null) ?? "all";
  const sortKey     = searchParams.get("sort") ?? "lastActivity:desc";
  const page        = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const sortChoice = useMemo(
    () => SORT_OPTIONS.find((o) => `${o.value}:${o.order}` === sortKey) ?? SORT_OPTIONS[0],
    [sortKey],
  );

  // Wallet jump-to (the rail's original landing input)
  const [walletInput, setWalletInput] = useState("");
  const [walletError, setWalletError] = useState<string | null>(null);

  const submitWallet = () => {
    const lower = walletInput.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(lower)) {
      setWalletError("Enter a valid Ethereum address (0x… 40 hex chars)");
      return;
    }
    router.push(`/aave-v4/${lower}`);
  };

  // List data
  const [rows, setRows] = useState<AaveV4SpokePositionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAaveV4SpokePositions({
      spoke: spoke || undefined,
      hasDebt: debtFilter === "withDebt",
      noDebt:  debtFilter === "noDebt",
      healthBelow:
        healthFilter === "atRisk" ? 1.1 :
        healthFilter === "underwater" ? 1.0 :
        undefined,
      sortBy: sortChoice.value,
      sortOrder: sortChoice.order,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
      .then((r) => {
        if (cancelled) return;
        setRows(r.rows);
        setTotal(r.total);
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
  }, [spoke, debtFilter, healthFilter, sortChoice.value, sortChoice.order, page]);

  const updateParams = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(searchParams.toString());
    mut(p);
    // Reset page whenever a filter changes.
    p.delete("page");
    router.push(`/aave-v4?${p.toString()}`);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto py-10 px-4">
        {/* Header + wallet jump-to */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Explore Aave V4</h1>
          <p className="text-rb-500 mb-6">
            Open positions across the 11 Aave V4 spokes. Jump straight to a wallet, or browse by spoke and health.
          </p>
          <div className="flex gap-2 max-w-2xl">
            <input
              type="text"
              value={walletInput}
              onChange={(e) => {
                setWalletInput(e.target.value);
                setWalletError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitWallet();
              }}
              placeholder="Jump to wallet: 0x…"
              className="flex-1 px-4 py-2 rounded-lg border border-rb-300 dark:border-rb-700 bg-rb-50 dark:bg-rb-900 text-foreground font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={submitWallet}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
            >
              Go
            </button>
          </div>
          {walletError && <p className="mt-2 text-sm text-red-500">{walletError}</p>}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Select
            value={spoke}
            onChange={(v) => updateParams((p) => (v ? p.set("spoke", v) : p.delete("spoke")))}
            options={SPOKE_OPTIONS}
          />
          <Select
            value={debtFilter}
            onChange={(v) =>
              updateParams((p) => (v && v !== "all" ? p.set("debt", v) : p.delete("debt")))
            }
            options={[
              { value: "all",      label: "Any position" },
              { value: "withDebt", label: "With debt" },
              { value: "noDebt",   label: "Supply-only" },
            ]}
          />
          <Select
            value={healthFilter}
            onChange={(v) =>
              updateParams((p) => (v && v !== "all" ? p.set("health", v) : p.delete("health")))
            }
            options={[
              { value: "all",        label: "Any health" },
              { value: "atRisk",     label: "At risk (HF < 1.1)" },
              { value: "underwater", label: "Underwater (HF < 1.0)" },
            ]}
          />
          <div className="ml-auto">
            <Select
              value={`${sortChoice.value}:${sortChoice.order}`}
              onChange={(v) => updateParams((p) => p.set("sort", v))}
              options={SORT_OPTIONS.map((o) => ({
                value: `${o.value}:${o.order}`,
                label: o.label,
              }))}
            />
          </div>
        </div>

        <div className="text-xs text-rb-500 mb-3">
          {loading ? "Loading…" : `${total.toLocaleString()} position${total === 1 ? "" : "s"}`}
        </div>

        {/* List */}
        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-6 text-sm text-red-600 dark:text-red-400">
            Failed to load: {error}
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[68px] rounded-lg border border-rb-200 dark:border-rb-800 bg-rb-100/40 dark:bg-rb-900/40 animate-pulse"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-rb-200 dark:border-rb-800 bg-rb-50 dark:bg-rb-950 px-4 py-10 text-center text-sm text-rb-500">
            No positions match the current filters.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <AaveV4SpokePositionCard key={`${row.wallet}:${row.spoke}`} row={row} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() =>
                router.push(
                  `/aave-v4?${(() => {
                    const p = new URLSearchParams(searchParams.toString());
                    p.set("page", String(page - 1));
                    return p.toString();
                  })()}`,
                )
              }
              className="px-3 py-1.5 rounded-md border border-rb-300 dark:border-rb-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rb-100 dark:hover:bg-rb-800 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-rb-500">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() =>
                router.push(
                  `/aave-v4?${(() => {
                    const p = new URLSearchParams(searchParams.toString());
                    p.set("page", String(page + 1));
                    return p.toString();
                  })()}`,
                )
              }
              className="px-3 py-1.5 rounded-md border border-rb-300 dark:border-rb-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rb-100 dark:hover:bg-rb-800 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

/** Minimal native <select> styled to match the rest of the surface. The
 *  trove-list filters component is heavier (dropdown-with-search etc.); we
 *  reach for a plain select here because the option count is bounded. */
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 rounded-md border border-rb-300 dark:border-rb-700 bg-rb-50 dark:bg-rb-900 text-foreground text-xs font-medium cursor-pointer hover:bg-rb-100 dark:hover:bg-rb-800 transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function AaveV4LandingPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto py-10 px-4 text-rb-500">Loading…</div>}>
      <AaveV4ListPageContent />
    </Suspense>
  );
}
