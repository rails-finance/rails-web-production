// Shared liquidation indicator for Aave V4 position surfaces. Sits next to the
// status pill on both the detail card (aave-v4-spoke-card) and the listing
// card (AaveV4PositionListingCard) when the wallet has been liquidated on this
// spoke at least once. The position may still be active afterwards — this marks
// a permanent piece of position history.
//
// Form mirrors Liquity's redemption-count indicator (a bare warning triangle +
// count, no pill background): both say "this position survived a recurring
// adverse event N times." Color carries the tier — red (critical) for an Aave
// liquidation, vs Liquity's orange (caution) for a redemption. Aave positions
// can be partially liquidated repeatedly, so the count is real information.

import { Icon } from "@/components/icons/icon";

export function LiquidatedBadge({ count }: { count: number }) {
  const label = `Liquidated ${count} time${count === 1 ? "" : "s"} on this spoke`;
  return (
    <span className="inline-flex items-center text-red-500" title={label} aria-label={label}>
      <Icon name="triangle" size={12} />
      <span className="ml-1 text-xs font-semibold">{count}</span>
    </span>
  );
}
