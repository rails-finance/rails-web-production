"use client";

import type { LiquityContext } from "@/lib/shared/types/protocols/liquity";
import type { BaseActivityEvent, GasCost } from "@/lib/shared/types/activity";
import { formatGasCost } from "@/lib/shared/format-event";
import { calculateInterestBetweenTransactions } from "@/lib/liquity/utils/interest-calculator";
import { isNoChangeAdjust, LIQUITY_MIN_DEBT, TROVE_DELTA_EPSILON } from "@/lib/liquity/trove-ops";
import { LearnMore } from "@/components/shared/learn-more-modal";
import { LinkedAddress } from "@/components/shared/linked-address";
import { WalletLink } from "@/components/wallet/wallet-dropdown";
import { getBatchManagerByAddress } from "@/lib/liquity/batch-managers";
import { boldToUsd } from "@/lib/liquity/bold-peg";
import {
  liquityRedemptionContent,
  liquityLiquidationContent,
  liquityOpenTroveContent,
  liquityCloseTroveContent,
  liquityAdjustTroveContent,
  liquityInterestRateContent,
  liquityDelegationContent,
  liquityTransferContent,
  liquityEventFallbackContent,
} from "@/lib/shared/learn-more-content";

// ── Formatters ──────────────────────────────────────────────────────

