"use client";

// Token chip with a four-tier resolution:
//   1. Local SVG sprite — covers Liquity V2's universe (ETH/WETH/wstETH/
//      stETH/rETH/BOLD), already in the icons sprite.
//   2. Trust Wallet CDN — looked up by address (caller-passed or resolved
//      from TOKEN_ADDRESSES via the symbol). Covers most established assets.
//   3. DeFiLlama icons CDN — fallback for DeFi-native assets Trust Wallet
//      hasn't indexed (cbBTC, rsETH, LBTC at time of writing).
//   4. UnknownTokenSvg placeholder — same visual vocabulary as Etherscan's
//      empty-token glyph; reads as "unknown" rather than a brand mark.
//
// Plain <img> with onError fallback (vs next/image) avoids needing a
// next.config remotePatterns entry for raw.githubusercontent.com or
// token-icons.llamao.fi. Icons are 16-20px so optimization isn't
// load-bearing.

import { createContext, useContext, useState } from "react";
import { TokenIcon as SpriteTokenIcon } from "@/components/icons/tokenIcon";
import { UnknownTokenSvg } from "@/components/shared/unknown-token-svg";
import { getTokenAddress } from "@/lib/shared/token-addresses";
import { getDefiLlamaLogoUrl, getTokenLogoUrl } from "@/lib/shared/token-logo";

const TokenFilterCtx = createContext<((symbol: string) => void) | null>(null);
export const TokenFilterProvider = TokenFilterCtx.Provider;
export function useTokenFilterCtx() {
  return useContext(TokenFilterCtx);
}

const SPRITE_SYMBOLS = new Set([
  "ETH",
  "WETH",
  "wstETH",
  "stETH",
  "rETH",
  "BOLD",
]);

// Trust Wallet doesn't host a logo for some assets, but the brand is shared
// with another asset that IS hosted. For those, look up the icon under the
// brand-mark address instead of the canonical token address. The canonical
// address used everywhere else stays correct.
const LOGO_ADDRESS_OVERRIDES: Record<string, string> = {
  // frxUSD/sfrxUSD share the FRAX brand mark (logo.png exists for v1 FRAX).
  frxUSD: "0x853d955aCEf822Db058eb8505911ED77F175b99e",
  sfrxUSD: "0x853d955aCEf822Db058eb8505911ED77F175b99e",
  // Pendle PTs have no canonical brand mark on the CDNs; reuse the underlying
  // asset's logo. Aave's UI does the same conceptually but renders a "PT"
  // badge on top — left out here pending a dedicated PT chip treatment.
  "PT-sUSDE": "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497", // sUSDe address
  "PT-USDe-7MAY2026": "0x4c9EDD5852cD905f086C759E8383e09bff1E68B3", // USDe address
};

export interface TokenChipIconProps {
  symbol: string;
  address?: string;
  size?: number;
  onClick?: () => void;
  filterable?: boolean;
}

export function TokenChipIcon({ symbol, address, size = 16, onClick, filterable = true }: TokenChipIconProps) {
  const ctxFilter = useTokenFilterCtx();
  const handler = onClick ?? (filterable && ctxFilter ? () => ctxFilter(symbol) : undefined);
  const clickable = !!handler;
  const clickProps = clickable
    ? {
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          handler!();
        },
        role: "button" as const,
        title: `Filter by ${symbol}`,
      }
    : {};
  const clickClass = clickable
    ? "cursor-pointer hover:ring-2 hover:ring-rb-400 dark:hover:ring-rb-500 rounded-full transition-shadow"
    : "";

  // Tier 1 — local sprite for the Liquity V2 universe.
  if (SPRITE_SYMBOLS.has(symbol)) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${clickClass}`}
        style={{ width: size, height: size }}
        {...clickProps}
      >
        <SpriteTokenIcon
          assetSymbol={symbol}
          className="block"
          width={size}
          height={size}
          sized
        />
      </span>
    );
  }

  // Tier 2 — Trust Wallet CDN, from caller-passed address or symbol lookup.
  // Symbol-level overrides win so brand-shared assets (frxUSD → FRAX) can
  // share an icon without polluting the canonical TOKEN_ADDRESSES map.
  // Tier 3 — UnknownTokenSvg placeholder when no address to look up (or, in
  // CdnTokenIcon below, when the CDN load fails).
  const resolvedAddress = LOGO_ADDRESS_OVERRIDES[symbol] ?? address ?? getTokenAddress(symbol);
  if (resolvedAddress) {
    return (
      <CdnTokenIcon
        symbol={symbol}
        address={resolvedAddress}
        size={size}
        clickClass={clickClass}
        clickProps={clickProps}
      />
    );
  }
  return <UnknownTokenSvg size={size} symbol={symbol} clickProps={clickProps} clickClass={clickClass} />;
}

/** Tiny inner component so we can localise the onError state per-image.
 *  Walks Trust Wallet → DeFiLlama → UnknownTokenSvg as each tier 404s. */
function CdnTokenIcon({
  symbol,
  address,
  size,
  clickClass,
  clickProps,
}: {
  symbol: string;
  address: string;
  size: number;
  clickClass: string;
  clickProps: Record<string, unknown>;
}) {
  const [tier, setTier] = useState<0 | 1 | 2>(0);
  if (tier === 2) {
    return <UnknownTokenSvg size={size} symbol={symbol} clickProps={clickProps} clickClass={clickClass} />;
  }
  const src = tier === 0 ? getTokenLogoUrl(address) : getDefiLlamaLogoUrl(address);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={tier}
      src={src}
      alt={symbol}
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${clickClass}`}
      onError={() => setTier((t) => (t === 0 ? 1 : 2))}
      {...(clickProps as React.HTMLAttributes<HTMLImageElement>)}
    />
  );
}
