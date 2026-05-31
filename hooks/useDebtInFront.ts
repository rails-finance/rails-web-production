"use client";

import { useState, useEffect } from "react";

interface DebtInFrontResult {
  debtInFront: number | null;
  trovesAhead: number | null;
  loading: boolean;
}

/**
 * Liquity V2 redemption buffer for a trove: the total accrued-inclusive BOLD
 * debt sitting at interest rates at or below this trove's, within its own
 * collateral branch, excluding the trove itself. Redemptions are per-branch
 * queues consumed from the lowest rate up, so this is how much must be redeemed
 * against the branch before this trove is reached.
 *
 * Computed on-chain server-side (MultiTroveGetter walk over live `entireDebt`),
 * so it reflects current accrued interest and exact sorted order — no indexer
 * lag and no client-side pagination race. See rails-server-mig
 * `/api/liquity-v2/debt-in-front`.
 *
 * `interestRate` is no longer used in the calculation (the backend reads the
 * trove's live rate directly); it is retained only as a readiness gate — the
 * detail page passes it solely for open troves.
 */
export function useDebtInFront(
  collateralType: string | undefined,
  interestRate: number | undefined,
  troveId: string | undefined,
): DebtInFrontResult {
  const [debtInFront, setDebtInFront] = useState<number | null>(null);
  const [trovesAhead, setTrovesAhead] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!collateralType || interestRate === undefined || !troveId) return;

    let cancelled = false;

    const fetchDebtInFront = async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({ collateralType, troveId });
        const response = await fetch(`/api/liquity-v2/debt-in-front?${params}`);
        if (!response.ok) return;

        const json = await response.json();
        if (cancelled) return;

        const data = json?.data;
        if (data && typeof data.debtInFront === "number") {
          setDebtInFront(data.debtInFront);
          setTrovesAhead(typeof data.trovesAhead === "number" ? data.trovesAhead : null);
        }
      } catch (err) {
        console.error("Error fetching debt in front:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDebtInFront();

    return () => {
      cancelled = true;
    };
  }, [collateralType, interestRate, troveId]);

  return { debtInFront, trovesAhead, loading };
}