function fmt(n: number): string {
  if (!isFinite(n)) return "0";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  // Sub-unit: scale decimals so small fractional amounts don't underflow to "0".
  const decimals = Math.min(8, Math.ceil(-Math.log10(abs)) + 2);
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function fmtColl(n: number): string {
  if (n === 0) return "0";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmtUsd(value: number): string {
  if (value < 0.01) return "< $0.01";
  if (value < 1) return `$${value.toFixed(2)}`;
  return "$" + value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCurrency(n: number, asset: string): string {
  return `${fmt(n)} ${asset}`;
}

/** Short day label for run spans ("Jun 6" / "Jul 8 '26"). */
function fmtDay(tsSeconds: number): string {
  const d = new Date(tsSeconds * 1000);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

function getLiquidationThreshold(collType: string): number {
  return collType === "WETH" || collType === "ETH" ? 110 : 120;
}

// ── Types ───────────────────────────────────────────────────────────

interface ExplainerItem {
  content: React.ReactNode;
  type?: "default" | "warning" | "success" | "error" | "info";
}

// ── Bold helper to replace HighlightableValue ───────────────────────
//
// HIGHLIGHT RULE (codified — apply everywhere explanations render):
// Only wrap a value in <V> (bold + foreground) when that same value is ALSO
// surfaced on the card's structured chrome — the event card header or the
// details grid (for events), or the position card's stats (for positions).
// Everything else — prose, qualifiers, constants (e.g. the "2,000 BOLD"
// minimum), and any figure NOT shown elsewhere on the card (redemption-wide
// totals, the redemption fee, today's spot price) — stays in the muted body
// tone. The point is a cognitive link: a bold figure in the prose always maps
// to a figure the reader can locate in the header/grid above it.
function V({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-semibold text-foreground ${className ?? ""}`}>{children}</span>;
}

// ── Per-operation generators (ported wholesale from rails-web) ──────

function generateOpenTroveItems(ctx: LiquityContext): ExplainerItem[] {
  const items: ExplainerItem[] = [];
  const { stateAfter, troveOperation, collateralType, collateralPrice } = ctx;
  const coll = collateralType;
  const upfrontFee = troveOperation?.debtIncreaseFromUpfrontFee ?? 0;
  const principalBorrowed = stateAfter.debt - upfrontFee;
  const collUsdValue = stateAfter.coll * collateralPrice;

  items.push({
    content: (
      <span>
        Deposited{" "}
        <V>
          {fmtColl(stateAfter.coll)} {coll}
        </V>{" "}
        as collateral to secure the loan
      </span>
    ),
  });

  items.push({
    content: (
      <span>
        Borrowed <V>{fmt(principalBorrowed)} BOLD</V>
      </span>
    ),
  });

  if (upfrontFee > 0) {
    items.push({
      content: (
        <span>
          Paid a one-time borrowing fee of <V>{upfrontFee.toFixed(2)} BOLD</V> (equivalent to 7 days of average
          interest)
        </span>
      ),
    });
  }

  items.push({
    content: (
      <span>
        Total initial debt is <V>{fmt(stateAfter.debt)} BOLD</V>
        {upfrontFee > 0 ? " including the borrowing fee" : ""}
      </span>
    ),
  });

  items.push({
    content: <span>0.0375 ETH liquidation reserve set aside (refundable on close)</span>,
  });

  if (collUsdValue > 0) {
    items.push({
      content: (
        <span>
          Collateral USD value at opening: <V>{fmtUsd(collUsdValue)}</V>
          {collateralPrice > 0 && ` (${coll} price: ${fmtUsd(collateralPrice)})`}
        </span>
      ),
    });
  }

  items.push({
    content: (
      <span>
        Position opened with a <V>{stateAfter.collateralRatio.toFixed(1)}%</V> collateralization ratio
      </span>
    ),
  });

  items.push({
    content: (
      <span>
        Annual interest rate set at <V>{stateAfter.annualInterestRate.toFixed(1)}%</V>, compounding continuously
      </span>
    ),
  });

  if (ctx.operation === "openTroveAndJoinBatch" && ctx.batchUpdate) {
    items.push({
      content: <span>Joined a batch manager on open</span>,
    });
    if (ctx.batchUpdate.interestBatchManager) {
      items.push({
        content: (
          <span>
            Batch rate managed by delegate <V>{shortenAddress(ctx.batchUpdate.interestBatchManager)}</V> at{" "}
            <V>{ctx.batchUpdate.annualInterestRate.toFixed(1)}%</V> APR
            {ctx.batchUpdate.annualManagementFee > 0 && (
              <>
                , management fee: <V>{ctx.batchUpdate.annualManagementFee.toFixed(2)}%</V>
              </>
            )}
          </span>
        ),
      });
    }
  }

  return items;
}

function generateCloseTroveItems(ctx: LiquityContext, accruedInterest: number): ExplainerItem[] {
  const items: ExplainerItem[] = [];
  const { troveOperation, stateBefore, collateralType, collateralPrice } = ctx;
  const debtRepaid = troveOperation ? Math.abs(troveOperation.debtChangeFromOperation) : stateBefore.debt;
  const collRetrieved = troveOperation ? Math.abs(troveOperation.collChangeFromOperation) : stateBefore.coll;

  if (debtRepaid > 0) {
    items.push({
      content: (
        <span>
          Fully repaid the outstanding debt of <V>{fmtCurrency(debtRepaid, ctx.assetType ?? "BOLD")}</V>
        </span>
      ),
    });
  } else {
    items.push({
      content: <span>Debt was zero, so no repayment necessary</span>,
    });
  }

  items.push({
    content: (
      <span>
        <em>Borrower</em> retrieved all{" "}
        <V>
          {fmtColl(collRetrieved)} {collateralType}
        </V>{" "}
        collateral
      </span>
    ),
  });

  items.push({
    content: <span>The 0.0375 ETH liquidation reserve was returned</span>,
  });

  if (debtRepaid > 0) {
    if (stateBefore.annualInterestRate > 0) {
      items.push({
        content: (
          <span className="">
            Position was paying {stateBefore.annualInterestRate.toFixed(1)}% annual interest before closure
          </span>
        ),
      });
    }

    if (stateBefore.collateralRatio > 0) {
      items.push({
        content: <span className="">Closed with a {stateBefore.collateralRatio.toFixed(1)}% collateral ratio</span>,
      });
    }
  }

  items.push({
    content: <span>Trove NFT was sent to the burn address, ending token ownership</span>,
  });

  items.push({
    content: <span>Trove successfully closed — all obligations settled</span>,
    type: "success",
  });

  return items;
}

function generateAdjustTroveItems(
  ctx: LiquityContext,
  accruedInterest: number,
  accruedManagementFees: number,
): ExplainerItem[] {
  const items: ExplainerItem[] = [];
  const { troveOperation, stateBefore, stateAfter, collateralType, collateralPrice } = ctx;
  const totalAccruedFees = accruedInterest + accruedManagementFees;

  // No-change adjust: the operation moved nothing the reader would notice, so
  // the generic delta bullets would either vanish or claim a "Paid down 0.001
  // BOLD" that misreads the event. Narrate what actually happened instead:
  // usually an automated repay clamped to accrued-interest dust by the
  // minimum-debt floor. Sub-epsilon dust amounts are never on the card chrome,
  // so per the highlight rule they stay muted (no <V>).
  if (isNoChangeAdjust(ctx) && troveOperation) {
    const run = ctx.noChangeRun;
    const dust = troveOperation.debtChangeFromOperation;
    const atMinDebt = Math.abs(stateAfter.debt - LIQUITY_MIN_DEBT) < TROVE_DELTA_EPSILON;

    if (run) {
      // One row stands in for a whole server-collapsed run of touches.
      items.push({
        content: (
          <span>
            This row stands in for {run.count.toLocaleString()} adjustments between {fmtDay(run.firstTimestamp)} and{" "}
            {fmtDay(run.lastTimestamp)} — every one of them left the position unchanged
          </span>
        ),
      });
      if (dust < 0) {
        items.push({
          content: (
            <span>
              Together they repaid {fmt(Math.abs(dust))} {ctx.assetType ?? "BOLD"} — the interest that accrued between
              touches
            </span>
          ),
        });
      }
    } else {
      items.push({
        content:
          dust < 0 ? (
            <span>
              This adjustment moved no collateral and repaid only {fmt(Math.abs(dust))} {ctx.assetType ?? "BOLD"} — the
              interest accrued since the trove was last touched — leaving the position effectively unchanged
            </span>
          ) : (
            <span>This adjustment moved no collateral and no debt — the position is unchanged</span>
          ),
      });
    }

    if (atMinDebt) {
      items.push({
        content: (
          <span>
            The debt sits at Liquity V2&apos;s 2,000 {ctx.assetType ?? "BOLD"} minimum. A repayment cannot take it lower
            without closing the trove entirely, so any larger repay attempt is capped at the interest accrued since the
            last touch —{" "}
            {run
              ? "every attempt in this stretch was capped that way"
              : `here, that cap left ${dust < 0 ? "almost nothing" : "nothing"} to repay`}
          </span>
        ),
        type: "info",
      });
    }

    items.push({
      content: (
        <span>
          Repeated no-change adjustments like this are typically sent by an automated manager (a bot or vault contract)
          re-trying an operation the protocol clamps to nothing; each attempt costs the sender only gas
        </span>
      ),
      type: "info",
    });
  } else if (troveOperation) {
    const collChange = troveOperation.collChangeFromOperation;
    const debtChange = troveOperation.debtChangeFromOperation;
    const adjustFee = troveOperation.debtIncreaseFromUpfrontFee;

    if (collChange !== 0) {
      items.push({
        content: (
          <span>
            {collChange > 0 ? "Added " : "Withdrew "}
            <V>
              {fmtColl(Math.abs(collChange))} {collateralType}
            </V>
            {collChange > 0 ? " to strengthen the position" : " from collateral, reducing exposure"}
          </span>
        ),
      });
    }

    if (debtChange !== 0) {
      items.push({
        content: (
          <span>
            {debtChange > 0 ? "Borrowed an additional " : "Paid down "}
            <V>{fmtCurrency(Math.abs(debtChange), ctx.assetType ?? "BOLD")}</V>
          </span>
        ),
      });
    }

    if (totalAccruedFees > 0.01) {
      items.push({
        content: (
          <span>
            Accrued interest since last operation: <V>{totalAccruedFees.toFixed(2)} BOLD</V>
            {accruedManagementFees > 0 && (
              <span className=" text-xs ml-1">(including {accruedManagementFees.toFixed(2)} BOLD management fee)</span>
            )}
          </span>
        ),
      });
    }

    if (adjustFee > 0) {
      items.push({
        content: (
          <span>
            Adjustment incurred a <V>{adjustFee.toFixed(2)} BOLD</V> borrowing fee (7 days of average interest on the
            respective borrow market)
          </span>
        ),
      });
    }

    // Debt breakdown if combined fees
    if (debtChange > 0 && (adjustFee > 0 || totalAccruedFees > 0.01)) {
      const totalIncrease = stateAfter.debt - stateBefore.debt;
      items.push({
        content: (
          <span>
            Total debt increase: <V>{fmtCurrency(totalIncrease, ctx.assetType ?? "BOLD")}</V>{" "}
            <span className=" text-xs">
              (borrowed: {fmtCurrency(debtChange, ctx.assetType ?? "BOLD")}
              {totalAccruedFees > 0.01 && ` + accrued: ${totalAccruedFees.toFixed(2)}`}
              {adjustFee > 0 && ` + fee: ${adjustFee.toFixed(2)}`})
            </span>
          </span>
        ),
      });
    }
  }

  // Current position summary
  items.push({
    content: (
      <span>
        Position now holds{" "}
        <V>
          {fmtColl(stateAfter.coll)} {collateralType}
        </V>{" "}
        collateral against <V>{fmtCurrency(stateAfter.debt, ctx.assetType ?? "BOLD")}</V> debt
      </span>
    ),
  });

  // Collateral USD value
  const afterCollUsd = stateAfter.coll * collateralPrice;
  if (afterCollUsd > 0 && collateralPrice > 0) {
    items.push({
      content: (
        <span>
          Current collateral valued at <V>{fmtUsd(afterCollUsd)}</V> with historic price of{" "}
          <V>{fmtUsd(collateralPrice)}</V> / {collateralType}
        </span>
      ),
    });
  }

  // CR change
  const beforeCR = stateBefore.collateralRatio;
  const afterCR = stateAfter.collateralRatio;
  if (beforeCR > 0 && afterCR > 0 && afterCR > beforeCR) {
    items.push({
      content: (
        <span>
          Improved collateral ratio to <V>{afterCR.toFixed(1)}%</V>, reducing liquidation risk
        </span>
      ),
    });
  } else if (beforeCR > 0 && afterCR > 0 && beforeCR !== afterCR) {
    items.push({
      content: (
        <span>
          Collateral ratio changed to <V>{afterCR.toFixed(1)}%</V>
          {afterCR < beforeCR ? ", increasing liquidation risk" : ""}
        </span>
      ),
    });
  }

  // Interest rate
  if (stateBefore.annualInterestRate !== stateAfter.annualInterestRate) {
    items.push({
      content: (
        <span>
          Annual interest rate adjusted from {stateBefore.annualInterestRate.toFixed(1)}% to{" "}
          <V>{stateAfter.annualInterestRate.toFixed(1)}%</V>
        </span>
      ),
    });
  } else {
    items.push({
      content: (
        <span>
          Annual interest rate remains at <V>{stateAfter.annualInterestRate.toFixed(1)}%</V>
        </span>
      ),
    });
  }

  return items;
}

function generateAdjustRateItems(
  ctx: LiquityContext,
  accruedInterest: number,
  accruedManagementFees: number,
): ExplainerItem[] {
  const items: ExplainerItem[] = [];
  const { stateBefore, stateAfter, collateralType, collateralPrice } = ctx;
  const totalAccruedFees = accruedInterest + accruedManagementFees;
  const increased = stateAfter.annualInterestRate > stateBefore.annualInterestRate;

  items.push({
    content: (
      <span>
        {increased ? "Increased" : "Decreased"} interest rate from <V>{stateBefore.annualInterestRate.toFixed(1)}%</V>{" "}
        to <V>{stateAfter.annualInterestRate.toFixed(1)}%</V> APR
      </span>
    ),
  });

  if (totalAccruedFees > 0.01) {
    items.push({
      content: (
        <span>
          Accrued interest since last operation: <V>{totalAccruedFees.toFixed(2)} BOLD</V>
          {accruedManagementFees > 0 && (
            <span className=" text-xs ml-1">(including {accruedManagementFees.toFixed(2)} BOLD management fee)</span>
          )}
        </span>
      ),
    });
  }

  if (stateAfter.debt > 0) {
    items.push({
      content: (
        <span>
          Debt updated to <V>{fmtCurrency(stateAfter.debt, ctx.assetType ?? "BOLD")}</V>
        </span>
      ),
    });
  }

  // Collateral + USD
  const afterCollUsd = stateAfter.coll * collateralPrice;
  if (stateAfter.coll > 0 && afterCollUsd > 0) {
    items.push({
      content: (
        <span>
          Collateral:{" "}
          <V>
            {fmtColl(stateAfter.coll)} {collateralType}
          </V>{" "}
          (<V>{fmtUsd(afterCollUsd)}</V>)
        </span>
      ),
    });
  }

  // CR
  if (stateAfter.collateralRatio > 0) {
    items.push({
      content: (
        <span>
          Collateral ratio: <V className="text-foreground">{stateAfter.collateralRatio.toFixed(1)}%</V>
        </span>
      ),
    });
  }

  return items;
}

function generateLiquidateItems(ctx: LiquityContext): ExplainerItem[] {
  const items: ExplainerItem[] = [];
  const { liquidation, troveOperation, stateBefore, stateAfter, collateralType, collateralPrice } = ctx;

  if (!liquidation) {
    items.push({ content: <span>The {collateralType} trove was liquidated.</span>, type: "error" });
    return items;
  }

  // Check if beneficial (redistribution gain) or destructive
  const isBeneficial = stateAfter.debt > 0 && troveOperation && troveOperation.collIncreaseFromRedist > 0;

  if (isBeneficial) {
    const collGained = troveOperation!.collIncreaseFromRedist;
    const debtInherited = troveOperation!.debtIncreaseFromRedist;
    const collGainedUsd = collGained * collateralPrice;
    const netBenefit = collGainedUsd - debtInherited;

    items.push({
      content: <span>✅ The trove benefited from another trove&apos;s liquidation through redistribution</span>,
      type: "success",
    });
    items.push({
      content: (
        <span>
          The trove received{" "}
          <V>
            {fmtColl(collGained)} {collateralType}
          </V>
          {collGainedUsd > 0 && (
            <>
              {" "}
              (≈ <V>{fmtUsd(collGainedUsd)}</V>)
            </>
          )}{" "}
          from the liquidated trove
        </span>
      ),
    });
    items.push({
      content: (
        <span>
          The trove inherited <V>{fmtCurrency(debtInherited, ctx.assetType ?? "BOLD")}</V> proportional to its
          collateral amount
        </span>
      ),
    });
    items.push({
      content: (
        <span>
          Net impact: {netBenefit >= 0 ? "+" : ""}
          {fmtUsd(Math.abs(netBenefit))}
          {netBenefit >= 0 ? " (beneficial due to liquidation penalty)" : " (small cost)"}
        </span>
      ),
      type: netBenefit >= 0 ? "success" : "default",
    });
    items.push({
      content: (
        <span>This redistribution happened because the Stability Pool couldn&apos;t fully cover the liquidation</span>
      ),
    });
    if (stateBefore.collateralRatio > 0 && stateAfter.collateralRatio > 0) {
      items.push({
        content: (
          <span>
            Collateral ratio improved from {stateBefore.collateralRatio.toFixed(1)}% to{" "}
            <V>{stateAfter.collateralRatio.toFixed(1)}%</V>
          </span>
        ),
      });
    }
    items.push({ content: <span>The trove remains active and healthy</span>, type: "success" });
    return items;
  }

  // Destructive liquidation
  const threshold = getLiquidationThreshold(collateralType);
  const debtCleared = liquidation.debtOffsetBySP + liquidation.debtRedistributed;
  const collLiquidated =
    liquidation.collSentToSP +
    liquidation.collRedistributed +
    liquidation.collSurplus +
    liquidation.collGasCompensation;
  const totalCollValueUsd = collLiquidated * liquidation.price;
  const crAtLiquidation =
    totalCollValueUsd > 0 && debtCleared > 0 ? (totalCollValueUsd / debtCleared) * 100 : stateBefore.collateralRatio;

  // Claimable surplus (only when not fully redistributed)
  const hasClaimableSurplus = liquidation.collSurplus > 0 && liquidation.debtRedistributed === 0;
  const collSurplusValueUsd = liquidation.collSurplus * liquidation.price;

  // Estimated borrower loss: difference between equity and claimable surplus
  const borrowerEquity = totalCollValueUsd - debtCleared;
  const estimatedBorrowerLoss = borrowerEquity > 0 ? borrowerEquity - collSurplusValueUsd : 0;

  // Liquidator penalty (5% of debt)
  const penaltyInColl = debtCleared > 0 && liquidation.price > 0 ? (debtCleared * 0.05) / liquidation.price : 0;
  const penaltyValueUsd = debtCleared * 0.05;

  // Determine mechanism
  const wasFullyAbsorbedBySP = liquidation.debtRedistributed === 0;
  const wasFullyRedistributed = liquidation.debtOffsetBySP === 0 && liquidation.debtRedistributed > 0;
  const wasPartiallyRedistributed = liquidation.debtOffsetBySP > 0 && liquidation.debtRedistributed > 0;

  items.push({
    content: (
      <span>
        USD values reflect historic price at time: <V>{fmtUsd(liquidation.price)}</V> / {collateralType}
      </span>
    ),
    type: "info",
  });

  // Collateral ratio at liquidation
  items.push({
    content: (
      <span>
        Collateral ratio dropped to <V>{crAtLiquidation.toFixed(2)}%</V> (below the {threshold}% threshold for{" "}
        {collateralType}) triggering a liquidation
      </span>
    ),
  });

  // Debt cleared
  items.push({
    content: (
      <span>
        <V>{fmtCurrency(debtCleared, ctx.assetType ?? "BOLD")}</V> debt cleared
      </span>
    ),
  });

  // Collateral liquidated
  items.push({
    content: (
      <span>
        Collateral liquidated{" "}
        <V>
          {fmtColl(collLiquidated)} {collateralType}
        </V>
        <span className=" ml-1">
          (<V>{fmtUsd(totalCollValueUsd)}</V>)
        </span>
      </span>
    ),
  });

  // Claimable surplus
  if (hasClaimableSurplus) {
    items.push({
      content: (
        <span>
          <em>Borrower</em> can claim surplus of{" "}
          <V>
            {fmtColl(liquidation.collSurplus)} {collateralType}
          </V>
          <span className=" ml-1">({fmtUsd(collSurplusValueUsd)})</span>
        </span>
      ),
    });
  }

  // Estimated borrower loss
  if (estimatedBorrowerLoss > 0) {
    items.push({
      content: (
        <span>
          The difference between borrower equity and claimable surplus represented a USD estimated loss of ≈
          {fmtUsd(estimatedBorrowerLoss)} at liquidation
        </span>
      ),
    });
  }

  // Stability Pool received
  if (liquidation.collSentToSP > 0) {
    items.push({
      content: (
        <span>
          <em>Stability Pool</em> received {fmtColl(liquidation.collSentToSP)} {collateralType} (
          {fmtUsd(liquidation.collSentToSP * liquidation.price)})
        </span>
      ),
    });
  }

  // Gas compensation — separate lines matching rails-web
  if (liquidation.collGasCompensation > 0) {
    items.push({
      content: (
        <span>
          <em>Liquidator</em> received {fmtColl(liquidation.collGasCompensation)} {collateralType} gas compensation
        </span>
      ),
    });
  }

  // Fixed 0.0375 WETH gas compensation (always present for liquidations)
  items.push({
    content: (
      <span>
        <em>Liquidator</em> received 0.0375 WETH gas compensation
      </span>
    ),
  });

  // Redistribution warning
  if (wasPartiallyRedistributed) {
    items.push({
      content: <span>⚠️ Partial redistribution occurred (Stability Pool was insufficient)</span>,
      type: "warning",
    });
  }

  // Liquidator incentive (5% of debt)
  if (penaltyInColl > 0) {
    items.push({
      content: (
        <span>
          <em>Liquidator</em> received {fmtColl(penaltyInColl)} {collateralType} ({fmtUsd(penaltyValueUsd)}) as an
          incentive for performing the liquidation (5% of debt)
        </span>
      ),
    });
  }

  // NFT burn
  items.push({
    content: <span>Trove NFT was sent to the burn address during liquidation</span>,
  });

  return items;
}

function generateRedeemItems(ctx: LiquityContext, currentPrice?: number): ExplainerItem[] {
  const items: ExplainerItem[] = [];
  const { redemption, stateAfter, troveOperation, collateralType, collateralPrice } = ctx;

  if (!redemption) {
    items.push({ content: <span>The {collateralType} trove was redeemed.</span> });
    return items;
  }

  const collRedeemed = troveOperation ? Math.abs(troveOperation.collChangeFromOperation) : redemption.ETHSent;
  const debtRedeemed = troveOperation ? Math.abs(troveOperation.debtChangeFromOperation) : redemption.actualBoldAmount;
  const redemptionFee = Number(redemption.ETHFee) || 0;
  const feeRate = redemptionFee > 0 ? (redemptionFee / (collRedeemed + redemptionFee)) * 100 : 0;
  const collValueMarketPrice = collRedeemed * collateralPrice;
  const feeValueMarket = redemptionFee * collateralPrice;
  const afterCollUsd = stateAfter.coll * collateralPrice;
  const isZombie = ctx.isZombieTrove;

  items.push({
    content: (
      <span>
        This redemption clears <V>{fmtCurrency(debtRedeemed, ctx.assetType ?? "BOLD")}</V> debt and reduces collateral
        by <V>{fmtColl(collRedeemed)}</V> ({fmtUsd(collValueMarketPrice)}) to{" "}
        <V>
          {fmtColl(stateAfter.coll)} {collateralType}
        </V>{" "}
        ({fmtUsd(afterCollUsd)})
      </span>
    ),
  });

  // Whole-redemption context: this trove is typically one of several hit in a
  // single redemption. Surface the operation-wide totals (previously shown in
  // the "Redemption Breakdown" detail grid) when they exceed this trove's slice.
  if (redemption.actualBoldAmount > debtRedeemed + 0.01) {
    // Redemption-wide totals are NOT on this trove's card (the header shows the
    // per-trove Cleared/Reduced), so by the highlight rule they stay muted.
    items.push({
      content: (
        <span>
          Part of a larger redemption totalling {fmtCurrency(redemption.actualBoldAmount, ctx.assetType ?? "BOLD")}{" "}
          against {fmtColl(redemption.ETHSent)} {collateralType} ({fmtUsd(redemption.ETHSent * redemption.price)})
          {redemption.attemptedBoldAmount > redemption.actualBoldAmount + 0.01 && (
            <> of {fmtCurrency(redemption.attemptedBoldAmount, ctx.assetType ?? "BOLD")} attempted</>
          )}
        </span>
      ),
    });
  }

  if (redemptionFee > 0) {
    items.push({
      content: (
        <span>
          A {feeRate.toFixed(3)}% redemption fee of {fmtColl(redemptionFee)} {collateralType} ({fmtUsd(feeValueMarket)}
          ), paid by the redeemer, remains in the Trove as additional collateral
        </span>
      ),
    });
  }

  // After state
  if (stateAfter.debt === 0) {
    items.push({
      content: (
        <span>
          The Trove now has <V>0 BOLD</V> debt
          {isZombie && ", remaining open with collateral only (a 'zero-debt Zombie Trove')"}
        </span>
      ),
      // Zombie is a named abnormal state → caution tier (§5). A non-zombie
      // zero-debt close is routine → default.
      type: isZombie ? "warning" : "default",
    });
  } else {
    items.push({
      content: (
        <span>
          The Trove now has <V>{fmtCurrency(stateAfter.debt, ctx.assetType ?? "BOLD")}</V>
          {isZombie ? (
            <>
              {" "}
              debt, creating a &apos;low-debt Zombie Trove&apos; (below the 2,000 BOLD minimum threshold), adjusting the
              collateral ratio proportionally to <V>{stateAfter.collateralRatio.toFixed(1)}%</V>
            </>
          ) : (
            <>
              , adjusting the collateral ratio proportionally to <V>{stateAfter.collateralRatio.toFixed(1)}%</V>
            </>
          )}
        </span>
      ),
      type: isZombie ? "warning" : "default",
    });
  }

  // Zombie-specific guidance
  if (isZombie && stateAfter.debt === 0) {
    items.push({
      content: (
        <span>
          With zero debt, no interest accrues and the {stateAfter.annualInterestRate.toFixed(1)}% interest rate is no
          longer relevant
        </span>
      ),
    });
    items.push({
      content: (
        <span>
          It can be closed by withdrawing the remaining collateral, or re-activated by borrowing 2,000 BOLD or more
        </span>
      ),
    });
  } else if (isZombie && stateAfter.debt > 0) {
    items.push({
      content: (
        <span>
          The Trove is removed from the normal redemption order. It may be prioritised in subsequent redemption(s) to
          clear the remaining below-minimum debt
        </span>
      ),
      type: "warning",
    });
    items.push({
      content: (
        <span>
          Interest continues to accrue at <V>{stateAfter.annualInterestRate.toFixed(1)}%</V>. If the debt later rises
          back above 2,000 BOLD (for example from accrued interest), the Trove can return to normal behaviour
        </span>
      ),
    });
    items.push({
      content: (
        <span>
          It can be resolved by repaying the remaining debt and withdrawing collateral to close it, or borrowing more to
          bring the debt above 2,000 BOLD and reactivate it
        </span>
      ),
    });
  } else {
    items.push({
      content: (
        <span>
          Interest rates are not affected by redemptions and this remains at{" "}
          <V>{stateAfter.annualInterestRate.toFixed(1)}%</V>
        </span>
      ),
    });
  }

  // Net outcome / P/L \u2014 the figure shown in the header. From the borrower's
  // side a redemption swaps collateral for debt relief at the oracle price, so
  // P/L = debt cleared (BOLD \u2248 $1) minus the value of the collateral given up.
  // Shown at the redemption-time price and, when a live price is available,
  // at today's price (the same dual figure used on the production card).
  if (collateralPrice > 0) {
    // Debt cleared is a BOLD amount; value it in USD via the peg before netting
    // it against the collateral's USD value.
    const debtRedeemedUsd = boldToUsd(debtRedeemed);
    const netHistoric = debtRedeemedUsd - collValueMarketPrice;
    const netToday = currentPrice ? debtRedeemedUsd - collRedeemed * currentPrice : null;
    const sign = (n: number) => (n >= 0 ? "+" : "\u2212");
    items.push({
      content: (
        <span>
          P/L (net outcome) is the debt cleared minus the value of the collateral given up:{" "}
          <V>{fmtUsd(debtRedeemedUsd)}</V> &minus;{" "}
          <V>
            {fmtColl(collRedeemed)} {collateralType}
          </V>{" "}
          &times; <V>{fmtUsd(collateralPrice)}</V> ={" "}
          <V className="text-foreground">
            {sign(netHistoric)}
            {fmtUsd(Math.abs(netHistoric))}
          </V>{" "}
          at the redemption-time price
          {netToday != null && (
            <>
              , or{" "}
              <V className="text-foreground">
                {sign(netToday)}
                {fmtUsd(Math.abs(netToday))}
              </V>{" "}
              at today&apos;s {collateralType} price of {fmtUsd(currentPrice!)}
            </>
          )}
        </span>
      ),
    });
  }

  return items;
}

function generateApplyPendingDebtItems(ctx: LiquityContext): ExplainerItem[] {
  const items: ExplainerItem[] = [];
  const { troveOperation, stateAfter, stateBefore, collateralType, collateralPrice } = ctx;
  const redistDebt = troveOperation?.debtIncreaseFromRedist ?? 0;

  if (ctx.batchUpdate) {
    items.push({
      content: <span>Batch manager applied accrued interest to the trove</span>,
    });
  }

  items.push({
    content: (
      <span>
        Applied <V>{fmt(redistDebt)} BOLD</V> of pending redistribution debt
      </span>
    ),
  });

  if (troveOperation?.collIncreaseFromRedist && troveOperation.collIncreaseFromRedist > 0) {
    items.push({
      content: (
        <span>
          Gained{" "}
          <V>
            {fmtColl(troveOperation.collIncreaseFromRedist)} {collateralType}
          </V>{" "}
          from redistribution
        </span>
      ),
    });
  }

  items.push({
    content: (
      <span>
        Debt updated to <V>{fmtCurrency(stateAfter.debt, ctx.assetType ?? "BOLD")}</V>
      </span>
    ),
  });

  const afterCollUsd = stateAfter.coll * collateralPrice;
  if (stateAfter.coll > 0) {
    items.push({
      content: (
        <span>
          Collateral unchanged:{" "}
          <V>
            {fmtColl(stateAfter.coll)} {collateralType}
          </V>{" "}
          ({fmtUsd(afterCollUsd)})
        </span>
      ),
    });
  }

  items.push({
    content: (
      <span>
        Interest rate: <V>{stateAfter.annualInterestRate.toFixed(1)}%</V>
      </span>
    ),
  });

  if (stateAfter.collateralRatio > 0) {
    items.push({
      content: (
        <span>
          Collateral ratio: <V className="text-foreground">{stateAfter.collateralRatio.toFixed(1)}%</V>
        </span>
      ),
    });
  }

  return items;
}

function generateSetBatchManagerItems(ctx: LiquityContext, accruedInterest: number): ExplainerItem[] {
  const items: ExplainerItem[] = [];
  const { stateAfter, stateBefore, collateralType } = ctx;
  const managerAddr = ctx.batchUpdate?.interestBatchManager ?? ctx.batchManager;
  const knownName = managerAddr ? (getBatchManagerByAddress(managerAddr)?.name ?? null) : null;
  const shortAddr = managerAddr ? `${managerAddr.slice(0, 6)}…${managerAddr.slice(-4)}` : "";
  const debtChanged = Math.abs(stateAfter.debt - stateBefore.debt) >= 0.01;

  // 1. Moved to delegated management — name + truncated address combined into a
  //    single purple link (folds in the old standalone "Batch manager address"
  //    bullet).
  items.push({
    content: (
      <span>
        Adjust to delegated interest rate
        {managerAddr && (
          <>
            {" "}
            with{" "}
            <WalletLink address={managerAddr} className="text-pink-500 hover:text-pink-600 transition-colors">
              {knownName ? `${knownName} (${shortAddr})` : shortAddr}
            </WalletLink>
          </>
        )}
      </span>
    ),
  });

  // 2. Debt before → after, flagging accrued interest as the cause.
  if (stateAfter.debt > 0) {
    items.push({
      content: (
        <span>
          {debtChanged ? (
            <>
              Debt updated from {fmtCurrency(stateBefore.debt, ctx.assetType ?? "BOLD")} to{" "}
              <V>{fmtCurrency(stateAfter.debt, ctx.assetType ?? "BOLD")}</V>
              {accruedInterest > 0.01 && " (reflects accrued interest)"}
            </>
          ) : (
            <>
              Debt unchanged at <V>{fmtCurrency(stateAfter.debt, ctx.assetType ?? "BOLD")}</V>
            </>
          )}
        </span>
      ),
    });
  }

  // 3. Collateral is untouched by a delegation.
  if (stateAfter.coll > 0) {
    items.push({
      content: (
        <span>
          Collateral remains{" "}
          <V>
            {fmtColl(stateAfter.coll)} {collateralType}
          </V>
        </span>
      ),
    });
  }

  // 4. The delegated rate now governing the Trove.
  if (stateAfter.annualInterestRate > 0) {
    items.push({
      content: (
        <span>
          Now on a delegated interest rate of <V>{stateAfter.annualInterestRate.toFixed(2)}%</V> APR
        </span>
      ),
    });
  }

  // 5. Collateral ratio after the move.
  if (stateAfter.collateralRatio > 0) {
    items.push({
      content: (
        <span>
          Collateral ratio: <V className="text-foreground">{stateAfter.collateralRatio.toFixed(1)}%</V>
        </span>
      ),
    });
  }

  return items;
}

function generateRemoveFromBatchItems(
  ctx: LiquityContext,
  accruedInterest: number,
  accruedManagementFees: number,
): ExplainerItem[] {
  const items: ExplainerItem[] = [];
  const { stateAfter, stateBefore, collateralType, collateralPrice } = ctx;
  const afterCollUsd = stateAfter.coll * collateralPrice;

  items.push({
    content: <span>Left the batch manager, returning to individual interest rate management</span>,
  });

  if (ctx.batchUpdate?.interestBatchManager) {
    items.push({
      content: (
        <span>
          Former delegate: <LinkedAddress address={ctx.batchUpdate.interestBatchManager} />
        </span>
      ),
    });
  }

  if (stateAfter.debt > 0) {
    items.push({
      content: (
        <span>
          Debt updated to <V>{fmtCurrency(stateAfter.debt, ctx.assetType ?? "BOLD")}</V>
        </span>
      ),
    });
  }

  if (stateAfter.coll > 0 && afterCollUsd > 0) {
    items.push({
      content: (
        <span>
          Collateral:{" "}
          <V>
            {fmtColl(stateAfter.coll)} {collateralType}
          </V>{" "}
          ({fmtUsd(afterCollUsd)})
        </span>
      ),
    });
  }

  if (stateAfter.annualInterestRate !== stateBefore.annualInterestRate) {
    items.push({
      content: (
        <span>
          Rate changed from {stateBefore.annualInterestRate.toFixed(1)}% to individual rate of{" "}
          <V>{stateAfter.annualInterestRate.toFixed(1)}%</V>
        </span>
      ),
    });
  }

  if (stateAfter.collateralRatio > 0) {
    items.push({
      content: (
        <span>
          Collateral ratio: <V className="text-foreground">{stateAfter.collateralRatio.toFixed(1)}%</V>
        </span>
      ),
    });
  }

  if (accruedManagementFees > 0.01) {
    items.push({
      content: (
        <span>
          Accrued delegate fees: <V>~{accruedManagementFees.toFixed(2)} BOLD</V>
        </span>
      ),
    });
  }

  return items;
}

function generateBatchRateUpdateItems(ctx: LiquityContext): ExplainerItem[] {
  const items: ExplainerItem[] = [];
  const { stateBefore, stateAfter, collateralType, collateralPrice } = ctx;
  const increased = stateAfter.annualInterestRate > stateBefore.annualInterestRate;
  const afterCollUsd = stateAfter.coll * collateralPrice;

  items.push({
    content: (
      <span>
        The batch manager {increased ? "increased" : "decreased"} the interest rate from{" "}
        <V>{stateBefore.annualInterestRate.toFixed(1)}%</V> to <V>{stateAfter.annualInterestRate.toFixed(1)}%</V> APR
      </span>
    ),
  });

  if (ctx.batchUpdate?.interestBatchManager) {
    items.push({
      content: (
        <span>
          Delegate: <LinkedAddress address={ctx.batchUpdate.interestBatchManager} />
        </span>
      ),
    });
  }

  if (stateAfter.debt > 0) {
    items.push({
      content: (
        <span>
          Debt updated to <V>{fmtCurrency(stateAfter.debt, ctx.assetType ?? "BOLD")}</V>
        </span>
      ),
    });
  }

  if (stateAfter.coll > 0 && afterCollUsd > 0) {
    items.push({
      content: (
        <span>
          Collateral:{" "}
          <V>
            {fmtColl(stateAfter.coll)} {collateralType}
          </V>{" "}
          ({fmtUsd(afterCollUsd)})
        </span>
      ),
    });
  }

  if (stateAfter.collateralRatio > 0) {
    items.push({
      content: (
        <span>
          Collateral ratio: <V className="text-foreground">{stateAfter.collateralRatio.toFixed(1)}%</V>
        </span>
      ),
    });
  }

  return items;
}

function generateTransferItems(ctx: LiquityContext): ExplainerItem[] {
  const items: ExplainerItem[] = [];
  const { transfer, stateAfter, collateralType, collateralPrice } = ctx;

  if (!transfer) {
    items.push({ content: <span>The {collateralType} trove ownership was transferred</span> });
    return items;
  }

  const { transferType, fromAddress, toAddress } = transfer;
  const typeLabel = transferType === "mint" ? "Minted" : transferType === "burn" ? "Burned" : "Transferred";

  if (transferType === "mint") {
    items.push({
      content: (
        <span>
          Trove NFT minted to wallet <LinkedAddress address={toAddress} />
        </span>
      ),
    });
  } else if (transferType === "burn") {
    items.push({
      content: (
        <span>
          Trove NFT burned from wallet <LinkedAddress address={fromAddress} />
        </span>
      ),
    });
  } else {
    items.push({
      content: (
        <span>
          Trove ownership transferred from <LinkedAddress address={fromAddress} /> to{" "}
          <LinkedAddress address={toAddress} />
        </span>
      ),
    });
  }

  items.push({
    content: <span>Liquity V2 troves are represented as ERC-721 NFT tokens, enabling transferable ownership</span>,
  });

  if (transferType === "transfer") {
    items.push({
      content: (
        <span>The new owner gains full control of the trove&apos;s debt, collateral, and interest rate settings</span>
      ),
    });

    // Show transferred position details
    if (stateAfter.debt > 0 || stateAfter.coll > 0) {
      const afterCollUsd = stateAfter.coll * collateralPrice;
      items.push({
        content: (
          <span>
            The transferred trove contains <V>{fmtCurrency(stateAfter.debt, ctx.assetType ?? "BOLD")}</V> debt and{" "}
            <V>
              {fmtColl(stateAfter.coll)} {collateralType}
            </V>{" "}
            collateral with a <V>{stateAfter.collateralRatio.toFixed(1)}%</V> collateral ratio at a{" "}
            <V>{stateAfter.annualInterestRate.toFixed(1)}%</V> interest rate
            {collateralPrice > 0 && (
              <>
                {" "}
                ({collateralType} price: {fmtUsd(collateralPrice)})
              </>
            )}
          </span>
        ),
      });
    }
  }

  items.push({
    content: <span>Trove&apos;s debt and collateral balances remain unchanged during ownership transfer</span>,
  });

  return items;
}

// ── Main generator ──────────────────────────────────────────────────

function generateItems(
  ctx: LiquityContext,
  previousEvent?: BaseActivityEvent,
  currentEvent?: BaseActivityEvent,
  currentPrice?: number,
): ExplainerItem[] {
  let accruedInterest = 0;
  let accruedManagementFees = 0;
  if (previousEvent && currentEvent) {
    const calc = calculateInterestBetweenTransactions(currentEvent, previousEvent);
    accruedInterest = calc.accruedInterest;
    accruedManagementFees = calc.accruedManagementFees;
  }

  switch (ctx.operation) {
    case "openTrove":
    case "openTroveAndJoinBatch":
      return generateOpenTroveItems(ctx);
    case "closeTrove":
      return generateCloseTroveItems(ctx, accruedInterest);
    case "adjustTrove":
      return generateAdjustTroveItems(ctx, accruedInterest, accruedManagementFees);
    case "adjustTroveInterestRate":
      return generateAdjustRateItems(ctx, accruedInterest, accruedManagementFees);
    case "liquidate":
      return generateLiquidateItems(ctx);
    case "redeemCollateral":
    case "adjustZombieTrove":
    case "adjustUnredeemableZombieTrove":
      return generateRedeemItems(ctx, currentPrice);
    case "applyPendingDebt":
      return generateApplyPendingDebtItems(ctx);
    case "setInterestBatchManager":
      return generateSetBatchManagerItems(ctx, accruedInterest);
    case "removeFromBatch":
      return generateRemoveFromBatchItems(ctx, accruedInterest, accruedManagementFees);
    case "setBatchManagerAnnualInterestRate":
      return generateBatchRateUpdateItems(ctx);
    case "transferTrove":
      return generateTransferItems(ctx);
    default:
      return [
        {
          content: (
            <span>
              {ctx.operation} on the {ctx.collateralType} trove
            </span>
          ),
        },
      ];
  }
}

// ── Styles ──────────────────────────────────────────────────────────

// Explainer prose carries NO valence color or whole-sentence emphasis. A
// caution/critical signal (zombie, redemption, liquidation) lives on the card
// chrome — the badge, the spine warningTone, the pill — which is sufficient;
// repeating it as colored footnote text is redundant. The bullets stay in the
// muted body tone, with emphasis carried only by <V> on values mirrored in that
// chrome. The `type` field is retained for semantics/possible icon use but adds
// no text color. (Per Miles, 2026-06-19.)
const TYPE_STYLES: Record<string, string> = {
  warning: "",
  success: "",
  error: "",
  info: "",
};

// ── Component ───────────────────────────────────────────────────────

export interface LiquityEventExplainerProps {
  ctx: LiquityContext;
  previousEvent?: BaseActivityEvent;
  currentEvent?: BaseActivityEvent;
  /** Live oracle price — adds the "today" leg to the redemption P/L bullet. */
  currentPrice?: number;
  /** This transaction's gas cost — rendered as the trailing explainer bullet.
   *  Passed only for owner-paid events (passive redemption/liquidation gas is
   *  the third party's, so the card omits it). */
  gas?: GasCost;
}

function getLearnMoreContent(ctx: LiquityContext) {
  switch (ctx.operation) {
    case "openTrove":
    case "openTroveAndJoinBatch":
      return liquityOpenTroveContent();
    case "liquidate":
      return liquityLiquidationContent(ctx.collateralType);
    case "redeemCollateral":
    case "adjustZombieTrove":
    case "adjustUnredeemableZombieTrove":
      return liquityRedemptionContent(
        ctx.collateralType,
        ctx.stateAfter.annualInterestRate > 0 ? ctx.stateAfter.annualInterestRate : undefined,
      );
    case "closeTrove":
      return liquityCloseTroveContent();
    case "adjustTrove":
      return liquityAdjustTroveContent();
    case "adjustTroveInterestRate":
    case "applyPendingDebt":
      return liquityInterestRateContent(
        ctx.isInBatch
          ? {
              delegated: true,
              delegateName: ctx.batchManager ? getBatchManagerByAddress(ctx.batchManager)?.name : undefined,
            }
          : undefined,
      );
    case "setInterestBatchManager":
    case "removeFromBatch":
    case "setBatchManagerAnnualInterestRate":
      return liquityDelegationContent();
    case "transferTrove":
      return liquityTransferContent();
    default:
      // Never-empty floor: any unmapped operation still gets a generic modal.
      return liquityEventFallbackContent();
  }
}

/** Extract the first explainer bullet as a teaser for progressive disclosure */
export function getLiquityExplainerTeaser(
  ctx: LiquityContext,
  previousEvent?: BaseActivityEvent,
  currentEvent?: BaseActivityEvent,
): React.ReactNode | null {
  const items = generateItems(ctx, previousEvent, currentEvent);
  return items[0]?.content ?? null;
}

export function LiquityEventExplainer({
  ctx,
  previousEvent,
  currentEvent,
  currentPrice,
  gas,
  skipFirst,
}: LiquityEventExplainerProps & { skipFirst?: boolean }) {
  const allItems = generateItems(ctx, previousEvent, currentEvent, currentPrice);
  const baseItems = skipFirst ? allItems.slice(1) : allItems;
  // Per-transaction gas as the closing bullet (muted — not a header/grid value,
  // so no <V> emphasis per the highlight rule). Appended here, not in
  // generateItems, so it stays last regardless of skipFirst/teaser handling.
  // For a collapsed run the gas figure is the SUM across the run's txs.
  const items: ExplainerItem[] =
    gas && gas.gasCostEth > 0
      ? [
          ...baseItems,
          {
            content: ctx.noChangeRun ? (
              <span>
                Gas across these {ctx.noChangeRun.count.toLocaleString()} transactions: {formatGasCost(gas)}.
              </span>
            ) : (
              <span>Gas for this transaction: {formatGasCost(gas)}.</span>
            ),
          },
        ]
      : baseItems;
  const learnMore = getLearnMoreContent(ctx);

  if (items.length === 0 && !learnMore) return null;

  return (
    <div className="mt-2 text-sm leading-relaxed space-y-2 text-rb-500">
      {items.map((item, i) => (
        <div key={i} className="flex items-baseline gap-2">
          <span className="">•</span>
          <div className={TYPE_STYLES[item.type ?? ""] ?? ""}>{item.content}</div>
        </div>
      ))}
      {learnMore && <LearnMore content={learnMore} />}
    </div>
  );
}
