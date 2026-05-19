"use client";

// Position-card selector for LlamaLend wallets — renders one card per
// currently-open (controller, positionEpoch) lifecycle. Closed and
// liquidated lifecycles live in the timeline below the selector; this
// surface intentionally shows only what the user can still act on.
//
// Lineage: ported from rails-explorer's
// components/shared/llamalend-position-card-selector.tsx. Differences from
// the explorer card:
//   - Reads the rails-server-mig wire shape (LlamalendPosition from
//     lib/api/fetch-llamalend) rather than the explorer's derived
//     LlamalendPositionCardInfo. The two are structurally compatible at the
//     fields this card consumes.
//   - Renders open positions only — no ClosedPositionStats path. Closed
//     lifecycles surface as event cards in the timeline.
//   - Bands column is text-only (n1..n2, band width). Visual bands pill is
//     deferred to follow-up C2 — bands viz, gated on LLAMMA constants
//     (B6) for accurate band-edge math.
//
// Health badge uses the simulator's soft-liq-onset price as a proxy: when the
// oracle is above it the position is safe and the headroom maps to a tone;
// when below, soft-liq is already active. Oracle prices come from the page's
// PricesProvider — collateral tokens enrol via useRequestPrices on mount.

import { useMemo } from "react";
import {
  CardSelectorShell,
  positionCardSurface,
} from "@/components/shared/card-selector-shell";
import { OpenPositionStats } from "@/components/shared/open-position-stats";
import { StatValue, StatDash, StatFootnote } from "@/components/shared/stat-value";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { MarketPill } from "@/components/protocol/llamalend/llamalend-market-pill";
import { BandsPriceAxis } from "@/components/protocol/llamalend/bands-price-axis";
import { formatCompact } from "@/lib/shared/format-event";
import { simulateLlamalendPosition } from "@/lib/llamalend/simulate";
import { computeBandRange } from "@/lib/llamalend/bands";
import { usePrices, useRequestPrices } from "@/lib/shared/prices-context";
import type { LlamalendPosition } from "@/lib/api/fetch-llamalend";

function headlineDebt(n: number) {
  return formatCompact(n, { decimals: 2 });
}

function headlineColl(n: number) {
  return formatCompact(n);
}

interface CardItem extends LlamalendPosition {
  id: string;
}

