"use client";

// Aave V4 spoke selector card. Adapted from rails-explorer's
// components/protocol/aave/aave-spoke-card.tsx — the web-mig surface only ships
// aave-v4 (no shared aave-v3 / spark code path), so the import paths point at
// the v4-namespaced versions of constants / spoke-meta.

import { useState } from "react";
import { CardSelectorShell, positionCardSurface } from "@/components/shared/card-selector-shell";
import { ClosedPositionStats } from "@/components/shared/closed-position-stats";
import { OpenPositionStats } from "@/components/shared/open-position-stats";
import { Icon } from "@/components/icons/icon";
import { InlineAssetCluster } from "@/components/shared/inline-asset-cluster";
import { StatValue, StatDash } from "@/components/shared/stat-value";
import { type HubTier } from "@/components/protocol/aave-v4/aave-v4-spoke-constants";
import { type AaveSpokeCardInfo, liquidationBuffer } from "@/lib/aave-v4/spoke-cards";
import { AaveV4LiquidationFootnote } from "@/components/protocol/aave-v4/aave-v4-liquidation-footnote";
import { bucketForHealth } from "@/lib/aave-v4/health-bucket";
import { LiquidatedBadge } from "@/components/aave-v4/LiquidatedBadge";
import { WalletPill } from "@/components/aave-v4/wallet-pill";
import { fmtUsd, hfLabel, hfColorClass } from "@/lib/aave-v4/format";
import { AaveV4PositionExplanation } from "@/components/protocol/aave-v4/aave-v4-position-explanation";
import { InfoDisclosure } from "@/components/shared/info-disclosure";

export type { AaveSpokeCardInfo };

function SpokeIdentity({ name, hub }: { name: string; hub: HubTier }) {
  return (
    <span className="flex items-center gap-1.5 leading-none text-foreground">
      <span className="text-xs font-semibold">{name}</span>
      <span className="text-xs font-bold uppercase tracking-wide">{hub}</span>
    </span>
  );
}

/** Supply-side interest earned, shown under the Collateral / Supplied stat.
 *  Deliberately the supply leg ONLY — it never folds in borrow-interest paid, so
 *  the collateral footnote can't show a debt-driven negative. Earned supply
 *  interest is already part of the collateral balance shown above (it grew it),
 *  so it reads as an "incl." figure with no sign rather than a separate signed
 *  gain — parallel to the debt side. Hidden when it rounds below a cent — dust
 *  isn't worth a line. Renders nothing without chain-truth. */
function SupplyInterestFootnote({ spoke }: { spoke: AaveSpokeCardInfo }) {
  const pnl = spoke.interestPnl;
  if (!pnl || !pnl.hasData) return null;
  const earnedUsd = pnl.assets.reduce((sum, a) => sum + a.supplyInterestUsd, 0);
  if (earnedUsd < 0.01) return null;
  const v = fmtUsd(earnedUsd);
  return (
    <div
      className="text-xs mt-0.5 font-medium text-rb-500"
      title={`${v.title} of the collateral is accrued supply interest to date — from on-chain balances vs. indexed deposits`}
    >
      incl. {v.display} interest
    </div>
  );
}

/** Debt-stat footnote: the latest borrow rate plus, when non-dust, the accrued
 *  borrow interest. Accrued interest GREW the debt — it's already part of the
 *  debt balance shown above — so it reads as "incl. $X interest" with no sign. A
 *  leading minus here would misread as the debt being reduced (it isn't); the
 *  cost stays under Debt because that's the balance it accrued into. */
