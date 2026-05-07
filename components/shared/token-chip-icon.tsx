"use client";

// rails-web-mig token chip — a thin wrapper that resolves Liquity V2 tokens
// (BOLD, WETH/ETH, wstETH, rETH) to the existing SVG-sprite TokenIcon.
//
// rails-explorer's version pulls in the full token-addresses + Trust Wallet
// CDN system. rails-web-mig only renders Liquity V2 events, where the
// universe of tokens is small and already covered by the local sprite.
// Unknown symbols fall back to UnknownTokenSvg.

import { createContext, useContext } from "react";
import { TokenIcon as SpriteTokenIcon } from "@/components/icons/tokenIcon";
import { UnknownTokenSvg } from "@/components/shared/unknown-token-svg";

// Token filter context — kept for source compatibility with rails-explorer's
// timeline. rails-web-mig has no filter UI yet, so this is always null.
const TokenFilterCtx = createContext<((symbol: string) => void) | null>(null);
export const TokenFilterProvider = TokenFilterCtx.Provider;
export function useTokenFilterCtx() {
  return useContext(TokenFilterCtx);
}

const KNOWN_SYMBOLS = new Set([
  "ETH",
  "WETH",
  "wstETH",
  "stETH",
  "rETH",
  "BOLD",
]);

export interface TokenChipIconProps {
  symbol: string;
  address?: string;
  size?: number;
  onClick?: () => void;
  filterable?: boolean;
}

export function TokenChipIcon({ symbol, size = 16, onClick, filterable = true }: TokenChipIconProps) {
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

  if (!KNOWN_SYMBOLS.has(symbol)) {
    return <UnknownTokenSvg size={size} symbol={symbol} clickProps={clickProps} clickClass={clickClass} />;
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${clickClass}`}
      style={{ width: size, height: size }}
      {...clickProps}
    >
      <SpriteTokenIcon assetSymbol={symbol} className="block" width={size} height={size} />
    </span>
  );
}
