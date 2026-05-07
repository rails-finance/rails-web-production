'use client';

import { WalletLink } from "@/components/wallet/wallet-dropdown";

interface LinkedAddressProps {
  address: string;
  label?: string;
  className?: string;
}

/**
 * Renders an address as a clickable link to `/address/[address]`.
 * Use in event explainers and detail components for cross-protocol linking.
 */
export function LinkedAddress({ address, label, className = "" }: LinkedAddressProps) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <WalletLink
      address={address}
      className={`text-blue-400 hover:text-blue-500 font-mono text-xs transition-colors ${className}`}
    >
      {label || short}
    </WalletLink>
  );
}
