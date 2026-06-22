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
  // Always go through CardSelectorShell, even when there's only one trove
  // (or while the sibling-trove fetch is still in flight) — the shell
  // reserves the chevron column slot in both cases, so the position card
  // sits at a consistent inner width and the supplementary stats below
  // (`pl-5 pr-12` in TroveSummaryStack) line up to its grid.
  // TroveIds are unique only within a collateral branch, so an owner holding
  // troves across WETH/wstETH/rETH can produce the same numeric id twice. Key
  // the selector by the composite (collateral + id) the trove URL already uses
  // — otherwise the shell duplicates React keys and `find(selected)` can match
  // the wrong-branch trove.
  const itemId = (t: { collateralType: string; id: string }) => `${t.collateralType}-${t.id}`;
  const items: TroveItem[] =
    ownerTroves && ownerTroves.length > 0
      ? ownerTroves.map((t) => ({ id: itemId(t), trove: t }))
      : [{ id: itemId(trove), trove }];

  return (
    <CardSelectorShell
      items={items}
      selected={itemId(trove)}
      onSelect={() => {
        /* chooser rows navigate via their <Link> wrapper */
      }}
      orderItems={(list) =>
        [...list].sort((a, b) => {
          const aTs = a.trove.activity?.lastActivityAt ?? a.trove.activity?.createdAt ?? 0;
          const bTs = b.trove.activity?.lastActivityAt ?? b.trove.activity?.createdAt ?? 0;
          return bTs - aTs;
        })
      }
      renderCard={(item, props) =>
        props.isActive ? (
          // Active card — at rest just hover-tints (the chevron signals a
          // chooser is available). When the chooser is expanded we add the
          // blue border + bg so it visually stands apart from the alternates
          // below. Mirrors rails-explorer Aave V4 selector behavior. When
          // there's no chooser to open (single trove), the click handler is
          // a noop and the static-card branch keeps the styling neutral.
          <div
            onClick={props.onClick}
            className={
              "w-full text-left rounded-lg transition-all px-5 py-4 " +
              (props.staticCard ? "" : "cursor-pointer ") +
              (props.isSelected
                ? "border border-blue-500/30 bg-blue-500/5 group-hover/card:bg-blue-500/10"
                : "border border-transparent " + (props.staticCard ? "" : "group-hover/card:bg-blue-500/10"))
            }
          >
            <TroveSummaryCard
              trove={item.trove}
              liveState={liveState}
              prices={prices}
              loadingStatus={loadingStatus}
              expectsLiveState
              showActivityMeta="counts"
            />
          </div>
        ) : (
          // Chooser row — same content shape as the active card, transparent
          // at rest, rb-tint on chevron-hover, blue border on direct hover.
          // The <Link> owns navigation; no liveState (snapshot data only).
          <Link
            href={`/liquity-v2/trove/${item.trove.collateralType}/${item.trove.id}`}
            className="block w-full text-left rounded-lg transition-all cursor-pointer border border-transparent group-hover/card:bg-blue-500/10 hover:border-blue-500 px-5 py-4"
          >
            <TroveSummaryCard trove={item.trove} prices={prices} showActivityMeta={false} />
          </Link>
        )
      }
    />
  );
}
