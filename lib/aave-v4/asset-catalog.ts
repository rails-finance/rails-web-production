/**
 * Aave V4 per-spoke asset catalogs. Drives the simulator's add-position picker
 * — when a user wants to model "what if I supplied some WBTC I don't currently
 * hold", this is the source of truth for which symbols the spoke accepts and
 * what their LTs would be.
 *
 * Built by joining two existing sources:
 *   1. RESERVE_MAP in `lib/sieve/loaders/aave-v4.ts` — gives addresses + which
 *      reserves are actually listed per spoke.
 *   2. LT_BY_SPOKE in `lib/aave-v4/liquidation-thresholds.ts` — gives the LT
 *      governance has set for each (spoke, reserve) pair.
 *
 * Refresh whenever Aave V4 risk params change. Listings are governance-set and
 * change ≲3×/year, so a static table beats per-render RPC.
 */

import type { AssetCatalog, CatalogAsset } from "@/lib/protocols/asset-catalog";
import { getLiquidationThreshold } from "./liquidation-thresholds";

interface RawReserve {
  symbol: string;
  address: `0x${string}`;
}

/** Per-spoke listed reserves (symbol + address). Mirrors the RESERVE_MAP in
 *  `lib/sieve/loaders/aave-v4.ts` but keyed by spoke *name* instead of address
 *  so it joins cleanly with LT_BY_SPOKE. */
const SPOKE_RESERVES: Record<string, RawReserve[]> = {
  Main: [
    { symbol: "WETH",   address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
    { symbol: "wstETH", address: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0" },
    { symbol: "weETH",  address: "0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee" },
    { symbol: "WBTC",   address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599" },
    { symbol: "cbBTC",  address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf" },
    { symbol: "AAVE",   address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9" },
    { symbol: "LINK",   address: "0x514910771af9ca656af840dff83e8264ecf986ca" },
    { symbol: "USDC",   address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
    { symbol: "USDT",   address: "0xdac17f958d2ee523a2206206994597c13d831ec7" },
    { symbol: "EURC",   address: "0x1abaea1f7c830bd89acc67ec4af516284b1bc33c" },
    { symbol: "USDG",   address: "0xe343167631d89b6ffc58b88d6b7fb0228795491d" },
    { symbol: "frxUSD", address: "0xcacd6fd266af91b8aed52accc382b4e165586e29" },
    { symbol: "GHO",    address: "0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f" },
  ],
  Bluechip: [
    { symbol: "WETH",   address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
    { symbol: "WBTC",   address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599" },
    { symbol: "cbBTC",  address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf" },
    { symbol: "wstETH", address: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0" },
    { symbol: "USDC",   address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
    { symbol: "USDT",   address: "0xdac17f958d2ee523a2206206994597c13d831ec7" },
    { symbol: "GHO",    address: "0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f" },
    { symbol: "frxUSD", address: "0xcacd6fd266af91b8aed52accc382b4e165586e29" },
  ],
  "Ethena Correlated": [
    { symbol: "PT-sUSDE", address: "0x3de0ff76e8b528c092d47b9dac775931cef80f49" },
    { symbol: "sUSDe",    address: "0x9d39a5de30e57443bff2a8307a4256c8797a3497" },
    { symbol: "USDe",     address: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3" },
  ],
  "Ethena Ecosystem": [
    { symbol: "PT-sUSDE", address: "0x3de0ff76e8b528c092d47b9dac775931cef80f49" },
    { symbol: "USDe",     address: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3" },
    { symbol: "USDC",     address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
    { symbol: "USDT",     address: "0xdac17f958d2ee523a2206206994597c13d831ec7" },
    { symbol: "GHO",      address: "0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f" },
    { symbol: "frxUSD",   address: "0xcacd6fd266af91b8aed52accc382b4e165586e29" },
  ],
  EtherFi: [
    { symbol: "weETH", address: "0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee" },
    { symbol: "WETH",  address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
  ],
  Forex: [
    { symbol: "EURC", address: "0x1abaea1f7c830bd89acc67ec4af516284b1bc33c" },
    { symbol: "USDC", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
    { symbol: "USDT", address: "0xdac17f958d2ee523a2206206994597c13d831ec7" },
    { symbol: "GHO",  address: "0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f" },
  ],
  Gold: [
    { symbol: "XAUt",   address: "0x68749665ff8d2d112fa859aa293f07a622782f38" },
    { symbol: "USDC",   address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
    { symbol: "USDG",   address: "0xe343167631d89b6ffc58b88d6b7fb0228795491d" },
    { symbol: "frxUSD", address: "0xcacd6fd266af91b8aed52accc382b4e165586e29" },
    { symbol: "USDT",   address: "0xdac17f958d2ee523a2206206994597c13d831ec7" },
  ],
  Kelp: [
    { symbol: "rsETH", address: "0xa1290d69c65a6fe4df752f95823fae25cb99e5a7" },
    { symbol: "WETH",  address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
  ],
  Lido: [
    { symbol: "wstETH", address: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0" },
    { symbol: "WETH",   address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
  ],
  "Lombard BTC": [
    { symbol: "LBTC", address: "0x8236a87084f8b84306f72007f36f2618a5634494" },
  ],
};

/** Spoke names exposed by V4 deployment. Used by the picker UI to validate scope. */
export const V4_SPOKE_NAMES: ReadonlyArray<string> = Object.keys(SPOKE_RESERVES);

function buildSpokeCatalog(spokeName: string): AssetCatalog {
  const reserves = SPOKE_RESERVES[spokeName] ?? [];
  // Lombard's catalog is keyed under "Lombard" in LT_BY_SPOKE but its display
  // name is "Lombard BTC" — same spoke, two labels in different files. Pass
  // both keys to getLiquidationThreshold so we resolve LTs either way.
  const ltKey = spokeName === "Lombard BTC" ? "Lombard" : spokeName;
  const assets: CatalogAsset[] = reserves.map(r => {
    const lt = getLiquidationThreshold(ltKey, r.symbol);
    return {
      symbol: r.symbol,
      address: r.address,
      canSupply: true,
      canBorrow: true,
      canCollateral: lt > 0,
      lt: lt > 0 ? lt : undefined,
    };
  });
  return { protocol: "aave-v4", scope: spokeName, assets };
}

const CATALOG_BY_SPOKE: Record<string, AssetCatalog> = Object.fromEntries(
  V4_SPOKE_NAMES.map(name => [name, buildSpokeCatalog(name)]),
);

/** Resolve the listing catalog for a V4 spoke by its display name (matches
 *  the `spokeName` field on simulator props and event context). Returns null
 *  for unknown spokes — callers should fall back to "no add-row support". */
export function getAaveV4Catalog(spokeName: string): AssetCatalog | null {
  return CATALOG_BY_SPOKE[spokeName] ?? null;
}
