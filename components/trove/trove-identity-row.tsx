"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Link2 } from "lucide-react";
import { Icon } from "@/components/icons/icon";
import { Facehash } from "@/components/shared/facehash";
import { FavouriteStar } from "@/components/shared/favourite-star";
import { getTroveNftUrl } from "@/lib/utils/nft-utils";

/**
 * Trove identifier — owner address + Trove ID label + NFT/OpenSea link,
 * rendered as inline text (no pill chrome) so it sits cleanly next to the
 * status pill in the summary-card header. The owner falls back to the last
 * known owner once a trove is closed/liquidated, and clicking it re-filters
 * the listing in place via `?ownerAddress=` (mono-rails convention — there's
 * no standalone address page).
 */
export function TroveIdentityRow({
  troveId,
  collateralType,
  owner,
  lastOwner,
  ownerEns,
  showFavourite = true,
  showNftLink = true,
}: {
  troveId?: string;
  collateralType?: string;
  owner?: string | null;
  lastOwner?: string | null;
  ownerEns?: string | null;
  /** Favourite-star toggle after the owner. On by default — every trove card
   *  (listing + detail, open/closed/liquidated) carries it. Pass false to
   *  suppress in a context that shouldn't offer favouriting. */
  showFavourite?: boolean;
  /** OpenSea NFT icon-link after the trove-id chip. On by default for listing
   *  cards. The open detail card passes false — its footnote carries the NFT
   *  link in plain language, so the header chip would be a redundant second
   *  copy. */
  showNftLink?: boolean;
}) {
  const router = useRouter();
  const [copiedTrove, setCopiedTrove] = useState(false);
  const [copiedOwner, setCopiedOwner] = useState(false);
  const troveLabel = troveId ? `${troveId.slice(0, 6)}…${troveId.slice(-4)}` : null;
  const nftUrl = collateralType && troveId ? getTroveNftUrl(collateralType, troveId) : null;

  // Current owner when open; the preserved last owner once closed/liquidated.
  const ownerAddress = owner ?? lastOwner ?? null;
  const isLastOwner = !owner && !!lastOwner;
  const ownerLabel = ownerEns ?? (ownerAddress ? `${ownerAddress.slice(0, 6)}…${ownerAddress.slice(-4)}` : null);

  if (!troveLabel && !nftUrl && !ownerLabel) return null;

  const copy = (value: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(value);
    setter(true);
    setTimeout(() => setter(false), 1500);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-rb-500">
      {ownerLabel && ownerAddress && (
        // <button> (not <a>) because this row renders inside cards wrapped in a
        // Next <Link> on the listing pages; a nested anchor is invalid HTML.
        // Routing to the owner-filtered listing re-filters in place.
        <span className="inline-flex items-center gap-1" title={isLastOwner ? "Last owner (trove closed)" : "Owner"}>
          <Facehash address={ownerAddress} size={16} />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(`/liquity-v2?ownerAddress=${ownerAddress}`);
            }}
            className={`font-mono hover:text-blue-500 transition-colors cursor-pointer ${isLastOwner ? "opacity-70" : ""}`}
            aria-label={`Filter troves by owner ${ownerLabel}`}
          >
            {ownerLabel}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              copy(ownerAddress, setCopiedOwner);
            }}
            aria-label={copiedOwner ? "Copied owner address" : "Copy owner address"}
            title={copiedOwner ? "Copied!" : "Copy"}
            className="text-rb-500 hover:text-foreground cursor-pointer"
          >
            <Icon name={copiedOwner ? "check" : "copy"} size={12} />
          </button>
          {showFavourite && (
            <FavouriteStar wallet={ownerAddress} ensName={ownerEns ?? null} protocol="liquity-v2" size={12} />
          )}
        </span>
      )}
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
      {nftUrl && showNftLink && (
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
          className="inline-flex items-center gap-1 text-rb-500 hover:text-pink-500 transition-colors cursor-pointer"
        >
          <ImageIcon size={12} />
          <Link2 size={12} className="-rotate-45" />
        </button>
      )}
    </span>
  );
}
