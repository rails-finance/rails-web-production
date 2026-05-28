/**
 * Per-spoke × per-reserve liquidation thresholds for Aave V4.
 *
 * These drive the simulator's health-factor math:
 *   HF = Σ(collateral_i × price_i × LT_i) / Σ(debt_j × price_j)
 * so we need the real per-asset LT (not the aggregate "weighted LT" the on-chain
 * `getUserAccountData` returns — that's a function of the *current* collateral
 * mix and moves the moment a slider moves).
 *
 * Hardcoded rather than fetched on-demand because:
 *   1. Aave V4 LTs are governance-set and change ≲3×/year
 *   2. No per-reserve RPC selector is wired client-side; adding one just for
 *      the simulator would pay 10+ eth_call per sim open
 *   3. Keeps the simulator a pure client-side calculation
 *
 * Refresh these values from https://app.aave.com/markets/ or governance posts
 * whenever V4 risk params change. Reserve symbol set is kept in sync with
 * RESERVE_MAP in `lib/sieve/loaders/aave-v4.ts`.
 *
 * Values are LT fractions in [0, 1]. Zero means the reserve cannot be used as
 * collateral on that spoke (borrow-only listing).
 */

export interface SpokeLtTable {
  /** Liquidation threshold per reserve symbol. Missing keys → 0 (borrow-only). */
  lt: Record<string, number>;
  /** If true, unmapped reserves fall back to a conservative LT rather than 0.
   *  Used for evolving spokes where we don't want to silently zero-out a new
   *  listing. */
  fallbackLt?: number;
}

/** Default when a symbol isn't listed for any spoke. Intentionally pessimistic
 *  so the simulator's HF doesn't flatter an unknown position. */
const DEFAULT_UNKNOWN_LT = 0.7;

const LT_BY_SPOKE: Record<string, SpokeLtTable> = {
  "Main": {
    lt: {
      WETH:   0.825,
      wstETH: 0.79,
      weETH:  0.75,
      WBTC:   0.78,
      cbBTC:  0.78,
      AAVE:   0.73,
      LINK:   0.70,
      USDC:   0.78,
      USDT:   0.76,
      EURC:   0.75,
      USDG:   0.75,
      frxUSD: 0.75,
      GHO:    0.75,
      RLUSD:  0,    // borrow-only as of 2026-05; CF 0% on pro.aave.com
    },
  },
  "Bluechip": {
    lt: {
      WETH:   0.86,
      WBTC:   0.82,
      cbBTC:  0.82,
      wstETH: 0.83,
      USDC:   0.80,
      USDT:   0.78,
      EURC:   0,    // borrow-only as of 2026-05 (LT unconfirmed)
      GHO:    0.77,
      frxUSD: 0.77,
    },
  },
  "Ethena Correlated": {
    // Correlated-asset pool: sUSDe/USDe/PT-sUSDE are all Ethena-backed dollars,
    // so LTs are very high.
    lt: {
      "PT-USDe-7MAY2026": 0,    // borrow-only as of 2026-05 (LT unconfirmed)
      "PT-sUSDE":         0.91,
      sUSDe:              0.92,
      USDe:               0.92,
    },
  },
  "Ethena Ecosystem": {
    lt: {
      "PT-sUSDE": 0.78,
      sUSDe:      0,    // borrow-only as of 2026-05 (LT unconfirmed)
      USDe:       0.80,
      USDC:       0.78,
      USDT:       0.77,
      GHO:        0.77,
      frxUSD:     0.77,
    },
  },
  "EtherFi": {
    lt: {
      weETH: 0.93,
      WETH:  0.90,
    },
  },
  "Forex": {
    lt: {
      EURC:   0.87,
      USDC:   0.85,
      USDT:   0.82,
      USDG:   0,    // borrow-only as of 2026-05 (LT unconfirmed)
      frxUSD: 0,    // borrow-only as of 2026-05 (LT unconfirmed)
      GHO:    0.82,
    },
  },
  "Gold": {
    lt: {
      XAUt:   0.75,
      USDC:   0.78,
      USDG:   0.78,
      frxUSD: 0.77,
      USDT:   0.76,
      EURC:   0,    // borrow-only as of 2026-05 (LT unconfirmed)
      GHO:    0,    // borrow-only as of 2026-05 (LT unconfirmed)
    },
  },
  "Kelp": {
    lt: {
      rsETH: 0.93,
      WETH:  0.90,
    },
  },
  "Lido": {
    lt: {
      wstETH: 0.93,
      WETH:   0.92,
    },
  },
  "Lombard": {
    lt: {
      LBTC: 0.80,
      WBTC: 0,    // borrow-only as of 2026-05 (LT unconfirmed)
    },
    // Lombard *was* a single-collateral spoke; WBTC has since been added as a
    // second listing (borrow-only). Fallback retained so any future surprise
    // reserve still gets a conservative HF rather than a silent zero.
    fallbackLt: DEFAULT_UNKNOWN_LT,
  },
};

/** Resolve LT for a (spoke, symbol) pair. Returns 0 for unknown reserves on
 *  spokes without a fallback (matches on-chain behaviour for borrow-only
 *  listings). */
export function getLiquidationThreshold(spokeName: string, symbol: string): number {
  const table = LT_BY_SPOKE[spokeName];
  if (!table) return DEFAULT_UNKNOWN_LT;
  const direct = table.lt[symbol];
  if (direct != null) return direct;
  return table.fallbackLt ?? 0;
}

/** Symbols the simulator treats as $1 rails — no price slider, no USD conversion. */
export const STABLE_SYMBOLS = new Set<string>([
  "USDC", "USDT", "DAI", "GHO", "EURC", "USDG", "frxUSD", "RLUSD",
  "USDe", "sUSDe", "PT-sUSDE", "PT-USDe-7MAY2026", "LUSD", "BOLD",
]);

export function isStable(symbol: string): boolean {
  return STABLE_SYMBOLS.has(symbol);
}
