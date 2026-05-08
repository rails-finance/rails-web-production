"use client";

import { TroveSummary } from "@/types/api/trove";
import { TroveStateData } from "@/types/api/troveState";
import { OraclePricesData } from "@/types/api/oracle";
import { TroveSummaryCard } from "./TroveSummaryCard";
import { TroveListingCard } from "@/components/troves/TroveListingCard";
import { CardSelectorShell, type CardSelectorItem } from "@/components/shared/card-selector-shell";

// Wraps TroveSummaryCard in a position selector when the owner holds multiple
// troves across the protocol. Active card = full TroveSummaryCard (live state,
// oracle prices, deprecation banner). Chooser rows = TroveListingCard (compact
// form, navigates via its inner <Link>). Falls through to a bare summary card
// when there's only one trove — the shell handles the static-card case but we
// short-circuit here to avoid rendering an empty chooser column.

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

type TroveItem = TroveSummary & CardSelectorItem;

export function TroveSummaryCardSelector({
  trove,
  ownerTroves,
  liveState,
  prices,
  loadingStatus,
}: TroveSummaryCardSelectorProps) {
  const items: TroveItem[] = (() => {
    if (!ownerTroves || ownerTroves.length <= 1) {
      return [{ ...trove, id: `${trove.collateralType}:${trove.id}` }];
    }
    // Stable id includes collateral so two troves with the same numeric id on
    // different branches don't collide.
    return ownerTroves.map(t => ({ ...t, id: `${t.collateralType}:${t.id}` }));
  })();

  // No selector when there's only one trove — render the rich summary alone.
  if (items.length <= 1) {
    return (
      <TroveSummaryCard
        trove={trove}
        liveState={liveState}
        prices={prices}
        loadingStatus={loadingStatus}
      />
    );
  }

  const selectedId = `${trove.collateralType}:${trove.id}`;

  return (
    <CardSelectorShell
      items={items}
      selected={selectedId}
      onSelect={() => { /* navigation handled by TroveListingCard's inner Link */ }}
      orderItems={(list) => [...list].sort((a, b) => {
        const aTs = a.activity?.lastActivityAt ?? a.activity?.createdAt ?? 0;
        const bTs = b.activity?.lastActivityAt ?? b.activity?.createdAt ?? 0;
        return bTs - aTs;
      })}
      renderCard={(item, props) => (
        props.isActive ? (
          <TroveSummaryCard
            trove={item}
            liveState={liveState}
            prices={prices}
            loadingStatus={loadingStatus}
          />
        ) : (
          <TroveListingCard trove={item} prices={prices} />
        )
      )}
    />
  );
}
