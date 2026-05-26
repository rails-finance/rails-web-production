"use client";

// Shared wallet identity pill — facehash + ENS-or-shortaddr label + copy
// button. Used in `leadingIdentity` on both the listing card
// (AaveV4PositionListingCard) and the detail card (AaveV4SpokeCard) so
// the address presentation is one component across surfaces.

import { useState } from "react";
import { Facehash } from "@/components/shared/facehash";
import { Icon } from "@/components/icons/icon";

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletPill({
  wallet,
  ensName,
}: {
  wallet: string;
  ensName: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const label = ensName ?? shortAddr(wallet);
  const copy = () => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <Facehash address={wallet} size={16} />
      <span className="inline-flex items-center gap-1 text-xs text-rb-500">
        <span className="font-mono text-foreground/80">{label}</span>
        <button
          type="button"
          onClick={(e) => {
            // Stop the parent link/click handler from firing when the copy
            // button is the actual target — this lets the pill live inside a
            // listing-card <Link> without navigating on every copy.
            e.preventDefault();
            e.stopPropagation();
            copy();
          }}
          aria-label={copied ? "Copied address" : "Copy address"}
          title={copied ? "Copied!" : "Copy"}
          className="text-rb-500 hover:text-foreground cursor-pointer"
        >
          <Icon name={copied ? "check" : "copy"} size={12} />
        </button>
      </span>
    </span>
  );
}
