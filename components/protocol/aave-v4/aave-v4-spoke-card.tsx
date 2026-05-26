"use client";

// Aave V4 spoke selector card. Adapted from rails-explorer's
// components/protocol/aave/aave-spoke-card.tsx — the web-mig surface only ships
// aave-v4 (no shared aave-v3 / spark code path), so the import paths point at
// the v4-namespaced versions of constants / spoke-meta.

import { useState } from "react";
import {
  CardSelectorShell,
  positionCardSurface,
} from "@/components/shared/card-selector-shell";
import { ClosedPositionStats } from "@/components/shared/closed-position-stats";
import { OpenPositionStats } from "@/components/shared/open-position-stats";
import { InlineAssetCluster } from "@/components/shared/inline-asset-cluster";
import { StatValue, StatDash } from "@/components/shared/stat-value";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { getSpokeMeta, ARCHETYPE_LABEL, ARCHETYPE_ACCENT } from "@/lib/aave-v4/spoke-meta";
import { type HubTier } from "@/components/protocol/aave-v4/aave-v4-spoke-constants";
import type { AaveSpokeCardInfo } from "@/lib/aave-v4/spoke-cards";
import { bucketForHealth } from "@/lib/aave-v4/health-bucket";
import { LiquidatedBadge } from "@/components/aave-v4/LiquidatedBadge";
import { WalletPill } from "@/components/aave-v4/wallet-pill";
import { fmtUsd, hfLabel, hfColorClass, fmtLiqPrice } from "@/lib/aave-v4/format";

export type { AaveSpokeCardInfo };

function SpokeIdentity({ name, hub }: { name: string; hub: HubTier }) {
  return (
    <span className="flex items-center gap-1.5 leading-none text-foreground">
      <span className="text-xs font-semibold">{name}</span>
      <span className="text-xs font-bold uppercase tracking-wide">{hub}</span>
    </span>
  );
}

/**
 * Spoke-architecture narrative panel surfaced from the (i) info button on
 * the active position card. Editorial copy lives in lib/aave-v4/spoke-meta.ts.
 */
