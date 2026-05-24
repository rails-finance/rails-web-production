"use client";

// Aave V4 spoke-position listing card. Visual analog of Liquity V2's
// OpenSummaryCard / ClosedSummaryCard: status pill + spoke label + wallet
// identity in the header, then a four-column stats grid (Supply / Debt /
// Health Factor / Liq Buffer). Used by /aave-v4 list view.

import { Facehash } from "@/components/shared/facehash";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { Icon } from "@/components/icons/icon";
import { formatDuration } from "@/lib/date";
import { useState } from "react";
import type { AaveV4SpokePositionRow } from "@/lib/api/fetch-aave-v4-spoke-positions";

function formatUsd(v: number | null): string {
  if (v == null) return "—";
  if (v < 0.01) return "$0";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface HealthBucket {
  pillLabel: string;
  pillClass: string;
  valueColor: string;
}

function bucketForHealth(hf: number | null): HealthBucket {
  if (hf == null) {
    return {
      pillLabel: "NO DEBT",
      pillClass: "bg-rb-300 dark:bg-rb-700 text-foreground/80 dark:text-foreground/60",
      valueColor: "text-rb-500",
    };
  }
  if (hf >= 1.5) {
    return {
      pillLabel: "OPEN",
      pillClass: "text-white bg-green-500 dark:bg-green-950 dark:text-green-500/70",
      valueColor: "text-foreground",
    };
  }
  if (hf >= 1.1) {
    return {
      pillLabel: "CAUTIOUS",
      pillClass: "text-white bg-amber-500 dark:bg-amber-950 dark:text-amber-500/70",
      valueColor: "text-amber-400",
    };
  }
  if (hf >= 1.0) {
    return {
      pillLabel: "AT RISK",
      pillClass: "text-white bg-orange-500 dark:bg-orange-950 dark:text-orange-500/70",
      valueColor: "text-orange-400",
    };
  }
  return {
    pillLabel: "UNDERWATER",
    pillClass: "text-white bg-red-500 dark:bg-red-950 dark:text-red-500/70",
    valueColor: "text-red-400",
  };
}

// Liquidation buffer = the fraction of weighted collateral that could vanish
// before HF crosses 1. For HF=2.85 the buffer is ~65%. Returns null when no
// debt (HF=null) or when HF<=1 (already underwater).
function liqBuffer(hf: number | null): number | null {
  if (hf == null) return null;
  if (hf <= 1) return 0;
  return (1 - 1 / hf) * 100;
}

function WalletIdentityRow({
  wallet,
  ensName,
}: {
  wallet: string;
  ensName: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const label = ensName ?? shortAddr(wallet);
  const copy = () => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span className="inline-flex items-center gap-1 text-xs text-rb-500">
      <span className="font-mono text-foreground/80">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          copy();
        }}
        aria-label={copied ? "Copied address" : "Copy address"}
        title={copied ? "Copied!" : "Copy"}
        className="text-rb-500 hover:text-foreground cursor-pointer"
      >
        <Icon name={copied ? "check" : "copy"} size={12} />
      </button>
    </span>
  );
}

export function AaveV4PositionListingCard({ row }: { row: AaveV4SpokePositionRow }) {
  const bucket = bucketForHealth(row.healthFactor);
  const buffer = liqBuffer(row.healthFactor);
  const hasDebt = row.healthFactor != null;
  // Chain overlay failed for this row → HF/buffer are approximations derived
  // from indexed balances × DefiLlama prices instead of the spoke's own math.
  // Only flag when there's debt: HF=null rows have nothing to be stale about.
  const hfStale = hasDebt && row.chainHfStale;

  return (
    <div className="text-foreground">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <span className="flex items-center gap-2 flex-wrap">
          <span
            className={`font-bold tracking-wider px-2 py-0.5 rounded-xs text-xs ${bucket.pillClass}`}
          >
            {bucket.pillLabel}
          </span>
          <span className="text-xs font-bold uppercase tracking-wide text-foreground/80">
            {row.spokeName}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Facehash address={row.wallet} size={16} />
            <WalletIdentityRow wallet={row.wallet} ensName={row.ensName} />
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs text-rb-500">
          <span className="inline-flex items-center gap-1">
            <Icon name="clock-zap" size={12} />
            {formatDuration(row.lastActivityAt, new Date())} ago
          </span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
        {/* Supply */}
        <div>
          <div className="text-xs text-rb-500 font-semibold mb-1">Supply</div>
          <div className="flex items-center gap-1.5">
            <span className="text-3xl font-bold">{formatUsd(row.totalSupplyUsd)}</span>
            {row.dominantSupplySymbol && row.dominantSupplyAddress && (
              <TokenChipIcon
                symbol={row.dominantSupplySymbol}
                address={row.dominantSupplyAddress}
                size={24}
                filterable={false}
              />
            )}
          </div>
          <div className="text-xs mt-0.5 text-rb-500 min-h-[1rem]">
            {row.supplyAssetCount > 1
              ? `${row.supplyAssetCount} assets`
              : row.dominantSupplySymbol ?? ""}
          </div>
        </div>

        {/* Debt */}
        <div>
          <div className="text-xs text-rb-500 font-semibold mb-1">Debt</div>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-3xl font-bold ${hasDebt ? "" : "text-rb-500"}`}
            >
              {hasDebt ? formatUsd(row.totalDebtUsd) : "—"}
            </span>
            {hasDebt && row.dominantDebtSymbol && row.dominantDebtAddress && (
              <TokenChipIcon
                symbol={row.dominantDebtSymbol}
                address={row.dominantDebtAddress}
                size={24}
                filterable={false}
              />
            )}
          </div>
          <div className="text-xs mt-0.5 text-rb-500 min-h-[1rem]">
            {hasDebt
              ? row.debtAssetCount > 1
                ? `${row.debtAssetCount} assets`
                : row.dominantDebtSymbol ?? ""
              : "Supply only"}
          </div>
        </div>

        {/* Health Factor */}
        <div>
          <div className="text-xs text-rb-500 font-semibold mb-1 inline-flex items-center gap-1">
            Health Factor
            {hfStale && (
              <span
                className="text-amber-500"
                title="Approximate — live on-chain source unavailable. Shown value derived from indexed balances × off-chain prices."
                aria-label="Health factor is approximate; live on-chain source unavailable"
              >
                <Icon name="triangle" size={10} />
              </span>
            )}
          </div>
          {hasDebt && row.healthFactor != null ? (
            <div className={`text-3xl font-bold ${bucket.valueColor}`}>
              {hfStale ? "~" : ""}
              {row.healthFactor < 0.01
                ? "0"
                : row.healthFactor < 1.1
                  ? row.healthFactor.toFixed(4)
                  : row.healthFactor.toFixed(2)}
            </div>
          ) : (
            <div className="text-3xl font-bold text-rb-500">—</div>
          )}
          <div className="text-xs mt-0.5 text-rb-500">
            {hasDebt ? (hfStale ? "Approx — live source unavailable" : "Min 1.00 threshold") : ""}
          </div>
        </div>

        {/* Liq Buffer */}
        <div>
          <div className="text-xs text-rb-500 font-semibold mb-1">Liq Buffer</div>
          {hasDebt && buffer != null ? (
            <div className={`text-3xl font-bold ${bucket.valueColor}`}>
              {hfStale ? "~" : ""}{buffer.toFixed(0)}%
            </div>
          ) : (
            <div className="text-3xl font-bold text-rb-500">—</div>
          )}
          <div className="text-xs mt-0.5 text-rb-500 min-h-[1rem]">
            {hasDebt ? "weighted-coll drop till HF=1" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