function LlamalendPositionCard({
  position,
  isSelected,
  noHover,
  staticCard,
  onClick,
  collPrice,
}: {
  position: LlamalendPosition;
  isSelected: boolean;
  noHover?: boolean;
  staticCard?: boolean;
  onClick: () => void;
  collPrice?: number;
}) {
  const bandWidth =
    position.n1 !== null && position.n2 !== null
      ? Math.abs(position.n2 - position.n1) + 1
      : null;

  // Soft-liq onset proxy: debt / (coll · (1 − discount)). When oracle is
  // present we can also express it as headroom %.
  const health =
    collPrice && collPrice > 0 && position.collateral > 0 && position.debt > 0
      ? (() => {
          const sim = simulateLlamalendPosition({
            coll: position.collateral,
            debt: position.debt,
            price: collPrice,
            liquidationDiscount: position.liquidationDiscount ?? 0.06,
          });
          const headroomPct = ((collPrice - sim.softLiqPrice) / collPrice) * 100;
          const status: "safe" | "warning" | "danger" | "liquidating" =
            sim.underwater || headroomPct < 0
              ? "liquidating"
              : headroomPct < 10
                ? "danger"
                : headroomPct < 30
                  ? "warning"
                  : "safe";
          return { headroomPct, softLiqPrice: sim.softLiqPrice, status };
        })()
      : null;

  const healthColorClass =
    health?.status === "safe"
      ? "text-emerald-400"
      : health?.status === "warning"
        ? "text-amber-400"
        : health?.status === "danger"
          ? "text-red-400"
          : health?.status === "liquidating"
            ? "text-red-500"
            : "";
  const healthLabel =
    health?.status === "safe"
      ? "Safe"
      : health?.status === "warning"
        ? "Warning"
        : health?.status === "danger"
          ? "Danger"
          : health?.status === "liquidating"
            ? "Liquidating"
            : "";

  const shortController = `${position.controller.slice(0, 6)}…${position.controller.slice(-4)}`;
  const identityNode = (
    <span className="flex items-center gap-1.5">
      <MarketPill info={position} />
      <span className="font-mono text-xs text-rb-500" title={position.controller}>
        {shortController}
      </span>
    </span>
  );

  // Bands axis: render when LLAMMA constants resolved and oracle price known.
  // pUp/pDown come from `lib/llamalend/bands` using on-chain A + base_price;
  // falls back to the simulator's soft-liq-onset price when constants are
  // missing (e.g. cold cache, very new market). Matches the explorer's
  // `llamalend-economics` rendering policy.
  const bandsAxisProps = (() => {
    if (!collPrice || !(collPrice > 0)) return null;
    if (!(position.collateral > 0) || !(position.debt > 0)) return null;
    const exactRange = computeBandRange({
      ammA: position.ammA,
      ammBasePrice: position.ammBasePrice,
      n1: position.n1,
      n2: position.n2,
    });
    if (exactRange) {
      return {
        oraclePrice: collPrice,
        pUp: exactRange.pUp,
        pDown: exactRange.pDown,
        bandWidth: exactRange.bandWidth,
        exact: true,
      };
    }
    if (health && health.softLiqPrice > 0) {
      return {
        oraclePrice: collPrice,
        pUp: health.softLiqPrice,
        pDown: undefined,
        bandWidth:
          position.n1 !== null && position.n2 !== null
            ? Math.abs(position.n2 - position.n1) + 1
            : null,
        exact: false,
      };
    }
    return null;
  })();

  return (
    <div
      onClick={onClick}
      className={`w-full text-left rounded-lg transition-all ${
        staticCard ? "cursor-default" : "cursor-pointer"
      } ${positionCardSurface("open", { noHover, staticCard, isSelected })}`}
    >
      <div className="px-5 py-4">
        <OpenPositionStats
          identity={identityNode}
          columns={[
            {
              label: "Collateral",
              headerIcon: (
                <TokenChipIcon
                  symbol={position.collateralSymbol}
                  address={position.collateralToken}
                  size={16}
                />
              ),
              value: (() => {
                const c = headlineColl(Math.max(0, position.collateral));
                return <StatValue title={c.title}>{c.display}</StatValue>;
              })(),
            },
            {
              label: "Debt",
              headerIcon: (
                <TokenChipIcon
                  symbol={position.borrowedSymbol}
                  address={position.borrowedToken}
                  size={16}
                />
              ),
              value: (() => {
                const d = headlineDebt(Math.max(0, position.debt));
                return <StatValue title={d.title}>{d.display}</StatValue>;
              })(),
            },
            {
              label: "Health",
              value: health ? (
                <StatValue color={healthColorClass}>
                  {health.headroomPct.toFixed(1)}%
                  <span className="text-xs font-normal ml-1.5">{healthLabel}</span>
                </StatValue>
              ) : (
                <StatDash />
              ),
              footnote: health && health.softLiqPrice > 0 ? (
                <StatFootnote>
                  Soft liq ≈ $
                  {health.softLiqPrice < 10
                    ? health.softLiqPrice.toFixed(2)
                    : Math.round(health.softLiqPrice).toLocaleString()}
                </StatFootnote>
              ) : undefined,
            },
            {
              label: "Bands",
              value:
                position.n1 !== null && position.n2 !== null ? (
                  <StatValue title={`n1 ${position.n1} / n2 ${position.n2}`}>
                    <span className="font-mono">
                      {position.n1}..{position.n2}
                    </span>
                  </StatValue>
                ) : (
                  <StatDash />
                ),
              footnote:
                bandWidth !== null ? (
                  <StatFootnote>
                    {bandWidth} band{bandWidth === 1 ? "" : "s"} wide
                  </StatFootnote>
                ) : undefined,
            },
          ]}
        />
        {bandsAxisProps && (
          <div
            className="mt-4 pt-3 border-t border-rb-200/40 dark:border-rb-800/40"
            onClick={(e) => e.stopPropagation()}
          >
            <BandsPriceAxis
              collateralSymbol={position.collateralSymbol}
              collateralAddress={position.collateralToken}
              debtSymbol={position.borrowedSymbol}
              oraclePrice={bandsAxisProps.oraclePrice}
              pUp={bandsAxisProps.pUp}
              pDown={bandsAxisProps.pDown}
              bandWidth={bandsAxisProps.bandWidth}
              exact={bandsAxisProps.exact}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export interface LlamalendPositionCardSelectorProps {
  positions: LlamalendPosition[];
  /** Composite key `${controller}:${positionEpoch}` */
  selected: string | undefined;
  /** Called with `${controller}:${positionEpoch}` when a card is picked. */
  onSelect: (positionKey: string) => void;
}

export function LlamalendPositionCardSelector({
  positions,
  selected,
  onSelect,
}: LlamalendPositionCardSelectorProps) {
  // Enrol every collateral token in the page-level price cache. The provider
  // batches and dedupes, so we don't need a per-protocol allowlist.
  const collateralAddresses = useMemo(
    () => positions.map((p) => p.collateralToken).filter(Boolean),
    [positions],
  );
  useRequestPrices(collateralAddresses);
  const prices = usePrices();

  if (positions.length === 0) return null;

  const items: CardItem[] = positions.map((p) => ({
    ...p,
    id: `${p.controller}:${p.positionEpoch}`,
  }));

  return (
    <CardSelectorShell
      items={items}
      selected={selected}
      onSelect={onSelect}
      orderItems={(list) =>
        [...list].sort((a, b) => b.debt - a.debt || b.lastTimestamp - a.lastTimestamp)
      }
      renderCard={(item, props) => (
        <LlamalendPositionCard
          position={item}
          isSelected={props.isSelected}
          noHover={props.noHover}
          staticCard={props.staticCard}
          onClick={props.onClick}
          collPrice={item.collateralToken ? prices[item.collateralToken.toLowerCase()] : undefined}
        />
      )}
    />
  );
}
