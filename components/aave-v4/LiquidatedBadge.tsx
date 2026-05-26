// Shared LIQUIDATED pill for Aave V4 position surfaces. Sits next to the
// status pill on both the detail card (aave-v4-spoke-card) and the listing
// card (AaveV4PositionListingCard) when the wallet has been liquidated on
// this spoke at least once. The position may still be active afterwards —
// the badge marks a permanent piece of position history.

export function LiquidatedBadge() {
  return (
    <span
      title="This wallet was liquidated on this spoke at least once"
      className="font-bold tracking-wider px-2 py-0.5 text-white bg-red-500 rounded-xs text-xs"
    >
      LIQUIDATED
    </span>
  );
}