function DebtFootnote({ spoke }: { spoke: AaveSpokeCardInfo }) {
  const rate = spoke.latestBorrowRate;
  const pnl = spoke.interestPnl;
  const paidUsd = pnl?.hasData ? pnl.assets.reduce((sum, a) => sum + a.borrowInterestUsd, 0) : 0;
  const interest = paidUsd >= 0.01 ? fmtUsd(paidUsd) : null;
  if (rate === null && !interest) return null;
  return (
    <div className="text-xs mt-0.5 text-rb-500 space-y-0.5">
      {rate !== null && <div>{rate.toFixed(2)}% borrow rate</div>}
      {interest && (
        <div
          title={`${interest.title} of the debt is accrued borrow interest to date — from on-chain balances vs. indexed deposits`}
        >
          incl. {interest.display} interest
        </div>
      )}
    </div>
  );
}

function AaveV4SpokeCard({
  spoke,
  isSelected,
  noHover,
  staticCard,
  onClick,
  wallet,
  ensName,
  walletHref,
}: {
  spoke: AaveSpokeCardInfo;
  isSelected: boolean;
  noHover?: boolean;
  staticCard?: boolean;
  onClick: () => void;
  /** When set, a wallet pill (facehash + addr/ENS + copy) renders alongside
   *  the spoke identity. The detail page passes this; multi-spoke selectors
   *  inside a wallet-scoped view omit it (the page header already names the
   *  wallet). */
  wallet?: string;
  ensName?: string | null;
  /** When set, the wallet pill's address becomes a link (to the wallet-filtered
   *  listing). Detail page only. */
  walletHref?: string;
}) {
  const { isClosed } = spoke;
  // Open positions carry the expandable explanation. Gate is placement: the
  // static detail card, or a non-selected card in a hoverless selector.
  const showInfo = !isClosed && ((noHover && !isSelected) || !!staticCard);
  const [infoOpen, setInfoOpen] = useState(false);
  // Supply-only collapses the card to a single "Supplied" stat (hiding the
  // Debt / HF columns). Which question decides it depends on the card's mode:
  //   - Closed card = history view: peak debt is the headline, so supply-only
  //     means the position NEVER carried real debt (peakDebt < $1).
  //   - Open card = live view: a position whose debt is now dust reads as
  //     supply-only regardless of history — a past borrow or liquidation lives
  //     in the badge + timeline, not as a live $0-Debt / ∞-HF / borrow-rate
  //     triple on the headline.
  // Underwater is the open-card exception: HF < 1 is a liquidatable fact at any
  // size, so it keeps the full risk readout rather than collapse to a lone
  // "Supplied" that contradicts its LIQUIDATABLE pill.
  const underwater = spoke.healthFactor != null && spoke.healthFactor < 1;
  const supplyOnly = isClosed ? spoke.peakDebtUsd < 1 : spoke.totalDebtUsd < 1 && !underwater;
  const bucket = bucketForHealth(spoke.healthFactor);
  const walletPill = wallet ? <WalletPill wallet={wallet} ensName={ensName ?? null} href={walletHref} /> : null;

  // Collateral USD lags when the supply asset's price is still resolving:
  // stablecoin debt prices in instantly via the categorical-price fallback, but
  // WETH / LST collateral comes from the async price provider. Rather than flash
  // a misleading "< $0.01" and then jolt to the real number, hold a skeleton
  // until the price lands. A real collateralized position is never worth
  // sub-cent, and core/plus collateral is always priceable, so
  // sub-cent-with-supplies reliably means "price still loading". The skeleton
  // sits inside a StatValue so its line-box matches the real value exactly —
  // the swap is a fade, not a reflow.
  const supplyUsdPending = spoke.supplyingSymbols.length > 0 && spoke.totalSupplyUsd < 0.01;
  const supplyValueSkeleton = (
    <StatValue color="text-foreground/80">
      <span
        className="inline-block h-[0.7em] w-20 rounded-md bg-skeleton animate-pulse align-middle"
        aria-hidden="true"
      />
    </StatValue>
  );
  return (
    <div
      onClick={onClick}
      className={`w-full text-left rounded-lg transition-all ${staticCard ? "cursor-default" : "cursor-pointer"} ${positionCardSurface(isClosed ? "closed" : "open", { noHover, staticCard, isSelected })}`}
    >
      <div className="px-5 py-4">
        {isClosed ? (
          <ClosedPositionStats
            outcome={spoke.wasLiquidated ? "liquidated" : "closed"}
            collateralAssetIcons={
              spoke.supplyingSymbols.length > 0 ? <InlineAssetCluster symbols={spoke.supplyingSymbols} /> : undefined
            }
            debtAssetIcons={
              !supplyOnly && spoke.borrowingSymbols.length > 0 ? (
                <InlineAssetCluster symbols={spoke.borrowingSymbols} />
              ) : undefined
            }
            leadingIdentity={
              <>
                <SpokeIdentity name={spoke.name} hub={spoke.hub} />
                {walletPill}
              </>
            }
            collateralLabel={supplyOnly ? "Peak Supplied" : "Peak Collateral"}
            collateral={(() => {
              const v = fmtUsd(spoke.peakSupplyUsd);
              return (
                <StatValue color="text-rb-500" title={v.title}>
                  {v.display}
                </StatValue>
              );
            })()}
            debt={
              supplyOnly
                ? undefined
                : (() => {
                    const v = fmtUsd(spoke.peakDebtUsd);
                    return (
                      <StatValue color="text-rb-500" title={v.title}>
                        {v.display}
                      </StatValue>
                    );
                  })()
            }
          />
        ) : (
          <OpenPositionStats
            statusPill={
              <span className={`font-bold px-2 py-0.5 rounded-sm text-xs ${bucket.pillClass}`}>{bucket.pillLabel}</span>
            }
            leadingIdentity={
              <>
                <SpokeIdentity name={spoke.name} hub={spoke.hub} />
                {walletPill}
              </>
            }
            identity={
              // Activity-meta cluster (top-right, matching Liquity's trove
              // cards): a neutral event count, then the red liquidation triangle
              // when present. The eventCount − liquidationCount split mirrors
              // Liquity's transactionCount − redemptionCount, so liquidations
              // (shown on the triangle) aren't double-counted in the activity
              // tally beside them.
              <span className="flex items-center gap-2 text-xs text-rb-500">
                {spoke.eventCount - spoke.liquidationCount > 0 && (
                  <span className="inline-flex items-center" title="Position events (excludes liquidations)">
                    <Icon name="arrow-left-right" size={12} />
                    <span className="ml-1">{spoke.eventCount - spoke.liquidationCount}</span>
                  </span>
                )}
                {spoke.liquidationCount > 0 && <LiquidatedBadge count={spoke.liquidationCount} />}
              </span>
            }
            columns={
              supplyOnly
                ? [
                    {
                      label: "Supplied",
                      assetIcons:
                        spoke.supplyingSymbols.length > 0 ? (
                          <InlineAssetCluster symbols={spoke.supplyingSymbols} />
                        ) : undefined,
                      value: supplyUsdPending
                        ? supplyValueSkeleton
                        : (() => {
                            const v = fmtUsd(spoke.totalSupplyUsd);
                            return (
                              <StatValue color="text-foreground/80" title={v.title}>
                                {v.display}
                              </StatValue>
                            );
                          })(),
                      footnote: <SupplyInterestFootnote spoke={spoke} />,
                    },
                    null,
                    null,
                  ]
                : [
                    {
                      // "Collateral" is the full (un-LT-weighted) market value of
                      // the supplies ENABLED as collateral — what actually backs
                      // the loan. Supplied-but-not-collateral assets are excluded
                      // (they can't be seized and don't move HF) and shown as a
                      // separate footnote. The LT weighting lives in HF + borrowing
                      // power, not in this number.
                      label: "Collateral",
                      assetIcons:
                        spoke.supplyBreakdown.collateralSymbols.length > 0 ? (
                          <InlineAssetCluster symbols={spoke.supplyBreakdown.collateralSymbols} />
                        ) : undefined,
                      value: supplyUsdPending
                        ? supplyValueSkeleton
                        : (() => {
                            const v = fmtUsd(spoke.supplyBreakdown.collateralUsd);
                            return (
                              <StatValue color="text-foreground/80" title={v.title}>
                                {v.display}
                              </StatValue>
                            );
                          })(),
                      footnote: (
                        <>
                          {spoke.supplyBreakdown.nonCollateralUsd > 0 && (
                            <div className="text-xs mt-0.5 text-rb-500">
                              + {fmtUsd(spoke.supplyBreakdown.nonCollateralUsd).display} supplied · not collateral
                            </div>
                          )}
                          <SupplyInterestFootnote spoke={spoke} />
                        </>
                      ),
                    },
                    {
                      label: "Debt",
                      assetIcons:
                        spoke.borrowingSymbols.length > 0 ? (
                          <InlineAssetCluster symbols={spoke.borrowingSymbols} />
                        ) : undefined,
                      value: (() => {
                        const v = fmtUsd(spoke.totalDebtUsd);
                        return (
                          <StatValue color="text-foreground/80" title={v.title}>
                            {v.display}
                          </StatValue>
                        );
                      })(),
                      footnote: <DebtFootnote spoke={spoke} />,
                    },
                    {
                      label: "Health Factor",
                      value:
                        spoke.healthFactor !== null ? (
                          <StatValue color={hfColorClass(spoke.healthFactor)}>{hfLabel(spoke.healthFactor)}</StatValue>
                        ) : (
                          <StatDash>{"∞"}</StatDash>
                        ),
                      // The liquidation read sits beneath HF as its tangible
                      // restatement (single collateral → price, multi → 1 − 1/HF
                      // buffer), not as a peer column — it's derived from HF.
                      // Borrowing power stays omitted (it's the gap to a 1.00 HF,
                      // which misreads as a safe-to-borrow stat).
                      footnote: <AaveV4LiquidationFootnote buf={liquidationBuffer(spoke)} />,
                    },
                  ]
            }
          />
        )}
        {/* Standard (i) at the bottom-left of the card; expands the
            explanation into a rounded panel within the card. */}
        {showInfo && (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <InfoDisclosure open={infoOpen} onToggle={() => setInfoOpen((o) => !o)} label="explanation">
              <AaveV4PositionExplanation spoke={spoke} embedded />
            </InfoDisclosure>
          </div>
        )}
      </div>
    </div>
  );
}

