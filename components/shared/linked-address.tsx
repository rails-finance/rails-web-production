"use client";

interface LinkedAddressProps {
  address: string;
  label?: string;
  className?: string;
}

/**
 * Renders an address as a link to its Etherscan address page.
 * Use in event explainers and detail components for cross-protocol linking.
 */
export function LinkedAddress({ address, label, className = "" }: LinkedAddressProps) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <a
      href={`https://etherscan.io/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`text-blue-500 hover:underline font-mono text-xs ${className}`}
    >
      {label || short}
    </a>
  );
}
