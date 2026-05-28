"use client";

/**
 * Aave V4 spoke-position summary card — one row in the /aave-v4 list view.
 *
 * Compact, link-only — no inline expansion. Click → navigates to the full
 * wallet+spoke detail page at /aave-v4/<wallet>. Mirrors the Liquity
 * `TroveSummaryCard` shape (Facehash + ENS/short addr left, asset chips +
 * USD totals middle, status badge right) but adapted for V4's per-spoke
 * aggregation.
 *
 * Health-factor badge colors track the same buckets as the runway stack:
 *   ≥ 1.5  healthy (green)
 *   ≥ 1.1  cautious (amber)
 *   < 1.1  at-risk (red)
 *   null   no debt (neutral)
 */

import Link from "next/link";
import { Facehash } from "@/components/shared/facehash";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { slugifySpoke } from "@/lib/aave-v4/spoke-meta";
import type { AaveV4SpokePositionRow } from "@/lib/api/fetch-aave-v4-spoke-positions";

function formatUsd(v: number | null): string {
  if (v == null) return "—";
  if (v < 0.01) return "$0";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(unix: number): string {
  const seconds = Math.floor(Date.now() / 1000) - unix;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 86400 * 365) return `${Math.floor(seconds / 86400 / 30)}mo ago`;
  return `${Math.floor(seconds / 86400 / 365)}y ago`;
}

function HealthBadge({ hf }: { hf: number | null }) {
  if (hf == null) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-rb-200 dark:bg-rb-800 text-rb-500">
        No debt
      </span>
    );
  }
  const cls =
    hf >= 1.5
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : hf >= 1.1
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : "bg-red-500/15 text-red-600 dark:text-red-400";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${cls}`}
    >
      HF {hf < 0.01 ? "0" : hf.toFixed(2)}
    </span>
  );
}

export function AaveV4SpokePositionCard({ row }: { row: AaveV4SpokePositionRow }) {
  const label = row.ensName ?? shortAddr(row.wallet);
  const spokeSlug = slugifySpoke(row.spokeName) ?? encodeURIComponent(row.spokeName);

  return (
    <Link
      href={`/aave-v4/spoke/${spokeSlug}/${row.wallet}`}
      className="group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 rounded-lg border border-rb-200 dark:border-rb-800 bg-rb-50 dark:bg-rb-950 hover:border-blue-500/40 hover:bg-rb-100/40 dark:hover:bg-rb-900/40 transition-colors"
    >
      {/* Wallet identity */}
      <div className="flex items-center gap-2 shrink-0 min-w-0 w-[180px]">
        <Facehash address={row.wallet} size={28} />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{label}</span>
          <span className="text-[10px] text-rb-500 font-mono truncate">
            {row.ensName ? shortAddr(row.wallet) : ""}
          </span>
        </div>
      </div>

      {/* Spoke chip */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0 w-[140px]">
        <img
          src="/icons/protocols/aave-v4.png"
          alt=""
          className="w-5 h-5 rounded-[4px]"
        />
        <span className="text-xs font-medium text-foreground truncate">{row.spokeName}</span>
      </div>

      {/* Supply column */}
      <div className="flex flex-col items-end shrink-0 w-[120px] sm:w-[140px]">
        <span className="text-[10px] text-rb-500 uppercase tracking-wider">Supply</span>
        <div className="flex items-center gap-1.5">
          {row.dominantSupplySymbol && row.dominantSupplyAddress && (
            <TokenChipIcon
              symbol={row.dominantSupplySymbol}
              address={row.dominantSupplyAddress}
              size={14}
              filterable={false}
            />
          )}
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatUsd(row.totalSupplyUsd)}
          </span>
          {row.supplyAssetCount > 1 && (
            <span className="text-[10px] text-rb-500">+{row.supplyAssetCount - 1}</span>
          )}
        </div>
      </div>

      {/* Debt column */}
      <div className="flex flex-col items-end shrink-0 w-[120px] sm:w-[140px]">
        <span className="text-[10px] text-rb-500 uppercase tracking-wider">Debt</span>
        <div className="flex items-center gap-1.5">
          {row.dominantDebtSymbol && row.dominantDebtAddress && (
            <TokenChipIcon
              symbol={row.dominantDebtSymbol}
              address={row.dominantDebtAddress}
              size={14}
              filterable={false}
            />
          )}
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatUsd(row.totalDebtUsd)}
          </span>
          {row.debtAssetCount > 1 && (
            <span className="text-[10px] text-rb-500">+{row.debtAssetCount - 1}</span>
          )}
        </div>
      </div>

      {/* HF + activity */}
      <div className="hidden md:flex flex-col items-end gap-1 ml-auto shrink-0">
        <HealthBadge hf={row.healthFactor} />
        <span className="text-[10px] text-rb-500">{timeAgo(row.lastActivityAt)}</span>
      </div>

      {/* Mobile HF (icon-only) */}
      <div className="md:hidden ml-auto shrink-0">
        <HealthBadge hf={row.healthFactor} />
      </div>
    </Link>
  );
}
