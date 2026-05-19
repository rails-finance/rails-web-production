// LLAMMA band-range math.
//
// Curve LlamaLend distributes collateral across discrete "bands" — each band
// is a price slice where soft-liquidation activates as the oracle traverses
// it. The band-edge formula is:
//
//   p_oracle_up(n) = base_price · ((A − 1) / A)^n
//
// where A is the amplification parameter (integer ~50-500) and base_price is
// the LLAMMA's rate-accrued base price (from get_base_price()). Higher band
// indices map to LOWER prices: in LlamaLend convention n1 ≤ n2, so the
// top-of-range price is pUp = bandPrice(n1) and the bottom is
// pDown = bandPrice(n2 + 1).
//
// Inputs come from `LlamalendContext.ammA` / `.ammBasePrice` (resolved by the
// server's per-market constants cache, Phase 5) plus `.n1` / `.n2` on every
// event. ammBasePrice is an 18-decimal fixed-point string.

export interface BandRange {
  /** Top of the band range — soft-liq onset price. */
  pUp: number;
  /** Bottom of the band range — fully-liquidated price. */
  pDown: number;
  /** Number of bands the position spans. */
  bandWidth: number;
  /** True when both ends came from on-chain constants. */
  exact: boolean;
}

export interface BandRangeInputs {
  ammA?: number;
  /** 18-decimal fixed-point string from get_base_price(). */
  ammBasePrice?: string;
  n1?: string | number | null;
  n2?: string | number | null;
}

/** Compute pUp / pDown / bandWidth from LLAMMA constants + band indices.
 *  Returns null when any input is missing or yields a degenerate range. */
export function computeBandRange(inputs: BandRangeInputs): BandRange | null {
  const { ammA, ammBasePrice, n1: n1Raw, n2: n2Raw } = inputs;
  if (typeof ammA !== "number" || !(ammA > 1)) return null;
  if (typeof ammBasePrice !== "string" || ammBasePrice.length === 0) return null;
  if (n1Raw == null || n2Raw == null) return null;

  const n1Num = typeof n1Raw === "number" ? n1Raw : parseInt(String(n1Raw), 10);
  const n2Num = typeof n2Raw === "number" ? n2Raw : parseInt(String(n2Raw), 10);
  if (!Number.isFinite(n1Num) || !Number.isFinite(n2Num)) return null;

  // In LlamaLend convention n1 ≤ n2; defensively clamp in case a caller
  // passed them reversed.
  const nLo = Math.min(n1Num, n2Num);
  const nHi = Math.max(n1Num, n2Num);

  const basePrice = Number(ammBasePrice) / 1e18;
  if (!(basePrice > 0)) return null;

  const r = (ammA - 1) / ammA;
  const pUp = basePrice * Math.pow(r, nLo);
  const pDown = basePrice * Math.pow(r, nHi + 1);
  if (!(pUp > 0) || !(pDown > 0) || !(pDown < pUp)) return null;

  return {
    pUp,
    pDown,
    bandWidth: nHi - nLo + 1,
    exact: true,
  };
}
