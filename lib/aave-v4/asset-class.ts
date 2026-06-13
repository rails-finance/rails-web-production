// Coarse asset classification for plain-language position summaries. Neutral,
// descriptive buckets only — no risk valence (see memory feedback-no-opinionated-color).
// "correlated" describes price behaviour (these move with ETH / BTC), not a judgement.

import { isStable } from "./liquidation-thresholds";

export type AssetClass = "eth" | "btc" | "stablecoin" | "gold" | "other";

const ETH_CORRELATED = new Set<string>([
  "ETH",
  "WETH",
  "stETH",
  "wstETH",
  "weETH",
  "rsETH",
  "ETHx",
  "osETH",
  "cbETH",
  "rETH",
  "ezETH",
  "rswETH",
]);
const BTC_CORRELATED = new Set<string>(["WBTC", "cbBTC", "LBTC", "tBTC", "BTCB", "eBTC", "swBTC"]);
const GOLD = new Set<string>(["XAUt", "PAXG"]);

/** Bucket a token symbol. Stablecoins are resolved via the simulator's
 *  STABLE_SYMBOLS set (covers USD + EUR fiat stables and Ethena dollars). */
export function assetClass(symbol: string): AssetClass {
  if (ETH_CORRELATED.has(symbol)) return "eth";
  if (BTC_CORRELATED.has(symbol)) return "btc";
  if (GOLD.has(symbol)) return "gold";
  if (isStable(symbol)) return "stablecoin";
  return "other";
}

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  eth: "ETH-correlated",
  btc: "BTC-correlated",
  stablecoin: "stablecoin",
  gold: "gold",
  other: "other",
};
