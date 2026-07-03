/**
 * Aave V4 liquidation-threshold helpers.
 *
 * There is intentionally NO hardcoded per-spoke LT table here any more. Aave V4
 * exposes no static per-reserve liquidation threshold on-chain (getReserve /
 * getReserveConfig return collateralRisk = 0; the effective collateral factor is
 * resolved off-reserve by the hub/risk module), so the only trustworthy source
 * is the chain itself. The server now harvests the true LT for each (spoke,
 * reserve) from getUserAccountData.avgCollateralFactor on single-collateral
 * positions (rails-server-mig chain-refresher harvest-lt) and writes it to
 * aave_v4_reserves.liquidation_threshold; it rides the wire on every chain
 * reserve as `reserves[].lt`. The simulator reads that value (see
 * patchReservesWithChain / patchSpokeCardWithChain). The earlier `LT_BY_SPOKE`
 * hand-maintained table had drifted stale-low by up to 800bps and is gone.
 *
 * `AAVE_V4_FALLBACK_LT` is the single conservative value used only in the rare
 * no-chain fallback (a position whose chain read failed / never ran, so no
 * per-reserve lt is available). It's intentionally pessimistic so the
 * simulator's HF / liq price never flatters such a position.
 */

/** Conservative LT used only when no chain-truth LT is available for a reserve. */
export const AAVE_V4_FALLBACK_LT = 0.7;

/** Symbols the simulator treats as $1 rails — no price slider, no USD conversion. */
export const STABLE_SYMBOLS = new Set<string>([
  "USDC",
  "USDT",
  "DAI",
  "GHO",
  "EURC",
  "USDG",
  "frxUSD",
  "RLUSD",
  "USDe",
  "sUSDe",
  "PT-sUSDE",
  "PT-USDe-7MAY2026",
  "PT-USDG-24SEP2026",
  "LUSD",
  "BOLD",
]);

export function isStable(symbol: string): boolean {
  return STABLE_SYMBOLS.has(symbol);
}
