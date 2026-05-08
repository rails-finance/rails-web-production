"use client";

import { useState } from "react";
import { Image as ImageIcon, Link2 } from "lucide-react";
import { Icon } from "@/components/icons/icon";
import { getTroveNftUrl } from "@/lib/utils/nft-utils";

/**
 * Trove identifier pills — Trove ID + NFT/OpenSea link. The owner address
 * lives in the global header pill now, so it's not duplicated here.
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

  const pillBase =
    "inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rb-200 dark:bg-rb-900 text-xs text-rb-500 transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {troveLabel && troveId && (
        <span className={pillBase}>
          <Icon name="trove-id" size={12} />
          <span className="font-mono text-foreground">{troveLabel}</span>
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
        <a
          href={nftUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View NFT on OpenSea"
          title="View NFT on OpenSea"
          className={`${pillBase} hover:bg-rb-300 dark:hover:bg-rb-800 hover:text-foreground`}
        >
          <ImageIcon size={12} />
          <Link2 size={12} className="-rotate-45" />
        </a>
      )}
    </div>
  );
}
