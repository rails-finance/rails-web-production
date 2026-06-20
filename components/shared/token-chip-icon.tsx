"use client";

// Token chip with a single render path and an ordered source fallback:
//   1. Local PNG by symbol — the curated, self-hosted set in
//      public/icons/tokens (e.g. usdc.png, wbtc.png, eth.png).
//   2. Local PNG by address — for assets stored under their token address
//      rather than a symbol (e.g. LINK/USDT/EURC).
//   3. Trust Wallet CDN — by address, for anything not self-hosted.
//   4. DeFiLlama icons CDN — for DeFi-native assets Trust Wallet hasn't
//      indexed (cbBTC, rsETH, LBTC at time of writing).
//   5. UnknownTokenSvg placeholder — same visual vocabulary as Etherscan's
//      empty-token glyph; reads as "unknown" rather than a brand mark.
//
// Every source renders through the same <img> at the full `size` envelope —
// no per-source scaling. Earlier code special-cased SVG sprites at 0.88x to
// guess around CDN logo padding; that magic number was right for some logos
// and wrong for others (sprites came out visibly smaller than CDN icons in
// the same cluster). Consolidating onto the curated local PNGs, which are
// uniformly full-bleed, removes the guesswork. See getLocalTokenIcon.
//
// Plain <img> with onError fallback (vs next/image) avoids needing a
// next.config remotePatterns entry for raw.githubusercontent.com or
// token-icons.llamao.fi. Icons are 16-28px so optimization isn't
// load-bearing.

import { createContext, useContext, useState } from "react";
import { UnknownTokenSvg } from "@/components/shared/unknown-token-svg";
import { getLocalTokenIcon } from "@/lib/shared/local-token-icons";
import { getTokenAddress } from "@/lib/shared/token-addresses";
import { getDefiLlamaLogoUrl, getTokenLogoUrl } from "@/lib/shared/token-logo";

const TokenFilterCtx = createContext<((symbol: string) => void) | null>(null);
export const TokenFilterProvider = TokenFilterCtx.Provider;
export function useTokenFilterCtx() {
  return useContext(TokenFilterCtx);
}

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

  // Build the ordered source list. Symbol-level address overrides win so
  // brand-shared assets (frxUSD → FRAX) borrow another asset's logo without
  // polluting the canonical TOKEN_ADDRESSES map.
  const resolvedAddress = LOGO_ADDRESS_OVERRIDES[symbol] ?? address ?? getTokenAddress(symbol);

  const srcs: string[] = [];
  // 1. Local PNG by symbol (the curated set is mostly symbol-named).
  const localBySymbol = getLocalTokenIcon(symbol);
  if (localBySymbol) srcs.push(localBySymbol);
  // 2. Local PNG by address (LINK/USDT/EURC etc. are address-named only).
  if (resolvedAddress) {
    const localByAddress = getLocalTokenIcon(resolvedAddress);
    if (localByAddress && localByAddress !== localBySymbol) srcs.push(localByAddress);
    // 3 + 4. CDN tiers, by address.
    srcs.push(getTokenLogoUrl(resolvedAddress), getDefiLlamaLogoUrl(resolvedAddress));
  }

  if (srcs.length === 0) {
    return <UnknownTokenSvg size={size} symbol={symbol} clickProps={clickProps} clickClass={clickClass} />;
  }
  return <FallbackTokenIcon symbol={symbol} srcs={srcs} size={size} clickClass={clickClass} clickProps={clickProps} />;
}

/** Renders the first source that loads, advancing through the ordered list on
 *  each onError and ending at UnknownTokenSvg once every source has 404'd.
 *  State is per-instance so one failed icon doesn't disturb its siblings. */
function FallbackTokenIcon({
  symbol,
  srcs,
  size,
  clickClass,
  clickProps,
}: {
  symbol: string;
  srcs: string[];
  size: number;
  clickClass: string;
  clickProps: Record<string, unknown>;
}) {
  const [idx, setIdx] = useState(0);
  if (idx >= srcs.length) {
    return <UnknownTokenSvg size={size} symbol={symbol} clickProps={clickProps} clickClass={clickClass} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={idx}
      src={srcs[idx]}
      alt={symbol}
      width={size}
      height={size}
      className={`block shrink-0 rounded-full ${clickClass}`}
      onError={() => setIdx((i) => i + 1)}
      {...(clickProps as React.HTMLAttributes<HTMLImageElement>)}
    />
  );
}
