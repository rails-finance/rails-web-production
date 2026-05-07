"use client";

import { useState, useEffect } from "react";
import { TroveSummary } from "@/types/api/trove";

interface DebtInFrontResult {
  debtInFront: number | null;
  trovesAhead: number | null;
  loading: boolean;
}

/**
 * Fetches all open troves for the same collateral type and calculates
 * the total debt in front of a given interest rate. In Liquity V2,
 * redemptions hit the lowest-rate troves first, and all troves at the
 * same rate share redemption risk equally — so debt-in-front includes
 * all debt at rates <= this trove's rate (excluding the trove itself).
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
        let allTroves: TroveSummary[] = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        // Paginate through all open troves sorted by interest rate
        while (hasMore) {
          const params = new URLSearchParams({
            collateralType,
            status: "open",
            sortBy: "interestRate",
            sortOrder: "asc",
            limit: limit.toString(),
            offset: offset.toString(),
          });

          const response = await fetch(`/api/troves?${params}`);
          if (!response.ok) break;

          const data = await response.json();
          const troves: TroveSummary[] = data.data || [];
          allTroves = allTroves.concat(troves);

          // Stop if we've passed our interest rate or no more data
          if (troves.length < limit) {
            hasMore = false;
          } else {
            const lastRate = troves[troves.length - 1]?.metrics.interestRate ?? 0;
            if (lastRate > interestRate) {
              hasMore = false;
            } else {
              offset += limit;
            }
          }
        }

        if (cancelled) return;

        // Sum debt for all troves at rates <= this trove's rate, excluding itself
        let totalDebt = 0;
        let count = 0;
        for (const trove of allTroves) {
          if (trove.id === troveId) continue;
          if (trove.metrics.interestRate <= interestRate) {
            totalDebt += trove.debt.current;
            count++;
          }
        }

        setDebtInFront(totalDebt);
        setTrovesAhead(count);
      } catch (err) {
        console.error("Error calculating debt in front:", err);
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
