export interface TroveSimInputs {
  coll: number;
  debt: number;
  /** Annual interest rate as a fraction (0.05 = 5%) */
  rate: number;
  /** Collateral price in USD */
  price: number;
}

export interface TroveSimResult {
  /** Collateral ratio as a percentage (e.g. 250 = 250%) */
  cr: number;
  /** Liquidation price in USD */
  liqPrice: number;
  /** Daily interest cost in debt units */
  dailyCost: number;
  /** Annual interest cost in debt units */
  yearlyCost: number;
  /** Collateral value in USD */
  collValueUsd: number;
}

/** Pure simulation of a Liquity V2 trove given coll/debt/rate/price. */
export function simulateTrove({ coll, debt, rate, price }: TroveSimInputs): TroveSimResult {
  const cr = debt > 0 ? (coll * price) / debt * 100 : 0;
  const liqPrice = coll > 0 ? (debt * 1.1) / coll : 0;
  const yearlyCost = debt * rate;
  const dailyCost = yearlyCost / 365;
  const collValueUsd = coll * price;
  return { cr, liqPrice, dailyCost, yearlyCost, collValueUsd };
}
