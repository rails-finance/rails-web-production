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

// Wrapper item — keeps the original TroveSummary unmutated so TroveListingCard's
// inner <Link> builds the right `/trove/<branch>/<id>` href. Trove ids are
// uint256 hashes (cross-branch collision is effectively impossible), so we can
// use the bare id as the shell's selector key.
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
      />
    );
  }

  const items: TroveItem[] = ownerTroves.map(t => ({ id: t.id, trove: t }));

  return (
    <CardSelectorShell
      items={items}
      selected={trove.id}
      onSelect={() => { /* navigation handled by TroveListingCard's inner Link */ }}
      orderItems={(list) => [...list].sort((a, b) => {
        const aTs = a.trove.activity?.lastActivityAt ?? a.trove.activity?.createdAt ?? 0;
        const bTs = b.trove.activity?.lastActivityAt ?? b.trove.activity?.createdAt ?? 0;
        return bTs - aTs;
      })}
      renderCard={(item, props) => (
        props.isActive ? (
          // Whole-card click toggles the chooser, mirroring rails-explorer.
          // Inner buttons (copy badge, deprecation link) still bubble — that's
          // acceptable noise; users get an expand/collapse flicker on those
          // clicks but the primary action (copy / navigate) still fires.
          <div onClick={props.onClick} className="cursor-pointer">
            <TroveSummaryCard
              trove={item.trove}
              liveState={liveState}
              prices={prices}
              loadingStatus={loadingStatus}
            />
          </div>
        ) : (
          <TroveListingCard trove={item.trove} prices={prices} />
        )
      )}
    />
  );
}
