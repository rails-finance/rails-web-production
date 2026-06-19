// Shared LIQUIDATED pill for Aave V4 position surfaces. Sits next to the
// status pill on both the detail card (aave-v4-spoke-card) and the listing
// card (AaveV4PositionListingCard) when the wallet has been liquidated on
// this spoke at least once. The position may still be active afterwards —
// the badge marks a permanent piece of position history.

export function LiquidatedBadge() {
  return (
    <span
      title="This wallet was liquidated on this spoke at least once"
      className="font-bold px-2 py-0.5 rounded-sm text-xs bg-red-500/20 text-red-500"
    >
      Liquidated
    </span>
  );
}
