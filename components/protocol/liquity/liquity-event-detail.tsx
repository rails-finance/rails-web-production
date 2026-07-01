"use client";

import type { LiquityContext } from "@/lib/shared/types/protocols/liquity";
import type { BaseActivityEvent } from "@/lib/shared/types/activity";
import { calculateInterestBetweenTransactions } from "@/lib/liquity/utils/interest-calculator";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { LinkedAddress } from "@/components/shared/linked-address";
import { usePreferences } from "@/lib/shared/preferences-context";
import { formatRatio, ratioLabel, useLiquityRatioColorClass } from "@/lib/shared/ratio-format";
import {
  TransitionArrow,
  DeltaToggle,
  ClosedLabel,
  StateMetric,
  StateTransition,
} from "@/components/shared/state-transition";
import { useTimelineDisplay } from "@/components/shared/timeline-display-context";
import { fmtTokenAmount } from "@/lib/shared/format-event";

// ── Formatters ──────────────────────────────────────────────────────

function toLocaleStringHelper(n: number): string {
  if (Math.abs(n) < 0.01) return "0";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatColl(n: number): string {
  if (n === 0) return "0";
  return n.toFixed(4);
}

function formatUsd(value: number | undefined | null): string {
  if (value == null || isNaN(value) || value < 0.01) return "< $0.01";
  if (value < 1) return `$${value.toFixed(2)}`;
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ── Metric components ───────────────────────────────────────────────

function DebtMetric({
  before,
  after,
  isClose,
  isLiquidation,
  upfrontFee,
  accruedInterest,
  accruedManagementFees,
  stablecoinSymbol = "BOLD",
}: {
  before: number;
  after: number;
  isClose: boolean;
  isLiquidation: boolean;
  upfrontFee?: number;
  accruedInterest: number;
  accruedManagementFees: number;
  stablecoinSymbol?: string;
}) {
  const hasChange = isClose ? before !== after : before !== 0 && before !== after;
  const totalAccruedFees = accruedInterest + accruedManagementFees;

  // The arrow doubles as a toggle (see DeltaToggle). The header headline and
  // timeline spine both show the borrowed/repaid *principal*; the fee-inclusive
  // total debt change (principal + fee + interest = after − before) is the one
  // thing they don't surface, so clicking swaps `before →` for `+delta =`.
  const delta = after - before;
  const deltaStr = `${delta >= 0 ? "+" : "−"}${fmtTokenAmount(Math.abs(delta), 1)}`;

  return (
    <StateMetric label="Debt">
      <div>
        <StateTransition>
          {hasChange && <DeltaToggle before={toLocaleStringHelper(before)} delta={isClose ? null : deltaStr} />}
          {isClose ? (
            <ClosedLabel />
          ) : (
            <span className={hasChange ? "text-sm font-semibold" : "text-sm font-semibold text-rb-500"}>
              {toLocaleStringHelper(after)}
            </span>
          )}
          <TokenChipIcon symbol={stablecoinSymbol} size={16} />
        </StateTransition>
        {((upfrontFee !== undefined && upfrontFee > 0) || totalAccruedFees > 0.01) && (
          <div className="text-xs  mt-0.5">
            {totalAccruedFees > 0.01 && <span>incl. +{totalAccruedFees.toFixed(2)} interest</span>}
            {upfrontFee !== undefined && upfrontFee > 0 && (
              <>
                {totalAccruedFees > 0.01 && <span> +</span>}
                <span>{toLocaleStringHelper(upfrontFee)} fee</span>
              </>
            )}
          </div>
        )}
      </div>
    </StateMetric>
  );
}

function CollateralMetric({
  collateralType,
  before,
  after,
  beforeInUsd,
  afterInUsd,
  isClose,
  isLiquidation,
}: {
  collateralType: string;
  before: number;
  after: number;
  beforeInUsd: number;
  afterInUsd: number;
  isClose: boolean;
  isLiquidation: boolean;
}) {
  const { showUsdValues } = useTimelineDisplay();
  const hasChange = isClose ? before !== after : before !== 0 && before !== after;

  // Same arrow-as-toggle as Debt: `before →` ⟷ `+delta =` (delta in collateral
  // units). Disabled on close, where the "after" is the CLOSED label, not a
  // number to diff against.
  const collDelta = after - before;
  const collDeltaStr = `${collDelta >= 0 ? "+" : "−"}${formatColl(Math.abs(collDelta))}`;

  return (
    <StateMetric label="Collateral">
      <StateTransition>
        {hasChange && (
          <DeltaToggle
            before={formatColl(before)}
            delta={isClose ? null : collDeltaStr}
            beforeExtra={
              showUsdValues && isLiquidation && beforeInUsd > 0 ? (
                <span className="text-xs flex font-bold items-center text-rb-500 border-l-2 border-r-2 border-rb-500 rounded-sm px-1 py-0">
                  {formatUsd(beforeInUsd)}
                </span>
              ) : undefined
            }
          />
        )}
        {isClose ? (
          <ClosedLabel />
        ) : (
          <span className={hasChange ? "text-sm font-semibold" : "text-sm font-semibold text-rb-500"}>
            {after === 0 ? "0" : formatColl(after)}
          </span>
        )}
        <TokenChipIcon symbol={collateralType} size={16} />
        {showUsdValues && !isClose && after > 0 && (
          <span className="text-xs flex font-bold items-center text-rb-500 border-l-2 border-r-2 border-rb-500 rounded-sm px-1 py-0">
            {formatUsd(afterInUsd)}
          </span>
        )}
      </StateTransition>
    </StateMetric>
  );
}

function InterestRateMetric({
  before,
  after,
  isClose,
  afterDebt,
  stablecoinSymbol = "BOLD",
}: {
  before: number;
  after: number;
  isClose: boolean;
  afterDebt?: number;
  stablecoinSymbol?: string;
}) {
  const hasBeforeValue = before > 0;
  const hasAfterValue = after > 0;
  const hasChange = hasBeforeValue && before !== after;
  // annualInterestRate is in percent units (3.4 = 3.4% APR), so divide by 100
  // to get the fractional rate for the BOLD/year cost.
  const yearlyCost = afterDebt && hasAfterValue ? afterDebt * (after / 100) : 0;

  return (
    <StateMetric label="Interest Rate">
      <StateTransition>
        {hasChange && (
          <>
            <span className="text-sm font-semibold">
              {before.toFixed(1)}
              <span className="ml-0.5">%</span>
            </span>
            <TransitionArrow />
          </>
        )}
        {isClose ? (
          <ClosedLabel />
        ) : !hasAfterValue ? (
          <span className="text-sm font-semibold text-rb-500">N/A</span>
        ) : (
          <span className={hasChange ? "text-sm font-semibold" : "text-sm font-semibold text-rb-500"}>
            {after.toFixed(1)}
            <span className="ml-0.5">%</span>
          </span>
        )}
      </StateTransition>
      {!isClose && yearlyCost > 0.01 && (
        <div className="text-xs  mt-0.5 tabular-nums">
          {toLocaleStringHelper(yearlyCost)} {stablecoinSymbol} / year
        </div>
      )}
    </StateMetric>
  );
}

function CollateralRatioMetric({
  before,
  after,
  afterDebt,
  isClose,
  collateralType,
}: {
  before: number;
  after: number;
  afterDebt: number;
  isClose: boolean;
  collateralType: string;
}) {
  const { prefs } = usePreferences();
  const mode = prefs.ratioMode;
  const crColor = useLiquityRatioColorClass();
  const hasChange = before !== 0 && before !== after;

  // Delta in the displayed mode's own units (percentage points). CR is linear
  // so the delta is just after − before; LTV is 1/CR, so we diff the converted
  // values (`10000/cr`) rather than the raw CR. Disabled on close and when the
  // after side is N/A (debt fully repaid → no meaningful ratio to diff).
  const beforeDisp = mode === "ltv" ? 10000 / before : before;
  const afterDisp = mode === "ltv" ? 10000 / after : after;
  const ratioDelta = afterDisp - beforeDisp;
  const ratioDeltaStr = `${ratioDelta >= 0 ? "+" : "−"}${Math.abs(ratioDelta).toFixed(2)}%`;
  const ratioCanToggle = !isClose && afterDebt !== 0 && isFinite(afterDisp);

  return (
    <StateMetric label={ratioLabel(mode)}>
      <StateTransition>
        {hasChange && (
          <DeltaToggle
            before={formatRatio(before, mode, 2)}
            delta={ratioCanToggle ? ratioDeltaStr : null}
            beforeClass={`text-sm font-semibold ${crColor(before, collateralType)}`}
          />
        )}
        {isClose ? (
          <ClosedLabel />
        ) : afterDebt === 0 ? (
          <span className="text-sm font-semibold text-rb-500">N/A</span>
        ) : (
          <span
            className={
              hasChange
                ? `text-sm font-semibold ${crColor(after, collateralType)}`
                : "text-sm font-semibold text-rb-500"
            }
          >
            {formatRatio(after, mode, 2)}
          </span>
        )}
      </StateTransition>
    </StateMetric>
  );
}

// ── Main component ──────────────────────────────────────────────────

export interface LiquityEventDetailProps {
  ctx: LiquityContext;
  txHash: string;
  previousEvent?: BaseActivityEvent;
  currentEvent?: BaseActivityEvent;
  /** Live oracle price for this collateral — drives the "today" leg of the
   * redemption P/L shown alongside the historic price pill. */
  currentPrice?: number;
}

export function LiquityEventDetail({
  ctx,
  txHash,
  previousEvent,
  currentEvent,
  currentPrice,
}: LiquityEventDetailProps) {
  const { stateBefore, stateAfter, troveOperation, liquidation, redemption } = ctx;

  if (!stateBefore || !stateAfter) {
    return null;
  }

  const isClose = ctx.operation === "closeTrove";
  const isLiquidation = ctx.operation === "liquidate";
  const isRedemption =
    ctx.operation === "redeemCollateral" ||
    ctx.operation === "adjustZombieTrove" ||
    ctx.operation === "adjustUnredeemableZombieTrove";
  const isBatchManagerOp = ctx.operation === "setBatchManagerAnnualInterestRate";
  const collPrice = ctx.collateralPrice ?? 0;

  // Calculate accrued interest
  let accruedInterest = 0;
  let accruedManagementFees = 0;
  if (previousEvent && currentEvent) {
    const calc = calculateInterestBetweenTransactions(currentEvent, previousEvent);
    accruedInterest = calc.accruedInterest;
    accruedManagementFees = calc.accruedManagementFees;
  }

  // Upfront fee
  const upfrontFee = troveOperation?.debtIncreaseFromUpfrontFee;

  // Reconstruct before state
  let beforeDebt = stateBefore.debt;
  let beforeColl = stateBefore.coll;
  let beforeCollInUsd = stateBefore.collateralInUsd;
  let beforeInterestRate = stateBefore.annualInterestRate;
  let beforeCollRatio = stateBefore.collateralRatio;

  if (isClose && troveOperation && stateBefore.debt === 0 && stateBefore.coll === 0) {
    beforeDebt = Math.abs(troveOperation.debtChangeFromOperation);
    beforeColl = Math.abs(troveOperation.collChangeFromOperation);
    beforeCollInUsd = beforeColl * collPrice;
  }

  if (isLiquidation && liquidation) {
    beforeDebt = liquidation.debtOffsetBySP + liquidation.debtRedistributed;
    beforeColl =
      liquidation.collSentToSP +
      liquidation.collRedistributed +
      liquidation.collSurplus +
      liquidation.collGasCompensation;
    beforeCollInUsd = beforeColl * liquidation.price;
    if (beforeCollInUsd > 0 && beforeDebt > 0) {
      beforeCollRatio = (beforeCollInUsd / beforeDebt) * 100;
    }
  }

  if (isRedemption && troveOperation) {
    const debtChange = Math.abs(troveOperation.debtChangeFromOperation);
    const collChange = Math.abs(troveOperation.collChangeFromOperation);
    beforeDebt = stateAfter.debt + debtChange;
    beforeColl = stateAfter.coll + collChange;
    beforeCollInUsd = beforeColl * collPrice;
    if (beforeCollInUsd > 0 && beforeDebt > 0) {
      beforeCollRatio = (beforeCollInUsd / beforeDebt) * 100;
    }
  }

  const afterCollInUsd = stateAfter.coll * collPrice;

  const showGrid = beforeDebt > 0 || stateAfter.debt > 0 || isClose;

  return (
    <>
      {/* 2×2 State Grid — rails-web pattern */}
      {showGrid && (
        <div className="px-5 py-2">
          {isBatchManagerOp ? (
            <div className="grid grid-cols-1 gap-2.5 sm:auto-rows-fr sm:grid-cols-2">
              <InterestRateMetric
                before={beforeInterestRate}
                after={stateAfter.annualInterestRate}
                isClose={false}
                afterDebt={stateAfter.debt}
                stablecoinSymbol={ctx.assetType}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:auto-rows-fr sm:grid-cols-2">
              <CollateralMetric
                collateralType={ctx.collateralType}
                before={beforeColl}
                after={stateAfter.coll}
                beforeInUsd={beforeCollInUsd}
                afterInUsd={afterCollInUsd}
                isClose={isClose}
                isLiquidation={isLiquidation}
              />
              <DebtMetric
                before={beforeDebt}
                after={stateAfter.debt}
                isClose={isClose}
                isLiquidation={isLiquidation}
                upfrontFee={upfrontFee}
                accruedInterest={accruedInterest}
                accruedManagementFees={accruedManagementFees}
                stablecoinSymbol={ctx.assetType}
              />
              <CollateralRatioMetric
                before={beforeCollRatio}
                after={stateAfter.collateralRatio}
                afterDebt={stateAfter.debt}
                isClose={isClose}
                collateralType={ctx.collateralType}
              />
              <InterestRateMetric
                before={beforeInterestRate}
                after={stateAfter.annualInterestRate}
                isClose={isClose}
                afterDebt={stateAfter.debt}
                stablecoinSymbol={ctx.assetType}
              />
            </div>
          )}
        </div>
      )}

      {/* Redemption counterparty — claimable + P/L now live inline in the
          header; only the redeemer link remains here (when present). The
          redemption-wide totals and fee detail live in the explainer. */}
      {isRedemption && ctx.redeemer && (
        <div className="px-5 py-2">
          <span className="text-xs text-rb-500">
            Redeemed by: <LinkedAddress address={ctx.redeemer} />
          </span>
        </div>
      )}

      {/* Liquidation breakdown intentionally lives only in the event footnote
          (explainer) now — the per-line detail (debt cleared, collateral
          liquidated, claimable surplus, SP/liquidator splits) is generated
          there by generateLiquidateItems, so it no longer appears in the
          details body. */}

      {/* Historic collateral price pill, sharing its row with the redemption
          P/L (net outcome) on the left. P/L reconciles with the Cleared /
          Reduced figures in the header: debt cleared minus the value of
          collateral given up, at the redemption-time price and (when
          available) at today's price. (Batch membership is conveyed by the
          "Delegate" treatment on interest-rate events, so no standalone
          "Batched" badge here.) */}
      {collPrice > 0 && (
        <div className="flex items-center gap-2 px-4 py-2">
          {ctx.operation === "redeemCollateral" &&
            (() => {
              const debtChange = troveOperation
                ? troveOperation.debtChangeFromOperation +
                  troveOperation.debtIncreaseFromRedist +
                  troveOperation.debtIncreaseFromUpfrontFee
                : stateAfter.debt - stateBefore.debt;
              const collChange = troveOperation
                ? troveOperation.collChangeFromOperation + troveOperation.collIncreaseFromRedist
                : stateAfter.coll - stateBefore.coll;
              const showClaimable = ctx.isZombieTrove && stateAfter.debt === 0 && stateAfter.coll > 0;
              const debtCleared = Math.abs(debtChange);
              const collLost = Math.abs(collChange);
              const plHistoric = debtCleared - collLost * collPrice;
              const plToday = currentPrice ? debtCleared - collLost * currentPrice : null;
              const showPl = debtCleared > 0.01;
              // Only surface "today" when it diverges from the historic figure.
              const showToday = plToday != null && Math.abs(plToday - plHistoric) > 0.01;
              const plStr = (n: number) => `${n >= 0 ? "+" : "−"}${formatUsd(Math.abs(n))}`;
              const plColor = (n: number) => (n >= 0 ? "text-green-400" : "text-red-400");
              if (!showClaimable && !showPl) return null;
              return (
                <div className="inline-flex items-center gap-4 flex-wrap text-xs">
                  {showClaimable && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-bold text-foreground">{stateAfter.coll.toFixed(4)}</span>
                      <TokenChipIcon symbol={ctx.collateralType} size={14} />
                      <span className="font-semibold text-green-600 dark:text-green-400">claimable</span>
                    </span>
                  )}
                  {showPl && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-rb-500">P/L</span>
                      <span className={`font-bold ${plColor(plHistoric)}`}>{plStr(plHistoric)}</span>
                      {showToday && (
                        <>
                          <span className="text-rb-500">or</span>
                          <span className={`font-bold ${plColor(plToday!)}`}>{plStr(plToday!)}</span>
                          <span className="text-rb-500">today</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
              );
            })()}
          <span
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-rb-500 bg-background px-2 py-1 rounded-md"
            title={`${ctx.collateralType} price at the time of this event`}
          >
            {formatUsd(collPrice)}
            <TokenChipIcon symbol={ctx.collateralType} size={14} />
          </span>
        </div>
      )}
    </>
  );
}
