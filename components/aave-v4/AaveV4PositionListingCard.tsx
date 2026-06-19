"use client";

// Aave V4 spoke-position listing card. Visual + numeric analog of the
// detail page's position card (components/protocol/aave-v4/aave-v4-spoke-card.tsx).
//
// How parity is enforced:
//   - Layout shell: both surfaces render through `OpenPositionStats`, so
//     grid, label/value spacing, footnote handling, and asset-cluster
//     alignment are byte-identical.
//   - Numbers: the server ships per-reserve chain-truth (`reserves[]`:
//     chain balances, LTs, isCollateral, DefiLlama prices) on every listing
//     row, mirroring the detail page's chain-truth endpoint. The card runs
//     the same `simulateAaveV4Position` the detail's `patchSpokeCardWithChain`
//     runs, so totals, liq prices, and borrowing power are derived from
//     identical inputs.
//   - Formatting: shared `fmtUsd` / `hfLabel` / `fmtLiqPrice` (`lib/aave-v4/format.ts`).
//
// Listing-only additions (not on the detail card):
//   - Wallet identity pill (facehash + short addr + copy) sits alongside
//     the spoke identity, since the listing shows many wallets and the
//     detail is already scoped to one.
//   - Time-ago in the `identity` slot.

import { InlineAssetCluster } from "@/components/shared/inline-asset-cluster";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { Icon } from "@/components/icons/icon";
import { OpenPositionStats } from "@/components/shared/open-position-stats";
import { StatValue, StatDash } from "@/components/shared/stat-value";
import { formatDuration } from "@/lib/date";
import { useMemo } from "react";
import type { AaveV4SpokePositionRow } from "@/lib/api/fetch-aave-v4-spoke-positions";
import { scaleChainBalance } from "@/lib/api/fetch-aave-v4-spoke-position";
import { bucketForHealth } from "@/lib/aave-v4/health-bucket";
import { SPOKE_HUB } from "@/components/protocol/aave-v4/aave-v4-spoke-constants";
import { LiquidatedBadge } from "@/components/aave-v4/LiquidatedBadge";
import { WalletPill } from "@/components/aave-v4/wallet-pill";
import { fmtUsd, hfLabel, fmtLiqPrice } from "@/lib/aave-v4/format";
import { simulateAaveV4Position, type SimPositionInputs } from "@/lib/aave-v4/utils/simulate";

export function AaveV4PositionListingCard({ row }: { row: AaveV4SpokePositionRow }) {
  // Build sim inputs from the server's chain-truth reserves[]. Same inputs the
  // detail page passes to simulateAaveV4Position inside patchSpokeCardWithChain.
  const sim = useMemo(() => {
    const supplies: SimPositionInputs["supplies"] = [];
    const debts: SimPositionInputs["debts"] = [];
    const supplyingSymbols: string[] = [];
    const borrowingSymbols: string[] = [];

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
      }
      if (debt > 0) {
        debts.push({ symbol: r.symbol, amount: debt, price });
        borrowingSymbols.push(r.symbol);
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
  const hubTier = SPOKE_HUB[row.spokeName] ?? "Core";

  const collateralValue = (() => {
    // "Collateral" is the full deposited value — the LT weighting (what can be
    // borrowed against it) lives in HF + borrowing power, not in this number.
    const v = fmtUsd(sim.totalCollateralUsd);
    // Supply-only positions are still OPEN — render the value bright like any
    // active position. The muted (text-rb-500) tone is reserved for genuinely
    // closed positions, so using it here would falsely read as "closed."
    return (
      <StatValue color="text-foreground/80" title={v.title}>
        {v.display}
      </StatValue>
    );
  })();

  const debtValue = (() => {
    if (supplyOnly) return <StatDash />;
    const v = fmtUsd(sim.totalDebtUsd);
    return (
      <StatValue color="text-foreground/80" title={v.title}>
        {v.display}
      </StatValue>
    );
  })();

  const hfValue = (() => {
    if (supplyOnly) return <StatDash />;
    if (!hasDebt) return <StatDash>{"∞"}</StatDash>;
    return (
      <StatValue color={bucket.valueColor}>
        {hfStale ? "~" : ""}
        {hfLabel(healthFactor)}
      </StatValue>
    );
  })();

  const liqPriceValue = (() => {
    if (!sim.liqPrice) return <StatDash />;
    return (
      <StatValue color="text-foreground/80">
        <span className="inline-flex items-center gap-1.5">
          {fmtLiqPrice(sim.liqPrice.liqPrice)}
          <TokenChipIcon symbol={sim.liqPrice.symbol} size={28} filterable={false} />
        </span>
      </StatValue>
    );
  })();

  return (
    <OpenPositionStats
      statusPill={
        <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${bucket.pillClass}`}>{bucket.pillLabel}</span>
      }
      leadingIdentity={
        <>
          {row.liquidationCount > 0 && <LiquidatedBadge />}
          <span className="flex items-center gap-1.5 leading-none text-foreground">
            <span className="text-xs font-semibold">{row.spokeName}</span>
            <span className="text-xs font-bold uppercase tracking-wide">{hubTier}</span>
          </span>
          <WalletPill wallet={row.wallet} ensName={row.ensName} />
        </>
      }
      identity={
        <span className="inline-flex items-center gap-1 text-xs text-rb-500">
          <Icon name="clock-zap" size={12} />
          {formatDuration(row.lastActivityAt, new Date())} ago
        </span>
      }
      columns={[
        {
          label: supplyOnly ? "Supplied" : "Collateral",
          assetIcons:
            sim.supplyingSymbols.length > 0 ? <InlineAssetCluster symbols={sim.supplyingSymbols} /> : undefined,
          value: collateralValue,
        },
        {
          label: "Debt",
          assetIcons:
            !supplyOnly && sim.borrowingSymbols.length > 0 ? (
              <InlineAssetCluster symbols={sim.borrowingSymbols} />
            ) : undefined,
          value: debtValue,
          footnote: supplyOnly ? <div className="text-xs mt-0.5 text-rb-500">Supply only</div> : undefined,
        },
        {
          label: "Health Factor",
          headerIcon: hfStale ? (
            <span
              className="text-orange-500"
              title="Approximate — live on-chain source unavailable. Shown value derived from indexed balances × off-chain prices."
              aria-label="Health factor is approximate; live on-chain source unavailable"
            >
              <Icon name="triangle" size={10} />
            </span>
          ) : undefined,
          value: hfValue,
          // Borrowing power intentionally omitted (matches the detail card): it's
          // the gap to a 1.00 HF (the liquidation point), not a safe-to-borrow
          // figure, so it misreads as a stat.
          footnote: undefined,
        },
        {
          label: sim.liqPrice ? `Liq Price (${sim.liqPrice.symbol})` : "Liq Price",
          value: liqPriceValue,
          footnote: sim.liqPrice ? (
            <div className="text-xs mt-0.5 text-rb-500">{sim.liqPrice.headroomPct.toFixed(0)}% headroom</div>
          ) : undefined,
        },
      ]}
    />
  );
}
