"use client";

// Plain-language, data-driven explanation of an Aave V4 spoke position — the
// Aave analogue of Liquity's useTroveExplanationItems. Lifted out of
// aave-v4-spoke-card.tsx so it can render either inside the card or, in the
// "About this position" layout, as a standalone panel above the stats card.

import type { AaveSpokeCardInfo } from "@/lib/aave-v4/spoke-cards";
import { getSpokeMeta, ARCHETYPE_LABEL, ARCHETYPE_ACCENT } from "@/lib/aave-v4/spoke-meta";
import { fmtUsd, hfLabel, hfColorClass, fmtLiqPrice } from "@/lib/aave-v4/format";
import { aaveV4DisplaySymbol } from "@/lib/aave-v4/pt-tokens";

// Oxford-join a list of asset symbols for prose ("wstETH, WBTC and USDC").
function joinSymbols(syms: string[]): string {
  const names = syms.map(aaveV4DisplaySymbol);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Plain-language read of the *actual* position. Every figure is read from the
 * already-computed AaveSpokeCardInfo (HF, liq price, borrowing power, net APY,
 * peaks), so this adds depth with no extra fetch or compute.
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
        {supplyStr && <> across <span className="text-foreground/90 font-medium">{supplyStr}</span></>} with no debt drawn.
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
          Up to <strong className="text-foreground">{fmtUsd(spoke.borrowingPowerUsd).display}</strong> could be borrowed
          against this collateral before reaching the liquidation threshold.
        </span>,
      );
    }
    if (spoke.netApy != null) {
      items.push(
        <span key="apy">
          The supplied balance earns roughly <strong className="text-green-400">{spoke.netApy.toFixed(2)}%</strong> APY at
          the most recent supply rate.
        </span>,
      );
    }
  } else {
    items.push(
      <span key="composition">
        <strong className="text-foreground">{fmtUsd(spoke.totalSupplyUsd).display}</strong> of collateral
        {supplyStr && <> in <span className="text-foreground/90 font-medium">{supplyStr}</span></>} backs{" "}
        <strong className="text-foreground">{fmtUsd(spoke.totalDebtUsd).display}</strong> of debt
        {borrowStr && <> in <span className="text-foreground/90 font-medium">{borrowStr}</span></>}.
      </span>,
    );
    if (spoke.healthFactor != null) {
      items.push(
        <span key="hf">
          Health factor of <strong className={hfColorClass(spoke.healthFactor)}>{hfLabel(spoke.healthFactor)}</strong>:
          the risk-adjusted collateral is worth {hfLabel(spoke.healthFactor)}× the outstanding debt, and the position
          becomes liquidatable if it falls to 1.00.
        </span>,
      );
    }
    if (spoke.liqPrice) {
      items.push(
        <span key="liq">
          Liquidation tracks <span className="text-foreground/90 font-medium">{aaveV4DisplaySymbol(spoke.liqPrice.symbol)}</span>:
          from today&rsquo;s <strong className="text-foreground">{fmtLiqPrice(spoke.liqPrice.currentPrice)}</strong> it would
          have to fall to <strong className="text-foreground">{fmtLiqPrice(spoke.liqPrice.liqPrice)}</strong> — about{" "}
          {spoke.liqPrice.headroomPct.toFixed(0)}% below — to trigger one.
        </span>,
      );
    }
    if (spoke.borrowingPowerUsd > 1) {
      items.push(
        <span key="power">
          Roughly <strong className="text-foreground">{fmtUsd(spoke.borrowingPowerUsd).display}</strong> of additional
          borrowing power remains before the liquidation threshold.
        </span>,
      );
    }
    if (spoke.netApy != null) {
      items.push(
        spoke.netApy >= 0 ? (
          <span key="apy">
            The position nets <strong className="text-green-400">+{spoke.netApy.toFixed(2)}%</strong> APY on equity —
            supply yield outpaces borrow cost.
          </span>
        ) : (
          <span key="apy">
            Borrow cost outweighs supply yield, for a net <strong className="text-red-400">{spoke.netApy.toFixed(2)}%</strong>{" "}
            APY on equity.
          </span>
        ),
      );
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
  if (spoke.peakSupplyUsd > 1 || spoke.peakDebtUsd > 1) {
    items.push(
      <span key="peaks">
        Across <strong className="text-foreground">{spoke.eventCount}</strong> event{spoke.eventCount === 1 ? "" : "s"},
        supply peaked at <strong className="text-foreground">{fmtUsd(spoke.peakSupplyUsd).display}</strong>
        {spoke.peakDebtUsd > 1 && (
          <> and debt at <strong className="text-foreground">{fmtUsd(spoke.peakDebtUsd).display}</strong></>
        )}.
      </span>,
    );
  }

  if (spoke.wasLiquidated) {
    items.push(
      <span key="liquidated" className="text-red-400/90">
        This position has been liquidated at least once — that history is permanent even if it is healthy again now.
      </span>,
    );
  }

  return items;
}

/**
 * Position explanation panel. Leads with a live, data-driven read of *this*
 * position (the Aave analogue of Liquity's trove explanation), then the
 * spoke-architecture narrative from lib/aave-v4/spoke-meta.ts. Neutral panel
 * styling mirrors the Liquity explanation (components/trove/TroveContextRow.tsx)
 * so both rails read alike.
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
  const meta = getSpokeMeta(spoke.name);
  const accent = meta ? ARCHETYPE_ACCENT[meta.archetype] : null;
  const archetypeLabel = meta ? ARCHETYPE_LABEL[meta.archetype] : null;
  const sameHub = meta ? meta.collateralHub === meta.borrowHub : false;
  const positionItems = buildSpokePositionItems(spoke);

  return (
    <div
      className={
        embedded
          ? "text-sm text-foreground/90 space-y-3"
          : "rounded-lg bg-rb-100 dark:bg-rb-950 px-4 py-3 text-sm text-foreground/90 space-y-3"
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

      {meta && (
        <div className="pt-2 border-t border-rb-300/30 dark:border-rb-700/40 space-y-2 text-foreground/90 leading-relaxed">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rb-500">How this spoke works</div>
          {/* Archetype + hub mapping folded in as the lead bullet so it sits
              with the rest of the list rather than as a separate header. */}
          <div className="flex items-start gap-2">
            <span className="text-rb-500 select-none">•</span>
            <span>
              {accent && archetypeLabel && (
                <span className={`text-[10px] font-bold uppercase tracking-wider ${accent.text} mr-1.5`}>
                  {archetypeLabel}
                </span>
              )}
              {sameHub ? (
                <>Collateral and borrow in <span className="text-foreground/90 font-semibold">{meta.collateralHub} Hub</span>.</>
              ) : (
                <>
                  Collateral in <span className="text-foreground/90 font-semibold">{meta.collateralHub} Hub</span>, borrow drawn from{" "}
                  <span className="text-foreground/90 font-semibold">{meta.borrowHub} Hub</span>.
                </>
              )}
            </span>
          </div>
          {meta.narrative.map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-rb-500 select-none">•</span>
              <span>{line}</span>
            </div>
          ))}
          {meta.rateNote && accent && (
            <p className={`mt-1 pl-2 border-l-2 ${accent.border} text-rb-500 italic`}>
              {meta.rateNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
