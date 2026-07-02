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
import { fmtUsd, hfLabel } from "@/lib/aave-v4/format";
import {
  simulateAaveV4Position,
  computeSupplyBreakdown,
  type SimPositionInputs,
  type BreakdownAsset,
} from "@/lib/aave-v4/utils/simulate";
import { liquidationBufferFrom } from "@/lib/aave-v4/spoke-cards";
import { AaveV4LiquidationFootnote } from "@/components/protocol/aave-v4/aave-v4-liquidation-footnote";

export function AaveV4PositionListingCard({ row }: { row: AaveV4SpokePositionRow }) {
  // Build sim inputs from the server's chain-truth reserves[]. Same inputs the
  // detail page passes to simulateAaveV4Position inside patchSpokeCardWithChain.
  const sim = useMemo(() => {
    const supplies: SimPositionInputs["supplies"] = [];
    const debts: SimPositionInputs["debts"] = [];
    const supplyingSymbols: BreakdownAsset[] = [];
    const borrowingSymbols: BreakdownAsset[] = [];

    for (const r of row.reserves) {
      const price = r.usdPrice ?? 0;
      const supply = scaleChainBalance(r.supplyBalanceRaw, r.decimals);
      const debt = scaleChainBalance(r.debtBalanceRaw, r.decimals);
      if (supply > 0) {
        supplies.push({
          symbol: r.symbol,
          hub: r.hub,
          amount: supply,
          price,
          lt: r.lt ?? 0,
          collateralEnabled: r.isCollateral,
        });
        supplyingSymbols.push({ symbol: r.symbol, hub: r.hub });
      }
      if (debt > 0) {
        debts.push({ symbol: r.symbol, hub: r.hub, amount: debt, price });
        borrowingSymbols.push({ symbol: r.symbol, hub: r.hub });
      }
    }

    const result = simulateAaveV4Position({ supplies, debts });

    return {
      ...result,
      supplyingSymbols,
      borrowingSymbols,
      breakdown: computeSupplyBreakdown(supplies),
    };
  }, [row.reserves]);

  // Liquidation read — identical helper to the detail card. Single collateral
  // asset → its price; two or more → the 1 − 1/HF buffer. Uses the chain HF the
  // server shipped (row.healthFactor), not the sim's derived HF.
  const buf = liquidationBufferFrom(row.healthFactor, sim.totalDebtUsd, sim.assetLiqPrices);

  // Prefer the chain HF the server already shipped (matches Aave UI by
  // construction) over the sim's derived HF. They agree when LTs are fresh;
  // chain wins when they don't (premium-shares, recently-changed LT).
  const healthFactor = row.healthFactor;
  const hasDebt = healthFactor != null;
  const bucket = bucketForHealth(healthFactor);
  // Live view: ANY live debt counts as borrowing — no dust floor. A sub-dollar
  // leftover borrow still shows its full Debt / HF readout so the headline
  // agrees with the "Borrowing" pill (both key off debt > 0). Past borrows or
  // liquidations on an otherwise debt-free position stay carried by the
  // LiquidatedBadge + timeline, since debt is genuinely 0 there.
  const supplyOnly = sim.totalDebtUsd <= 0;
  // Chain overlay failed for this row → balances are MV-indexed (potentially
  // drifted from on-chain). The card still renders; the indicator warns.
  const hfStale = hasDebt && row.chainHfStale;
  const hubTier = SPOKE_HUB[row.spokeName] ?? "Core";

  // Lifecycle (server migration 034). A closed position has no live balances; we
  // render it muted with a CLOSED pill (Liquity trove-card parity) and a lifespan
  // readout in place of the live stat grid. The wire status still carries the
  // terminal CAUSE — 'liquidated' means the *final* event was a liquidation —
  // which we surface as a muted "by liquidation" qualifier beside CLOSED,
  // distinguishing it from an owner-driven wind-down (closedByLiquidation). This
  // is the STRUCTURAL axis; liquidation *history* (any liquidation over the
  // position's life, open or closed) stays on the orthogonal LiquidatedBadge, not
  // this pill. Null-safe against a pre-034 API that omits `status`: that API only
  // ever returned open positions (closed ones were pruned), so absent ⇒ open.
  const isOpen = row.status == null || row.status === "open";
  const closedByLiquidation = row.status === "liquidated";
  // Peak-based supply-only test for the closed card: a position that never
  // carried real debt (peak debt < $1) drops the Peak Debt column, mirroring the
  // detail card's `spoke.peakDebtUsd < 1` rule. Distinct from the live
  // `supplyOnly` (which reads the now-zero current balances and is always true
  // once closed).
  const peakSupplyOnly = (row.peakDebtUsd ?? 0) < 1;

  const collateralValue = (() => {
    // "Collateral" is the full (un-LT-weighted) value of the supplies enabled as
    // collateral. Supply-only positions have no collateral concept yet, so show
    // the full deposited value; once there's debt, non-collateral supplies are
    // excluded (shown as a footnote). The LT weighting lives in HF + borrowing
    // power, not in this number.
    const usd = supplyOnly ? sim.totalCollateralUsd : sim.breakdown.collateralUsd;
    const v = fmtUsd(usd);
    // Supply-only positions are still live — render the value bright like any
    // active position. The muted (text-rb-500) tone is reserved for genuinely
    // closed positions, so using it here would falsely read as "closed."
    return (
      <StatValue color="text-foreground/80" title={v.title}>
        {v.display}
      </StatValue>
    );
  })();

  // Debt / HF values for positions carrying real (non-dust) debt. Supply-only
  // rows never reach these — their columns are `null`ed out below so the grid
  // slot stays open without asserting an empty Debt/HF (matches the detail
  // card and the closed-Liquity precedent: an absent dimension shows nothing,
  // not a placeholder dash).
  const debtValue = (() => {
    const v = fmtUsd(sim.totalDebtUsd);
    return (
      <StatValue color="text-foreground/80" title={v.title}>
        {v.display}
      </StatValue>
    );
  })();

  const hfValue = (() => {
    if (!hasDebt) return <StatDash>{"∞"}</StatDash>;
    return (
      <StatValue color={bucket.valueColor}>
        {hfStale ? "~" : ""}
        {hfLabel(healthFactor)}
      </StatValue>
    );
  })();

  return (
    <OpenPositionStats
      statusPill={
        isOpen ? (
          <span className={`font-bold px-2 py-0.5 rounded-sm text-xs ${bucket.pillClass}`}>{bucket.pillLabel}</span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-bold tracking-wider px-2 py-0.5 bg-rb-500 dark:bg-rb-800 text-rb-50 dark:text-rb-400 rounded-xs text-xs">
              CLOSED
            </span>
            {closedByLiquidation && (
              <span
                className="text-xs text-rb-500"
                title="The final event on this position was a liquidation — closed by liquidation, not wound down by the owner."
              >
                by liquidation
              </span>
            )}
          </span>
        )
      }
      leadingIdentity={
        <>
          <span className="flex items-center gap-1.5 leading-none text-foreground">
            <span className="text-xs font-semibold">{row.spokeName}</span>
            <span className="text-xs font-bold uppercase tracking-wide">{hubTier}</span>
          </span>
          <WalletPill
            wallet={row.wallet}
            ensName={row.ensName}
            href={`/aave-v4?wallet=${row.wallet}`}
            favouriteProtocol="aave-v4"
          />
        </>
      }
      identity={
        // Right-hand activity-meta cluster (matching Liquity's trove cards and
        // the detail card): time-ago, then the owner transaction count, then the
        // red liquidation triangle. txCount is distinct non-liquidation
        // transactions — liquidations stay on the triangle, not in this tally.
        <span className="flex items-center gap-2 text-xs text-rb-500">
          <span className="inline-flex items-center gap-1">
            <Icon name="clock-zap" size={12} />
            {formatDuration(row.lastActivityAt, new Date())} ago
          </span>
          {row.txCount > 0 && (
            <span className="inline-flex items-center" title="Transactions (excludes liquidations)">
              <Icon name="arrow-left-right" size={12} />
              <span className="ml-1">{row.txCount}</span>
            </span>
          )}
          {row.liquidationCount > 0 && <LiquidatedBadge count={row.liquidationCount} />}
        </span>
      }
      columns={
        !isOpen
          ? [
              // Closed / liquidated: no live balances to show, so surface the
              // all-time high-water mark (Peak Supplied / Peak Debt) the same way
              // the detail card does — muted (text-rb-500), no debt column when
              // the position never carried real debt. The "X ago" in the
              // identity slot already reports when it closed.
              {
                label: peakSupplyOnly ? "Highest recorded supply" : "Highest recorded collateral",
                value: (() => {
                  const v = fmtUsd(row.peakSupplyUsd ?? 0);
                  return (
                    <StatValue color="text-rb-500" title={v.title}>
                      {v.display}
                    </StatValue>
                  );
                })(),
              },
              peakSupplyOnly
                ? null
                : {
                    label: "Highest recorded debt",
                    value: (() => {
                      const v = fmtUsd(row.peakDebtUsd ?? 0);
                      return (
                        <StatValue color="text-rb-500" title={v.title}>
                          {v.display}
                        </StatValue>
                      );
                    })(),
                  },
              null,
            ]
          : [
              {
                label: supplyOnly ? "Supplied" : "Collateral",
                assetIcons: (() => {
                  const symbols = supplyOnly ? sim.supplyingSymbols : sim.breakdown.collateralSymbols;
                  return symbols.length > 0 ? <InlineAssetCluster symbols={symbols} /> : undefined;
                })(),
                value: collateralValue,
                footnote:
                  !supplyOnly && sim.breakdown.nonCollateralUsd > 0 ? (
                    <div className="text-xs mt-0.5 text-rb-500">
                      + {fmtUsd(sim.breakdown.nonCollateralUsd).display} supplied · not collateral
                    </div>
                  ) : undefined,
              },
              // Supply-only → null both columns. The grid slot stays open (so the
              // card lines up with sibling borrowing cards) but renders nothing —
              // no "Debt"/"Health Factor" label, no dash, no footnote.
              supplyOnly
                ? null
                : {
                    label: "Debt",
                    assetIcons:
                      sim.borrowingSymbols.length > 0 ? (
                        <InlineAssetCluster symbols={sim.borrowingSymbols} />
                      ) : undefined,
                    value: debtValue,
                  },
              supplyOnly
                ? null
                : {
                    label: "Health Factor",
                    headerIcon: hfStale ? (
                      <span
                        className="text-caution-500"
                        title="Approximate — live on-chain source unavailable. Shown value derived from indexed balances × off-chain prices."
                        aria-label="Health factor is approximate; live on-chain source unavailable"
                      >
                        <Icon name="triangle" size={10} />
                      </span>
                    ) : undefined,
                    value: hfValue,
                    // Liquidation read sits beneath HF as its tangible restatement (single
                    // collateral → price, multi → 1 − 1/HF buffer), mirroring the detail
                    // card. Borrowing power stays omitted (misreads as safe-to-borrow).
                    footnote: <AaveV4LiquidationFootnote buf={buf} />,
                  },
            ]
      }
    />
  );
}
