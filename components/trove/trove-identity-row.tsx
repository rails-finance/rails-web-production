"use client";

import { useState } from "react";
import { Image as ImageIcon, Link2 } from "lucide-react";
import { Icon } from "@/components/icons/icon";
import { getTroveNftUrl } from "@/lib/utils/nft-utils";

/**
 * Pill row that surfaces a trove's identity (owner address, NFT id, OpenSea
 * link) — hoisted out of the trove-summary card and trove-economics chart
 * panel so it sits between them as a standalone band. Each pill carries a
 * copy/external-link affordance; the address pill prefers an ENS name when
 * one is supplied.
 */
export function TroveIdentityRow({
  owner,
  ens,
  troveId,
  collateralType,
}: {
  owner?: string | null;
  ens?: string | null;
  troveId?: string;
  collateralType?: string;
}) {
  const [copiedOwner, setCopiedOwner] = useState(false);
  const [copiedTrove, setCopiedTrove] = useState(false);
  const ownerLabel = ens || (owner ? `${owner.slice(0, 6)}…${owner.slice(-4)}` : null);
  const troveLabel = troveId ? `${troveId.slice(0, 6)}…${troveId.slice(-4)}` : null;
  const nftUrl = collateralType && troveId ? getTroveNftUrl(collateralType, troveId) : null;

  if (!ownerLabel && !troveLabel && !nftUrl) return null;

  const copy = (value: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(value);
    setter(true);
    setTimeout(() => setter(false), 1500);
  };

  const pillBase =
    "inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rb-200 dark:bg-rb-900 text-xs text-rb-500 transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ownerLabel && owner && (
        <span className={pillBase}>
          <Icon name="user" size={12} />
          <span className="font-mono text-foreground">{ownerLabel}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              copy(owner, setCopiedOwner);
            }}
            aria-label={copiedOwner ? "Copied owner address" : "Copy owner address"}
            title={copiedOwner ? "Copied!" : "Copy"}
            className="text-rb-500 hover:text-foreground cursor-pointer"
          >
            <Icon name={copiedOwner ? "check" : "copy"} size={12} />
          </button>
        </span>
      )}
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
