"use client";

// Aave V4 spoke-position listing card. Visual analog of the detail page's
// position card (components/protocol/aave-v4/aave-v4-spoke-card.tsx) and
// produces byte-for-byte matching numbers for the same (wallet, spoke).
//
// How parity is enforced:
//   - The server ships per-reserve chain-truth (`reserves[]`: chain balances,
//     LTs, isCollateral, DefiLlama prices) on every listing row, using the
//     same source the detail page reads from. See
//     rails-server-mig/api/src/services/aave-v4-fetcher.ts.
//   - The listing card runs the same `simulateAaveV4Position` the detail's
//     `patchSpokeCardWithChain` uses, so totals / liq prices / borrowing
//     power are derived from identical inputs.
//   - The same shared `fmtUsd` / `hfLabel` / `fmtLiqPrice` helpers
//     (`lib/aave-v4/format.ts`) format every value on both surfaces.
//
// Differences from the detail card:
//   - Smaller asset-icon size (24px vs 32px) for listing density.
//   - No netApy / borrow-rate footnotes (the listing wire doesn't carry the
//     per-reserve event series those derive from — they belong on the deep view).
//   - No (i) spoke-narrative info button.

import { Facehash } from "@/components/shared/facehash";
import { InlineAssetCluster } from "@/components/shared/inline-asset-cluster";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { Icon } from "@/components/icons/icon";
import { formatDuration } from "@/lib/date";
import { useState, useMemo } from "react";
import type { AaveV4SpokePositionRow } from "@/lib/api/fetch-aave-v4-spoke-positions";
import { scaleChainBalance } from "@/lib/api/fetch-aave-v4-spoke-position";
import { bucketForHealth } from "@/lib/aave-v4/health-bucket";
import { SPOKE_HUB } from "@/components/protocol/aave-v4/aave-v4-spoke-constants";
import { LiquidatedBadge } from "@/components/aave-v4/LiquidatedBadge";
import { fmtUsd, hfLabel, fmtLiqPrice } from "@/lib/aave-v4/format";
import {
  simulateAaveV4Position,
  type SimPositionInputs,
} from "@/lib/aave-v4/utils/simulate";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
  // Build sim inputs from the server's chain-truth reserves[]. Same inputs the
  // detail page passes to simulateAaveV4Position inside patchSpokeCardWithChain.
  const sim = useMemo(() => {
    const supplies: SimPositionInputs["supplies"] = [];
    const debts: SimPositionInputs["debts"] = [];
    const supplyingSymbols: string[] = [];
    const borrowingSymbols: string[] = [];
    let dominantSupplyAddress: string | null = null;
    let dominantSupplyUsd = 0;
    let dominantDebtAddress: string | null = null;
    let dominantDebtUsd = 0;

    for (const r of row.reserves) {
      const price = r.usdPrice ?? 0;
      const supply = scaleChainBalance(r.supplyBalanceRaw, r.decimals);
      const debt = scaleChainBalance(r.debtBalanceRaw, r.decimals);
      if (supply > 0) {
        supplies.push({
          symbol: r.symbol,
          amount: supply,
          price,
          lt: r.lt ?? 0,
          collateralEnabled: r.isCollateral,
        });
        supplyingSymbols.push(r.symbol);
        const usd = supply * price;
        if (usd > dominantSupplyUsd) {
          dominantSupplyUsd = usd;
          dominantSupplyAddress = r.address;
        }
      }
      if (debt > 0) {
        debts.push({ symbol: r.symbol, amount: debt, price });
        borrowingSymbols.push(r.symbol);
        const usd = debt * price;
        if (usd > dominantDebtUsd) {
          dominantDebtUsd = usd;
          dominantDebtAddress = r.address;
        }
      }
    }

    const result = simulateAaveV4Position({ supplies, debts });

    // Dominant-collateral liq price: largest-USD supply with a non-null
    // simulated liq price. Mirrors patchSpokeCardWithChain logic exactly so
    // the listing's headline Liq Price tracks the detail's.
    let liqPrice: { symbol: string; liqPrice: number; headroomPct: number } | null = null;
    if (result.totalDebtUsd > 0) {
      const ranked = supplies
        .map((s, i) => ({
          symbol: s.symbol,
          usd: s.amount * s.price,
          lp: result.assetLiqPrices[i],
        }))
        .filter((x) => x.lp?.liqPrice != null && x.lp.liqPrice > 0)
        .sort((a, b) => b.usd - a.usd);
      if (ranked.length > 0) {
        const top = ranked[0];
        liqPrice = {
          symbol: top.symbol,
          liqPrice: top.lp!.liqPrice!,
          headroomPct: top.lp!.headroomPct ?? 0,
        };
      }
    }

    return {
      ...result,
      supplyingSymbols,
      borrowingSymbols,
      dominantSupplyAddress,
      dominantDebtAddress,
      liqPrice,
    };
  }, [row.reserves]);

  // Prefer the chain HF the server already shipped (matches Aave UI by
  // construction) over the sim's derived HF. They agree when LTs are fresh;
  // chain wins when they don't (premium-shares, recently-changed LT).
  const healthFactor = row.healthFactor;
  const hasDebt = healthFactor != null;
  const bucket = bucketForHealth(healthFactor);
  // True supply-only: no debt now AND no liquidation in this position's
  // history. Lifted from the detail card's `supplyOnly` heuristic — the
  // listing wire doesn't carry peakDebt, so liquidationCount > 0 stands in
  // for "has had debt at some point."
  const supplyOnly = !hasDebt && row.liquidationCount === 0;
  // Chain overlay failed for this row → balances are MV-indexed (potentially
  // drifted from on-chain). The card still renders; the indicator warns.
  const hfStale = hasDebt && row.chainHfStale;
  const borrowingPowerUsd = sim.borrowCapacityUsd;

  return (
    <div className="text-foreground">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <span className="flex items-center gap-2 flex-wrap">
          <span
            className={`font-bold tracking-wider px-2 py-0.5 rounded-xs text-xs ${bucket.pillClass}`}
          >
            {bucket.pillLabel}
          </span>
          {row.liquidationCount > 0 && <LiquidatedBadge />}
          <span className="flex items-center gap-1.5 leading-none text-foreground">
            <span className="text-xs font-semibold">{row.spokeName}</span>
            <span className="text-xs font-bold uppercase tracking-wide">
              {SPOKE_HUB[row.spokeName] ?? "Core"}
            </span>
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
        {/* Collateral / Supplied */}
        <div>
          <div className="text-xs text-rb-500 font-semibold mb-1">
            {supplyOnly ? "Supplied" : "Collateral"}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-3xl font-bold ${supplyOnly ? "text-rb-500" : "text-blue-400"}`}
              title={fmtUsd(sim.totalCollateralUsd).title}
            >
              {fmtUsd(sim.totalCollateralUsd).display}
            </span>
            {sim.supplyingSymbols.length > 0 && (
              <InlineAssetCluster symbols={sim.supplyingSymbols} size={24} overlap={7} />
            )}
          </div>
          <div className="text-xs mt-0.5 text-rb-500 min-h-[1rem]">{""}</div>
        </div>

        {/* Debt */}
        <div>
          <div className="text-xs text-rb-500 font-semibold mb-1">Debt</div>
          {supplyOnly ? (
            <div className="text-3xl font-bold text-rb-500">—</div>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-3xl font-bold text-emerald-400"
                title={fmtUsd(sim.totalDebtUsd).title}
              >
                {fmtUsd(sim.totalDebtUsd).display}
              </span>
              {sim.borrowingSymbols.length > 0 && (
                <InlineAssetCluster symbols={sim.borrowingSymbols} size={24} overlap={7} />
              )}
            </div>
          )}
          <div className="text-xs mt-0.5 text-rb-500 min-h-[1rem]">
            {supplyOnly ? "Supply only" : ""}
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
          {supplyOnly ? (
            <div className="text-3xl font-bold text-rb-500">—</div>
          ) : hasDebt ? (
            <div className={`text-3xl font-bold ${bucket.valueColor}`}>
              {hfStale ? "~" : ""}
              {hfLabel(healthFactor)}
            </div>
          ) : (
            <div className="text-3xl font-bold text-rb-500">∞</div>
          )}
          <div className="text-xs mt-0.5 text-rb-500 min-h-[1rem]">
            {borrowingPowerUsd > 0.01 ? (
              <span title={fmtUsd(borrowingPowerUsd).title}>
                {fmtUsd(borrowingPowerUsd).display} borrowing power
              </span>
            ) : (
              ""
            )}
          </div>
        </div>

        {/* Liq Price */}
        <div>
          <div className="text-xs text-rb-500 font-semibold mb-1">
            {sim.liqPrice ? `Liq Price (${sim.liqPrice.symbol})` : "Liq Price"}
          </div>
          {sim.liqPrice ? (
            <div className="text-3xl font-bold text-foreground">
              <span className="inline-flex items-center gap-1.5">
                {fmtLiqPrice(sim.liqPrice.liqPrice)}
                <TokenChipIcon symbol={sim.liqPrice.symbol} size={18} filterable={false} />
              </span>
            </div>
          ) : (
            <div className="text-3xl font-bold text-rb-500">—</div>
          )}
          <div className="text-xs mt-0.5 text-rb-500 min-h-[1rem]">
            {sim.liqPrice ? `${sim.liqPrice.headroomPct.toFixed(0)}% headroom` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
