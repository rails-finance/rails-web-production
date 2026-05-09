"use client";

import { TroveSummary } from "@/types/api/trove";
import { OpenListingCard } from "./OpenListingCard";
import { ClosedListingCard } from "./CloseListingCard";
import { LiquidatedListingCard } from "./LiquidatedListingCard";
import { OraclePricesData } from "@/types/api/oracle";

interface TroveListingCardProps {
  trove: TroveSummary;
  prices?: OraclePricesData | null;
  /** Strips the card's own background/rounding/View pill so it can sit inside
   *  a position-selector wrapper that owns the border + hover affordances. */
  selectorMode?: boolean;
}

export function TroveListingCard({ trove, prices, selectorMode = false }: TroveListingCardProps) {
  if (trove.status === "liquidated") {
    return <LiquidatedListingCard trove={trove} selectorMode={selectorMode} />;
  }

  if (trove.status === "open") {
    return <OpenListingCard trove={trove} prices={prices} selectorMode={selectorMode} />;
  }

  return <ClosedListingCard trove={trove} selectorMode={selectorMode} />;
}
