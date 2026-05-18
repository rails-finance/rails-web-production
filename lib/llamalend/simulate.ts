/**
 * Pure simulation for a Curve LlamaLend / crvUSD position.
 *
 * LLAMMA doesn't expose a single "liquidation price" — a position is spread
 * across a range of bands, and soft-liquidation gradually converts collateral
 * into the debt token as oracle price drops through each band. Modelling the
 * full band curve would need the market's amplification parameter (A), which
 * isn't present in event context, so the simulator approximates a break-even
 * price using the liquidation discount:
 *
 *   debt = coll × price_soft × (1 − liqDiscount)
 *
 * That gives the oracle price at which the position's collateral value, after
 * the protocol-defined haircut, equals the outstanding debt — a conservative
 * proxy for soft-liq onset. Good enough for a "what-if" dial; the real band
 * edges are surfaced via n1/n2 on the position selector.
 *
 * Lifted from rails-explorer's lib/llamalend/utils/simulate.ts.
 */

export interface LlamalendSimInputs {
  coll: number;
  debt: number;
  /** Oracle collateral price in debt/USD units */
  price: number;
  /** Liquidation discount fraction (0.06 = 6%). Defaults to 0.06 when unknown. */
  liquidationDiscount?: number;
}

export interface LlamalendSimResult {
  collValueUsd: number;
  cr: number;
  softLiqPrice: number;
  priceHeadroomPct: number;
  underwater: boolean;
}

export function simulateLlamalendPosition({
  coll,
  debt,
  price,
  liquidationDiscount = 0.06,
}: LlamalendSimInputs): LlamalendSimResult {
  const collValueUsd = coll * price;
  const cr = debt > 0 ? (collValueUsd / debt) * 100 : 0;
  const discount = Math.min(0.5, Math.max(0, liquidationDiscount));
  const softLiqPrice = coll > 0 && debt > 0 ? debt / (coll * (1 - discount)) : 0;
  const priceHeadroomPct = softLiqPrice > 0 ? ((price - softLiqPrice) / softLiqPrice) * 100 : 0;
  const underwater = coll > 0 && debt > 0 && collValueUsd < debt;
  return { collValueUsd, cr, softLiqPrice, priceHeadroomPct, underwater };
}
