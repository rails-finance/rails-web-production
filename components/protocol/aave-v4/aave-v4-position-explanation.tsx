"use client";

// Plain-language, data-driven explanation of an Aave V4 spoke position — the
// Aave analogue of Liquity's useTroveExplanationItems. Lifted out of
// aave-v4-spoke-card.tsx so it can render either inside the card or, in the
// "About this position" layout, as a standalone panel above the stats card.

import type { AaveSpokeCardInfo, AaveV4InterestPnl } from "@/lib/aave-v4/spoke-cards";
import { fmtUsd, hfLabel, fmtLiqPrice, fmtSignedUsd, fmtTokenAmount } from "@/lib/aave-v4/format";
import { aaveV4DisplaySymbol } from "@/lib/aave-v4/pt-tokens";
import { LearnMore } from "@/components/shared/learn-more-modal";
import { aaveV4SpokeContent, aaveV4PositionFallbackContent } from "@/lib/shared/learn-more-content";

// Oxford-join a list of asset symbols for prose ("wstETH, WBTC and USDC").
function joinSymbols(syms: string[]): string {
  const names = syms.map(aaveV4DisplaySymbol);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Chain-faithful interest-carry prose: a net summary plus a per-asset
 * earned/paid breakdown. Token figures are exact (current chain balance minus
 * indexed deposits — no rate); USD is that figure at the current price. Mirrors
 * what Aave calls "Total Earnings", but read straight off chain-truth balances.
 */
function buildInterestItems(pnl: AaveV4InterestPnl): React.ReactNode[] {
  const items: React.ReactNode[] = [];
  if (pnl.hasData) {
    const net = fmtSignedUsd(pnl.netUsd);
    items.push(
      <span key="net-interest">
        Net interest to date: {net.display} — supply interest earned minus borrow interest paid, read from on-chain
        balances against indexed deposits rather than an annualized rate.
      </span>,
    );
  }
  // Per-asset earned/paid folded into a single bullet rather than one line each
  // (a multi-asset position otherwise spawns four+ near-identical bullets).
  const earned = pnl.assets.filter((a) => a.supplyInterest > 0);
  const paid = pnl.assets.filter((a) => a.borrowInterest > 0);
  const leg = (amount: number, symbol: string, usd: number) => (
    <>
      {fmtTokenAmount(amount)} {aaveV4DisplaySymbol(symbol)}
      {usd > 0 && <> ({fmtUsd(usd).display})</>}
    </>
  );
  const joinLegs = (nodes: React.ReactNode[]) =>
    nodes.map((n, i) => (
      <span key={i}>
        {i > 0 ? (i === nodes.length - 1 ? " and " : ", ") : null}
        {n}
      </span>
    ));
  if (earned.length > 0 || paid.length > 0) {
    items.push(
      <span key="interest-breakdown">
        {earned.length > 0 && (
          <>
            Earned {joinLegs(earned.map((a) => leg(a.supplyInterest, a.symbol, a.supplyInterestUsd)))} in supply
            interest
          </>
        )}
        {earned.length > 0 && paid.length > 0 && "; "}
        {paid.length > 0 && (
          <>
            {earned.length > 0 ? "paid " : "Paid "}
            {joinLegs(paid.map((a) => leg(a.borrowInterest, a.symbol, a.borrowInterestUsd)))} in borrow interest
          </>
        )}
        .
      </span>,
    );
  }
  if (pnl.unattributed) {
    items.push(
      <span key="unattributed">
        {pnl.hasData
          ? "Part of this position was opened through a swap aggregator, so that share's deposits aren't in the transaction record and its interest isn't included."
          : "Interest isn't shown — this position was opened through a swap aggregator, so its deposits aren't in the transaction record."}
      </span>,
    );
  }
  return items;
}

/**
 * Plain-language read of the *actual* position. Every figure is read from the
 * already-computed AaveSpokeCardInfo (HF, liq price, borrowing power, interest
 * carry, peaks), so this adds depth with no extra fetch or compute.
 *
 * BOLD RULE (same as the event explainer's <H> helper): wrap a number in
 * <strong className="text-foreground"> ONLY when that exact value is also shown
 * in a stat the reader can find outside this panel — the spoke card's headline
 * stats / footnotes (collateral, debt, HF, borrow rate, liq price, current
 * price) or the exposure tower (peak supply/debt). Figures that exist only
 * inside this prose — the LT-weighted debt ceiling, borrowing headroom to a 1.00
 * HF, net interest, per-asset interest amounts, the event count — stay in the
 * muted body tone, so a bold figure always maps to one displayed above it.
 */
function buildSpokePositionItems(spoke: AaveSpokeCardInfo): React.ReactNode[] {
  const items: React.ReactNode[] = [];
  const supplyOnly = spoke.totalDebtUsd < 1;
  const supplyStr = joinSymbols(spoke.supplyingSymbols);
  const borrowStr = joinSymbols(spoke.borrowingSymbols);

  if (supplyOnly) {
    items.push(
      <span key="composition">
        Supplies <strong className="text-foreground">{fmtUsd(spoke.totalSupplyUsd).display}</strong>
        {supplyStr && (
          <>
            {" "}
            across <span className="text-foreground/90 font-medium">{supplyStr}</span>
          </>
        )}{" "}
        with no debt drawn.
      </span>,
    );
    items.push(
      <span key="no-risk">
        With nothing borrowed, the position carries no liquidation risk — its health factor is effectively infinite.
      </span>,
    );
    if (spoke.borrowingPowerUsd > 1) {
      items.push(
        <span key="power">
          This collateral could support up to {fmtUsd(spoke.borrowingPowerUsd).display} of debt, but borrowing near that
          amount would sit the position at a 1.00 health factor — the liquidation point — so a safe borrow is lower.
        </span>,
      );
    }
    if (spoke.interestPnl?.hasData || spoke.interestPnl?.unattributed) {
      items.push(...buildInterestItems(spoke.interestPnl));
    }
  } else {
    items.push(
      <span key="composition">
        <strong className="text-foreground">{fmtUsd(spoke.totalSupplyUsd).display}</strong> of collateral
        {supplyStr && (
          <>
            {" "}
            in <span className="text-foreground/90 font-medium">{supplyStr}</span>
          </>
        )}{" "}
        backs <strong className="text-foreground">{fmtUsd(spoke.totalDebtUsd).display}</strong> of debt
        {borrowStr && (
          <>
            {" "}
            in <span className="text-foreground/90 font-medium">{borrowStr}</span>
          </>
        )}
        .
      </span>,
    );
    if (spoke.blendedLt != null && spoke.weightedCollateralUsd > 0) {
      items.push(
        <span key="collateral-basis">
          Borrowing and the health factor don&rsquo;t credit the full deposit — each asset counts only up to its
          liquidation threshold (about {Math.round(spoke.blendedLt * 100)}% of its value here). So this collateral can
          carry up to {fmtUsd(spoke.weightedCollateralUsd).display} of debt before the position becomes liquidatable.
        </span>,
      );
    }
    if (spoke.healthFactor != null) {
      items.push(
        <span key="hf">
          Health factor of <strong className="text-foreground">{hfLabel(spoke.healthFactor)}</strong>: the risk-adjusted
          collateral is worth {hfLabel(spoke.healthFactor)}× the outstanding debt, and the position becomes liquidatable
          if it falls to 1.00. This figure is read straight from Aave&rsquo;s own on-chain health-factor calculation, so
          it matches what Aave&rsquo;s interface shows.
        </span>,
      );
    }
    if (spoke.liqPrice) {
      items.push(
        <span key="liq">
          Liquidation tracks{" "}
          <span className="text-foreground/90 font-medium">{aaveV4DisplaySymbol(spoke.liqPrice.symbol)}</span>: from
          today&rsquo;s <strong className="text-foreground">{fmtLiqPrice(spoke.liqPrice.currentPrice)}</strong> it would
          have to fall to <strong className="text-foreground">{fmtLiqPrice(spoke.liqPrice.liqPrice)}</strong> — about{" "}
          {spoke.liqPrice.headroomPct.toFixed(0)}% below — to trigger one.
        </span>,
      );
    }
    if (spoke.borrowingPowerUsd > 1) {
      items.push(
        <span key="power">
          About {fmtUsd(spoke.borrowingPowerUsd).display} more of debt could be drawn before the position reaches a 1.00
          health factor — the liquidation point — so a safe additional borrow stays well below that.
        </span>,
      );
    }
    if (spoke.interestPnl?.hasData || spoke.interestPnl?.unattributed) {
      items.push(...buildInterestItems(spoke.interestPnl));
    }
    if (spoke.latestBorrowRate != null) {
      items.push(
        <span key="rate">
          The most recent borrow rate recorded on this spoke was{" "}
          <strong className="text-foreground">{spoke.latestBorrowRate.toFixed(2)}%</strong>.
        </span>,
      );
    }
  }

  // Lifetime history — event-derived peaks (same framing as the tower chart).
  // Only when a peak meaningfully exceeds the current position; a peak is always
  // ≥ current, so when they're level this bullet just restates the headline
  // collateral/debt (the first bullet) and is pure repetition. Each clause is
  // gated on its own peak so a level side never echoes its current value.
  const peakSupplyAbove = spoke.peakSupplyUsd > 1 && spoke.peakSupplyUsd > spoke.totalSupplyUsd * 1.01;
  const peakDebtAbove = spoke.peakDebtUsd > 1 && spoke.peakDebtUsd > spoke.totalDebtUsd * 1.01;
  if (peakSupplyAbove || peakDebtAbove) {
    let body: React.ReactNode;
    const supplyNode = <strong className="text-foreground">{fmtUsd(spoke.peakSupplyUsd).display}</strong>;
    const debtNode = <strong className="text-foreground">{fmtUsd(spoke.peakDebtUsd).display}</strong>;
    if (peakSupplyAbove && peakDebtAbove) {
      body = (
        <>
          supply peaked at {supplyNode} and debt at {debtNode}
        </>
      );
    } else if (peakSupplyAbove) {
      body = <>supply peaked at {supplyNode}</>;
    } else {
      body = <>debt peaked at {debtNode}</>;
    }
    items.push(
      <span key="peaks">
        Across {spoke.eventCount} event{spoke.eventCount === 1 ? "" : "s"}, {body}.
      </span>,
    );
  }

  if (spoke.wasLiquidated) {
    items.push(
      <span key="liquidated" className="text-rb-500">
        This position has been liquidated at least once — that history is permanent even if it is healthy again now.
      </span>,
    );
  }

  return items;
}

/**
 * Position explanation panel. Renders a live, data-driven read of *this*
 * position (the Aave analogue of Liquity's trove explanation). The generic
 * spoke-architecture narrative (how the spoke type works — archetype, hub
 * mapping, rate composition) lives behind the shared Learn-More modal opened
 * by the "?" affordance, mirroring Liquity's "How Redemptions Work" pattern,
 * so per-position copy stays separate from per-protocol education.
 */
export function AaveV4PositionExplanation({
  spoke,
  embedded = false,
}: {
  spoke: AaveSpokeCardInfo;
  /** When true, drop the panel chrome (bg / rounding / padding) so the
   *  explanation can sit inside a host container that already provides it —
   *  e.g. the "About this position" bar that expands into this content. */
  embedded?: boolean;
}) {
  const positionItems = buildSpokePositionItems(spoke);
  // Never-empty floor: spokes without editorial metadata fall back to the
  // generic position explainer so the "?" is always available.
  const spokeContent = aaveV4SpokeContent(spoke.name) ?? aaveV4PositionFallbackContent();

  return (
    <div
      className={
        // Muted body prose (text-rb-500) so the text-foreground highlights on
        // key figures actually pop — matches Liquity's muted+highlighted mix
        // rather than a flat single brightness.
        embedded
          ? "text-sm text-rb-500 space-y-3"
          : "rounded-lg bg-rb-100 dark:bg-rb-950 px-4 py-3 text-sm text-rb-500 space-y-3"
      }
    >
      {positionItems.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rb-500">This position</div>
          {positionItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2 leading-relaxed">
              <span className="text-rb-500 select-none">•</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}

      {spokeContent && <LearnMore content={spokeContent} />}
    </div>
  );
}
