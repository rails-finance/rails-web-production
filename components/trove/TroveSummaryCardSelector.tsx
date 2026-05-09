"use client";

import Link from "next/link";
import { TroveSummary } from "@/types/api/trove";
import { TroveStateData } from "@/types/api/troveState";
import { OraclePricesData } from "@/types/api/oracle";
import { TroveSummaryCard } from "./TroveSummaryCard";
import { CardSelectorShell, type CardSelectorItem } from "@/components/shared/card-selector-shell";

// Wraps TroveSummaryCard in a position selector when the owner holds multiple
// troves across the protocol. Active card and chooser rows share the same rich
// content shape (TroveSummaryCard) — only the wrapper styling and click target
// differ. Falls through to a bare summary card when there's only one trove.

interface TroveSummaryCardSelectorProps {
  trove: TroveSummary;
  /** All troves owned by the same wallet (including the active one). When
   *  undefined or empty, renders the bare summary card with no selector. */
  ownerTroves?: TroveSummary[];
  liveState?: TroveStateData;
  prices?: OraclePricesData;
  loadingStatus?: {
    message: string | null;
    snapshotDate?: number;
  };
}

interface TroveItem extends CardSelectorItem {
  trove: TroveSummary;
}

export function TroveSummaryCardSelector({
  trove,
  ownerTroves,
  liveState,
  prices,
  loadingStatus,
}: TroveSummaryCardSelectorProps) {
  // No selector when there's only one trove — render the rich summary alone.
  if (!ownerTroves || ownerTroves.length <= 1) {
    return (
      <TroveSummaryCard
        trove={trove}
        liveState={liveState}
        prices={prices}
        loadingStatus={loadingStatus}
        expectsLiveState
      />
    );
  }

  const items: TroveItem[] = ownerTroves.map(t => ({ id: t.id, trove: t }));

  return (
    <CardSelectorShell
      items={items}
      selected={trove.id}
      onSelect={() => { /* chooser rows navigate via their <Link> wrapper */ }}
      orderItems={(list) => [...list].sort((a, b) => {
        const aTs = a.trove.activity?.lastActivityAt ?? a.trove.activity?.createdAt ?? 0;
        const bTs = b.trove.activity?.lastActivityAt ?? b.trove.activity?.createdAt ?? 0;
        return bTs - aTs;
      })}
      renderCard={(item, props) => (
        props.isActive ? (
          // Active card — at rest just hover-tints (the chevron signals a
          // chooser is available). When the chooser is expanded we add the
          // blue border + bg so it visually stands apart from the alternates
          // below. Mirrors rails-explorer Aave V4 selector behavior.
          <div
            onClick={props.onClick}
            className={
              "w-full text-left rounded-lg transition-all cursor-pointer px-5 py-4 " +
              (props.isSelected
                ? "border border-blue-500/30 bg-blue-500/5 group-hover/card:bg-blue-500/10"
                : "border border-transparent group-hover/card:bg-rb-200/50 dark:group-hover/card:bg-rb-900")
            }
          >
            <TroveSummaryCard
              trove={item.trove}
              liveState={liveState}
              prices={prices}
              loadingStatus={loadingStatus}
              expectsLiveState
            />
          </div>
        ) : (
          // Chooser row — same content shape as the active card, transparent
          // at rest, rb-tint on chevron-hover, blue border on direct hover.
          // The <Link> owns navigation; no liveState (snapshot data only).
          <Link
            href={`/trove/${item.trove.collateralType}/${item.trove.id}`}
            className="block w-full text-left rounded-lg transition-all cursor-pointer border border-transparent group-hover/card:bg-rb-200/50 dark:group-hover/card:bg-rb-900 hover:border-blue-500 px-5 py-4"
          >
            <TroveSummaryCard trove={item.trove} prices={prices} />
          </Link>
        )
      )}
    />
  );
}
