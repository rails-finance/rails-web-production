import dist from "@/data/liquity-v2-rate-distribution.json";

interface SlimTrove {
  b: string;
  d: number;
  r: number;
}

const TROVES: SlimTrove[] = (dist as { troves: SlimTrove[] }).troves;

export interface DebtInFront {
  /** Total $-debt borrowed at rates strictly below `queryRate`, across all branches. */
  debt: number;
  /** Number of branches that contribute non-zero debt below `queryRate`. */
  branchesWithDebt: number;
  /** Total branches in the snapshot — useful for "across N of M branches". */
  totalBranches: number;
}

/**
 * Liquity V2 redemptions sweep the lowest interest-rate troves first. Given a
 * query rate (the user's sim'd rate as a fraction, e.g. 0.065), return the
 * aggregate debt borrowed at lower rates plus how many branches contribute.
 *
 * Note: this is the simple cross-branch aggregate. Real redemption volume
 * splits across branches by their deviation from target ratio — we surface the
 * raw aggregate for the headline and leave the deviation weighting as a
 * future refinement.
 */
export function computeDebtInFront(queryRate: number): DebtInFront {
  const branchDebt = new Map<string, number>();
  const allBranches = new Set<string>();
  for (const t of TROVES) {
    allBranches.add(t.b);
    if (t.r < queryRate) {
      branchDebt.set(t.b, (branchDebt.get(t.b) ?? 0) + t.d);
    }
  }
  let debt = 0;
  for (const v of branchDebt.values()) debt += v;
  return {
    debt,
    branchesWithDebt: branchDebt.size,
    totalBranches: allBranches.size,
  };
}
