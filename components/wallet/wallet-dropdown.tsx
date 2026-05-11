"use client";

// Stub for rails-explorer's WalletLink primitive.
//
// rails-explorer's WalletLink wraps Next's <Link> with hover dropdown UI
// (avatar, recent activity preview, etc.). rails-web-mig doesn't have that
// surface, so this is just a thin Link wrapper preserving the same prop
// contract used by `LinkedAddress`. Promote to the richer component when
// the address page lands in a later sub-step.

import Link from "next/link";
import type { ReactNode } from "react";

export interface WalletLinkProps {
  address: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function WalletLink({ address, children, className, onClick }: WalletLinkProps) {
  return (
    <Link
      href={`/address/${address}`}
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}
