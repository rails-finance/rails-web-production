"use client";

// Aave V4 spoke selector card. Adapted from rails-explorer's
// components/protocol/aave/aave-spoke-card.tsx — the web-mig surface only ships
// aave-v4 (no shared aave-v3 / spark code path), so the import paths point at
// the v4-namespaced versions of constants / spoke-meta.

import { useState } from "react";
import { CardSelectorShell, positionCardSurface } from "@/components/shared/card-selector-shell";
import { ClosedPositionStats } from "@/components/shared/closed-position-stats";
import { OpenPositionStats } from "@/components/shared/open-position-stats";
import { InlineAssetCluster } from "@/components/shared/inline-asset-cluster";
import { StatValue, StatDash } from "@/components/shared/stat-value";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { type HubTier } from "@/components/protocol/aave-v4/aave-v4-spoke-constants";
import type { AaveSpokeCardInfo } from "@/lib/aave-v4/spoke-cards";
import { bucketForHealth } from "@/lib/aave-v4/health-bucket";
import { LiquidatedBadge } from "@/components/aave-v4/LiquidatedBadge";
import { WalletPill } from "@/components/aave-v4/wallet-pill";
import { fmtUsd, hfLabel, hfColorClass, fmtLiqPrice, fmtSignedUsd } from "@/lib/aave-v4/format";
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

/** Chain-faithful net-interest footnote ("+$12 net interest" / "−$46 net
 *  interest"): supply interest earned minus borrow interest paid, computed from
 *  chain-truth balances vs. indexed deposits — no rate involved. Replaces the
 *  old inferred net-APY footnote. Neutral tone: the sign carries the meaning,
 *  per Rails' no-opinionated-color rule. Renders nothing without chain-truth. */
function InterestFootnote({ spoke }: { spoke: AaveSpokeCardInfo }) {
  const pnl = spoke.interestPnl;
  if (!pnl || !pnl.hasData) return null;
  const v = fmtSignedUsd(pnl.netUsd);
  return (
    <div
      className="text-xs mt-0.5 font-medium text-rb-500"
      title={`${v.title} net interest — supply interest earned minus borrow interest paid, from on-chain balances vs. deposits`}
    >
      {v.display} net interest
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
  // A sub-$1 debt position normally reads as supply-only (dust debt is noise
  // beside a real supply — e.g. after a near-full repay). The exception is an
  // underwater position: HF < 1 is a liquidatable on-chain fact at any size, so
  // it must keep the full risk readout (HF / Net APY / Debt / Liq Price) rather
  // than collapse to a lone "Supplied" stat that contradicts its UNDERWATER pill.
  const underwater = spoke.healthFactor != null && spoke.healthFactor < 1;
  const supplyOnly = spoke.peakDebtUsd < 1 && spoke.totalDebtUsd < 1 && !underwater;
  const bucket = bucketForHealth(spoke.healthFactor);
  const walletPill = wallet ? <WalletPill wallet={wallet} ensName={ensName ?? null} href={walletHref} /> : null;
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
              <span className={`font-bold tracking-wider px-2 py-0.5 rounded-xs text-xs ${bucket.pillClass}`}>
                {bucket.pillLabel}
              </span>
            }
            leadingIdentity={
              <>
                {spoke.wasLiquidated && <LiquidatedBadge />}
                <SpokeIdentity name={spoke.name} hub={spoke.hub} />
                {walletPill}
              </>
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
                      value: (() => {
                        const v = fmtUsd(spoke.totalSupplyUsd);
                        return (
                          <StatValue color="text-foreground/80" title={v.title}>
                            {v.display}
                          </StatValue>
                        );
                      })(),
                      footnote: <InterestFootnote spoke={spoke} />,
                    },
                    null,
                    null,
                    null,
                  ]
                : [
                    {
                      label: "Collateral",
                      assetIcons:
                        spoke.supplyingSymbols.length > 0 ? (
                          <InlineAssetCluster symbols={spoke.supplyingSymbols} />
                        ) : undefined,
                      value: (() => {
                        const v = fmtUsd(spoke.totalSupplyUsd);
                        return (
                          <StatValue color="text-foreground/80" title={v.title}>
                            {v.display}
                          </StatValue>
                        );
                      })(),
                      footnote: <InterestFootnote spoke={spoke} />,
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
                      footnote:
                        spoke.latestBorrowRate !== null ? (
                          <div className="text-xs mt-0.5 text-rb-500">
                            {spoke.latestBorrowRate.toFixed(2)}% borrow rate
                          </div>
                        ) : undefined,
                    },
                    {
                      label: "Health Factor",
                      value:
                        spoke.healthFactor !== null ? (
                          <StatValue color={hfColorClass(spoke.healthFactor)}>{hfLabel(spoke.healthFactor)}</StatValue>
                        ) : (
                          <StatDash>{"∞"}</StatDash>
                        ),
                      footnote:
                        spoke.borrowingPowerUsd > 0.01
                          ? (() => {
                              const v = fmtUsd(spoke.borrowingPowerUsd);
                              return (
                                <div className="text-xs mt-0.5 text-rb-500" title={v.title}>
                                  {v.display} borrowing power
                                </div>
                              );
                            })()
                          : undefined,
                    },
                    {
                      label: spoke.liqPrice ? `Liq Price (${spoke.liqPrice.symbol})` : "Liq Price",
                      value: spoke.liqPrice ? (
                        <StatValue color="text-foreground/80">
                          <span className="inline-flex items-center gap-1.5">
                            {fmtLiqPrice(spoke.liqPrice.liqPrice)}
                            <TokenChipIcon symbol={spoke.liqPrice.symbol} size={28} />
                          </span>
                        </StatValue>
                      ) : (
                        <StatDash />
                      ),
                      footnote: spoke.liqPrice ? (
                        <div className="text-xs mt-0.5 text-rb-500">
                          {spoke.liqPrice.headroomPct.toFixed(0)}% headroom
                        </div>
                      ) : undefined,
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