export interface AaveV4SpokeCardSelectorProps {
  spokes: AaveSpokeCardInfo[];
  selected: string | undefined;
  onSelect: (spokeName: string) => void;
  /** When set, every rendered card carries a wallet pill alongside the spoke
   *  identity (facehash + ENS-or-short-addr + copy). Detail page passes this
   *  so the card matches the listing-card identity row; multi-spoke selectors
   *  inside a wallet-scoped page omit it. */
  wallet?: string;
  ensName?: string | null;
  /** When set, the wallet pill's address links to the wallet-filtered listing.
   *  Detail page only. */
  walletHref?: string;
}

export function AaveV4SpokeCardSelector({
  spokes,
  selected,
  onSelect,
  wallet,
  ensName,
  walletHref,
}: AaveV4SpokeCardSelectorProps) {
  const items = spokes.map((s) => {
    const status: "open" | "closed" = s.isClosed ? "closed" : "open";
    return { ...s, id: s.name, status };
  });
  return (
    <CardSelectorShell
      items={items}
      selected={selected}
      onSelect={onSelect}
      orderItems={(list) =>
        [...list].sort((a, b) => {
          if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
          return b.totalSupplyUsd - a.totalSupplyUsd;
        })
      }
      renderCard={(item, props) => (
        <AaveV4SpokeCard
          spoke={item}
          isSelected={props.isSelected}
          noHover={props.noHover}
          staticCard={props.staticCard}
          onClick={props.onClick}
          wallet={wallet}
          ensName={ensName}
          walletHref={walletHref}
        />
      )}
    />
  );
}
