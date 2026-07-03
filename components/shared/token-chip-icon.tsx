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
import { getTokenAddress, getTokenAddressInsensitive } from "@/lib/shared/token-addresses";
import { getDefiLlamaLogoUrl, getTokenLogoUrl } from "@/lib/shared/token-logo";
import { aaveV4DisplaySymbol, ptMaturityDate, ptUnderlyingSymbol } from "@/lib/aave-v4/pt-tokens";

// PT status: Aave marks a Principal Token with a colored ring around the
// underlying's logo — green while the PT is active, red once it passes the
// maturity encoded in its symbol (redeemable, no longer accruing PT yield).
//
// The preferred art path is a *baked* PNG that already has the ring drawn in —
// public/icons/tokens/<address>-active.png / <address>-expired.png — which gives
// full control over the ring (offsetting it against a same-color background,
// custom stroke, etc.) that CSS can't. `<address>` is the SAME address used for
// the logo: for a PT that's the UNDERLYING token's address (e.g. USDG's), so one
// active + one expired PNG covers every maturity of that underlying. When a baked
// PNG is present it wins and no CSS ring is drawn; when it's absent we fall back
// to the plain logo plus a CSS `ring-*` so status still shows until the art
// lands. This is the one deliberate exception to Rails' no-valence-color rule —
// it mirrors Aave's own PT convention — and the tooltip carries the literal date
// for anyone the hue doesn't reach.
const PT_MATURITY_FMT = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

type PtStatus = { state: "active" | "expired"; title: string };
function ptMaturityStatus(symbol: string): PtStatus | null {
  const maturity = ptMaturityDate(symbol);
  if (!maturity) return null;
  const expired = maturity.getTime() <= Date.now();
  const when = PT_MATURITY_FMT.format(maturity);
  return {
    state: expired ? "expired" : "active",
    title: expired
      ? `${aaveV4DisplaySymbol(symbol)} — matured ${when} · expired, no longer accruing`
      : `${aaveV4DisplaySymbol(symbol)} — matures ${when}`,
  };
}

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
};

// Pendle PTs have no canonical brand mark on the CDNs, so they reuse the
// underlying asset's logo — and since the maturity doesn't change the brand, we
// derive the underlying from the symbol (ptUnderlyingSymbol) rather than pinning
// each maturity. This resolves PT-sUSDE / PT-USDe-<date> / PT-USDG-<date> and
// any future PT listing to its underlying's address with no per-token wiring.
// Aave's UI renders a "PT" badge on top of the same logo — left out here
// pending a dedicated PT chip treatment.
function ptUnderlyingLogoAddress(symbol: string): string | null {
  const underlying = ptUnderlyingSymbol(symbol);
  return underlying ? getTokenAddressInsensitive(underlying) : null;
}

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
  // polluting the canonical TOKEN_ADDRESSES map. A PT's underlying-logo address
  // outranks the passed `address` and getTokenAddress — both would yield the
  // PT's OWN address, which has no CDN logo (→ the "P" placeholder).
  const resolvedAddress =
    LOGO_ADDRESS_OVERRIDES[symbol] ?? ptUnderlyingLogoAddress(symbol) ?? address ?? getTokenAddress(symbol);

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

  // PT maturity status → prefer a baked status PNG (ring in the art); otherwise
  // fall back to a CSS ring on whichever source wins (real logo or placeholder).
  const ptStatus = ptMaturityStatus(symbol);
  const bakedStatusIcon =
    ptStatus && resolvedAddress ? getLocalTokenIcon(`${resolvedAddress}-${ptStatus.state}`) : null;
  if (bakedStatusIcon) srcs.unshift(bakedStatusIcon);

  const ringClass =
    ptStatus && !bakedStatusIcon
      ? ptStatus.state === "expired"
        ? "ring-2 ring-red-500"
        : "ring-2 ring-emerald-500"
      : "";
  const iconTitle = ptStatus?.title;

  if (srcs.length === 0) {
    return (
      <UnknownTokenSvg
        size={size}
        symbol={symbol}
        clickProps={iconTitle ? { ...clickProps, title: iconTitle } : clickProps}
        clickClass={`${clickClass} ${ringClass}`.trim()}
      />
    );
  }
  return (
    <FallbackTokenIcon
      symbol={symbol}
      srcs={srcs}
      size={size}
      clickClass={`${clickClass} ${ringClass}`.trim()}
      clickProps={clickProps}
      title={iconTitle}
    />
  );
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
  title,
}: {
  symbol: string;
  srcs: string[];
  size: number;
  clickClass: string;
  clickProps: Record<string, unknown>;
  /** Overrides the click-affordance title (e.g. a PT maturity tooltip), and
   *  applies even when the icon isn't clickable. */
  title?: string;
}) {
  const [idx, setIdx] = useState(0);
  if (idx >= srcs.length) {
    return (
      <UnknownTokenSvg
        size={size}
        symbol={symbol}
        clickProps={title ? { ...clickProps, title } : clickProps}
        clickClass={clickClass}
      />
    );
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
      title={title ?? (clickProps as { title?: string }).title}
    />
  );
}
