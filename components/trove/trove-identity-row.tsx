"use client";

import { useState } from "react";
import { Image as ImageIcon, Link2 } from "lucide-react";
import { Icon } from "@/components/icons/icon";
import { getTroveNftUrl } from "@/lib/utils/nft-utils";

/**
 * Trove identifier — Trove ID label + NFT/OpenSea link, rendered as inline
 * text (no pill chrome) so it sits cleanly next to the status pill in the
 * summary-card header. The owner address lives in the global header pill.
 */
export function TroveIdentityRow({
  troveId,
  collateralType,
}: {
  troveId?: string;
  collateralType?: string;
}) {
  const [copiedTrove, setCopiedTrove] = useState(false);
  const troveLabel = troveId ? `${troveId.slice(0, 6)}…${troveId.slice(-4)}` : null;
  const nftUrl = collateralType && troveId ? getTroveNftUrl(collateralType, troveId) : null;

  if (!troveLabel && !nftUrl) return null;

  const copy = (value: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(value);
    setter(true);
    setTimeout(() => setter(false), 1500);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-rb-500">
      {troveLabel && troveId && (
        <span className="inline-flex items-center gap-1">
          <Icon name="trove-id" size={12} />
          <span className="font-mono">{troveLabel}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              copy(troveId, setCopiedTrove);
            }}
            aria-label={copiedTrove ? "Copied trove id" : "Copy trove id"}
            title={copiedTrove ? "Copied!" : "Copy"}
            className="text-rb-500 hover:text-foreground cursor-pointer"
          >
            <Icon name={copiedTrove ? "check" : "copy"} size={12} />
          </button>
        </span>
      )}
      {nftUrl && (
        // <button> instead of <a> because this row renders inside cards that
        // are wrapped in a Next <Link> on the listing pages — nested anchors
        // are invalid HTML and trigger a hydration warning. window.open with
        // noopener,noreferrer matches what target="_blank" + rel did.
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(nftUrl, "_blank", "noopener,noreferrer");
          }}
          aria-label="View NFT on OpenSea"
          title="View NFT on OpenSea"
          className="inline-flex items-center gap-1 text-rb-500 hover:text-foreground transition-colors cursor-pointer"
        >
          <ImageIcon size={12} />
          <Link2 size={12} className="-rotate-45" />
        </button>
      )}
    </span>
  );
}