function SpokeNarrativePanel({ spokeName }: { spokeName: string }) {
  const meta = getSpokeMeta(spokeName);
  if (!meta) return null;
  const accent = ARCHETYPE_ACCENT[meta.archetype];
  const archetypeLabel = ARCHETYPE_LABEL[meta.archetype];
  const sameHub = meta.collateralHub === meta.borrowHub;
  return (
    <div className={`mt-3 rounded-md border ${accent.border} ${accent.bg} px-3 py-2 space-y-2`}>
      <div className="flex items-center gap-3 text-xs">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${accent.text} shrink-0`}>
          {archetypeLabel}
        </span>
        <span className="text-rb-500 truncate">
          {sameHub ? (
            <>Collateral and borrow in <span className="text-foreground/80 font-semibold">{meta.collateralHub} Hub</span></>
          ) : (
            <>
              Collateral in <span className="text-foreground/80 font-semibold">{meta.collateralHub} Hub</span>
              {" · borrow drawn from "}
              <span className="text-foreground/80 font-semibold">{meta.borrowHub} Hub</span>
            </>
          )}
        </span>
      </div>
      <div className="pt-2 border-t border-rb-300/30 dark:border-rb-700/40 space-y-2 text-xs text-foreground/80 leading-relaxed">
        {meta.narrative.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        {meta.rateNote && (
          <p className={`mt-1 pl-2 border-l-2 ${accent.border} text-rb-500 italic`}>
            {meta.rateNote}
          </p>
        )}
      </div>
    </div>
  );
}

function SpokeInfoButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-expanded={isOpen}
      aria-label={isOpen ? "Hide spoke details" : "Show spoke details"}
      className="inline-flex items-center justify-center rounded transition-colors text-rb-500 hover:text-rb-400 cursor-pointer"
    >
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
          clipRule="evenodd"
        />
      </svg>
    </button>
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
}) {
  const { isClosed } = spoke;
  const showInfo = !isClosed && getSpokeMeta(spoke.name) != null && (
    (noHover && !isSelected) || !!staticCard
  );
  const [infoOpen, setInfoOpen] = useState(false);
  const supplyOnly = spoke.peakDebtUsd < 1 && spoke.totalDebtUsd < 1;
  const bucket = bucketForHealth(spoke.healthFactor);
  const walletPill = wallet ? (
    <WalletPill wallet={wallet} ensName={ensName ?? null} />
  ) : null;
  return (
    <div
      onClick={onClick}
      className={`w-full text-left rounded-lg transition-all ${staticCard ? "cursor-default" : "cursor-pointer"} ${positionCardSurface(isClosed ? "closed" : "open", { noHover, staticCard, isSelected })}`}
    >
      <div className="px-5 py-4">
        {isClosed ? (
          <ClosedPositionStats
            outcome={spoke.wasLiquidated ? "liquidated" : "closed"}
            collateralAssetIcons={spoke.supplyingSymbols.length > 0 ? (
              <InlineAssetCluster symbols={spoke.supplyingSymbols} />
            ) : undefined}
            debtAssetIcons={!supplyOnly && spoke.borrowingSymbols.length > 0 ? (
              <InlineAssetCluster symbols={spoke.borrowingSymbols} />
            ) : undefined}
            leadingIdentity={
              <>
                <SpokeIdentity name={spoke.name} hub={spoke.hub} />
                {walletPill}
              </>
            }
            collateralLabel={supplyOnly ? "Peak Supplied" : "Peak Collateral"}
            collateral={(() => {
              const v = fmtUsd(spoke.peakSupplyUsd);
              return <StatValue color="text-rb-500" title={v.title}>{v.display}</StatValue>;
            })()}
            debt={supplyOnly ? undefined : (() => {
              const v = fmtUsd(spoke.peakDebtUsd);
              return <StatValue color="text-rb-500" title={v.title}>{v.display}</StatValue>;
            })()}
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
            identity={showInfo ? (
              <SpokeInfoButton isOpen={infoOpen} onClick={() => setInfoOpen((o) => !o)} />
            ) : undefined}
            columns={supplyOnly ? [
              {
                label: "Supplied",
                assetIcons: spoke.supplyingSymbols.length > 0 ? (
                  <InlineAssetCluster symbols={spoke.supplyingSymbols} />
                ) : undefined,
                value: (() => {
                  const v = fmtUsd(spoke.totalSupplyUsd);
                  return <StatValue color="text-blue-400" title={v.title}>{v.display}</StatValue>;
                })(),
              },
              null,
              null,
              null,
            ] : [
              {
                label: "Collateral",
                assetIcons: spoke.supplyingSymbols.length > 0 ? (
                  <InlineAssetCluster symbols={spoke.supplyingSymbols} />
                ) : undefined,
                value: (() => {
                  const v = fmtUsd(spoke.totalSupplyUsd);
                  return <StatValue color="text-blue-400" title={v.title}>{v.display}</StatValue>;
                })(),
                footnote: spoke.netApy !== null ? (
                  <div className={`text-xs mt-0.5 font-medium ${spoke.netApy >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {spoke.netApy >= 0 ? "+" : ""}{spoke.netApy.toFixed(2)}% net APY
                  </div>
                ) : undefined,
              },
              {
                label: "Debt",
                assetIcons: spoke.borrowingSymbols.length > 0 ? (
                  <InlineAssetCluster symbols={spoke.borrowingSymbols} />
                ) : undefined,
                value: (() => {
                  const v = fmtUsd(spoke.totalDebtUsd);
                  return <StatValue color="text-emerald-400" title={v.title}>{v.display}</StatValue>;
                })(),
                footnote: spoke.latestBorrowRate !== null ? (
                  <div className="text-xs mt-0.5 text-rb-500">
                    {spoke.latestBorrowRate.toFixed(2)}% borrow rate
                  </div>
                ) : undefined,
              },
              {
                label: "Health Factor",
                value: spoke.healthFactor !== null ? (
                  <StatValue color={hfColorClass(spoke.healthFactor)}>
                    {hfLabel(spoke.healthFactor)}
                  </StatValue>
                ) : (
                  <StatDash>{"∞"}</StatDash>
                ),
                footnote: spoke.borrowingPowerUsd > 0.01 ? (() => {
                  const v = fmtUsd(spoke.borrowingPowerUsd);
                  return (
                    <div className="text-xs mt-0.5 text-rb-500" title={v.title}>
                      {v.display} borrowing power
                    </div>
                  );
                })() : undefined,
              },
              {
                label: spoke.liqPrice ? `Liq Price (${spoke.liqPrice.symbol})` : "Liq Price",
                value: spoke.liqPrice ? (
                  <StatValue color="text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {fmtLiqPrice(spoke.liqPrice.liqPrice)}
                      <TokenChipIcon symbol={spoke.liqPrice.symbol} size={18} />
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
            ]}
          />
        )}
        {showInfo && infoOpen && <SpokeNarrativePanel spokeName={spoke.name} />}
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
}

export function AaveV4SpokeCardSelector({
  spokes,
  selected,
  onSelect,
  wallet,
  ensName,
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
      orderItems={(list) => [...list].sort((a, b) => {
        if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
        return b.totalSupplyUsd - a.totalSupplyUsd;
      })}
      renderCard={(item, props) => (
        <AaveV4SpokeCard
          spoke={item}
          isSelected={props.isSelected}
          noHover={props.noHover}
          staticCard={props.staticCard}
          onClick={props.onClick}
          wallet={wallet}
          ensName={ensName}
        />
      )}
    />
  );
}
