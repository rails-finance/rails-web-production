"use client";

import type { LiquityContext } from "@/lib/shared/types/protocols/liquity";
import type { BaseActivityEvent } from "@/lib/shared/types/activity";
import { calculateInterestBetweenTransactions } from "@/lib/liquity/utils/interest-calculator";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { LinkedAddress } from "@/components/shared/linked-address";
import { usePreferences } from "@/lib/shared/preferences-context";
import { formatRatio, ratioLabel, useLiquityRatioColorClass } from "@/lib/shared/ratio-format";
import { TransitionArrow, ClosedLabel, StateMetric, StateTransition } from "@/components/shared/state-transition";

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

  return (
    <StateMetric label="Debt">
      <div>
        <StateTransition>
          {hasChange && (
            <>
              <span className="text-sm font-bold text-rb-500">{toLocaleStringHelper(before)}</span>
              <TransitionArrow />
            </>
          )}
          {isClose ? (
            <ClosedLabel />
          ) : (
            <span className="text-sm font-bold ">{toLocaleStringHelper(after)}</span>
          )}
          <TokenChipIcon symbol={stablecoinSymbol} size={16} />
        </StateTransition>
        {((upfrontFee !== undefined && upfrontFee > 0) || totalAccruedFees > 0.01) && (
          <div className="text-xs  mt-0.5">
            {totalAccruedFees > 0.01 && (
              <span>incl. +{totalAccruedFees.toFixed(2)} interest</span>
            )}
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
  collSurplus,
}: {
  collateralType: string;
  before: number;
  after: number;
  beforeInUsd: number;
  afterInUsd: number;
  isClose: boolean;
  isLiquidation: boolean;
  collSurplus?: number;
}) {
  const hasChange = isClose ? before !== after : before !== 0 && before !== after;
  const hasSurplus = collSurplus !== undefined && collSurplus > 0;

  return (
    <StateMetric label="Collateral">
      <StateTransition>
        {hasChange && (
          <>
            <div className="flex items-center space-x-1">
              <span className="text-sm font-bold text-rb-500">{formatColl(before)}</span>
              {isLiquidation && beforeInUsd > 0 && (
                <span className="text-xs flex font-bold items-center text-rb-500 border-l-2 border-r-2 ml-2 border-rb-500 rounded-sm px-1 py-0">
                  {formatUsd(beforeInUsd)}
                </span>
              )}
            </div>
            <TransitionArrow />
          </>
        )}
        {isClose ? (
          <ClosedLabel />
        ) : (
          <div className="flex items-center">
            <span className="text-sm font-bold ">
              {after === 0 ? "0" : formatColl(after)}
            </span>
            {after > 0 && (
              <span className="text-xs flex font-bold items-center text-rb-500 border-l-2 border-r-2 ml-2 border-rb-500 rounded-sm px-1 py-0">
                {formatUsd(afterInUsd)}
              </span>
            )}
          </div>
        )}
        <TokenChipIcon symbol={collateralType} size={16} />
      </StateTransition>
      {hasSurplus && (
        <div className="text-xs text-green-400 mt-0.5">
          +{formatColl(collSurplus)} claimable surplus
        </div>
      )}
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
  const yearlyCost = afterDebt && hasAfterValue ? afterDebt * after : 0;

  return (
    <StateMetric label="Interest Rate">
      <StateTransition>
        {hasChange && (
          <>
            <span className="text-sm font-bold ">
              {(before * 100).toFixed(1)}<span className="ml-0.5">%</span>
            </span>
            <TransitionArrow />
          </>
        )}
        {isClose ? (
          <ClosedLabel />
        ) : !hasAfterValue ? (
          <span className="text-sm font-bold ">N/A</span>
        ) : (
          <span className="text-sm font-bold ">
            {(after * 100).toFixed(1)}<span className="ml-0.5">%</span>
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

function CollateralRatioMetric({ before, after, afterDebt, isClose }: { before: number; after: number; afterDebt: number; isClose: boolean }) {
  const { prefs } = usePreferences();
  const mode = prefs.ratioMode;
  const crColor = useLiquityRatioColorClass();
  const hasChange = before !== 0 && before !== after;

  return (
    <StateMetric label={ratioLabel(mode)}>
      <StateTransition>
        {hasChange && (
          <>
            <span className={`text-sm font-bold ${crColor(before)}`}>
              {formatRatio(before, mode, 2)}
            </span>
            <TransitionArrow />
          </>
        )}
        {isClose ? (
          <ClosedLabel />
        ) : afterDebt === 0 ? (
          <span className="text-sm font-bold ">N/A</span>
        ) : (
          <span className={`text-sm font-bold ${crColor(after)}`}>
            {formatRatio(after, mode, 2)}
          </span>
        )}
      </StateTransition>
    </StateMetric>
  );
}

// ── Stat (for breakdown sections) ───────────────────────────────────

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex flex-col">
      <span className=" text-xs">{label}</span>
      <span className={`font-bold text-sm ${className ?? ""}`}>{value}</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

export interface LiquityEventDetailProps {
  ctx: LiquityContext;
  txHash: string;
  previousEvent?: BaseActivityEvent;
  currentEvent?: BaseActivityEvent;
}

export function LiquityEventDetail({ ctx, txHash, previousEvent, currentEvent }: LiquityEventDetailProps) {
  const { stateBefore, stateAfter, troveOperation, liquidation, redemption } = ctx;

  if (!stateBefore || !stateAfter) {
    return null;
  }

  const isClose = ctx.operation === "closeTrove";
  const isLiquidation = ctx.operation === "liquidate";
  const isRedemption = ctx.operation === "redeemCollateral" || ctx.operation === "adjustZombieTrove" || ctx.operation === "adjustUnredeemableZombieTrove";
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
    beforeColl = liquidation.collSentToSP + liquidation.collRedistributed + liquidation.collSurplus + liquidation.collGasCompensation;
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
  const claimableSurplus = liquidation && liquidation.collSurplus > 0 ? liquidation.collSurplus : undefined;

  const showGrid = beforeDebt > 0 || stateAfter.debt > 0 || isClose;

  return (
    <>
      {/* 2×2 State Grid — rails-web pattern */}
      {showGrid && (
        <div className="px-4 pt-3 pb-3">
          {isBatchManagerOp ? (
            <div className="grid grid-cols-2 gap-6">
              <InterestRateMetric
                before={beforeInterestRate}
                after={stateAfter.annualInterestRate}
                isClose={false}
                afterDebt={stateAfter.debt}
                stablecoinSymbol={ctx.assetType}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <CollateralMetric
                collateralType={ctx.collateralType}
                before={beforeColl}
                after={stateAfter.coll}
                beforeInUsd={beforeCollInUsd}
                afterInUsd={afterCollInUsd}
                isClose={isClose}
                isLiquidation={isLiquidation}
                collSurplus={claimableSurplus}
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
              <CollateralRatioMetric before={beforeCollRatio} after={stateAfter.collateralRatio} afterDebt={stateAfter.debt} isClose={isClose} />
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

      {/* Redemption counterparty info */}
      {isRedemption && (ctx.troveOwner || ctx.redeemer) && (
        <div className="px-4 py-2 flex items-center gap-3 flex-wrap">
          {ctx.troveOwner && (
            <span className="text-xs ">
              Owner: <LinkedAddress address={ctx.troveOwner} />
            </span>
          )}
          {ctx.redeemer && (
            <span className="text-xs ">
              Redeemed by: <LinkedAddress address={ctx.redeemer} />
            </span>
          )}
        </div>
      )}

      {/* Liquidation breakdown */}
      {liquidation && (
        <div className="px-4 py-2">
          <span className="text-sm font-semibold text-red-400">Liquidation Breakdown</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            <Stat label="Debt offset by SP" value={`${toLocaleStringHelper(liquidation.debtOffsetBySP)} ${ctx.assetType ?? "BOLD"}`} />
            {liquidation.debtRedistributed > 0 && (
              <Stat label="Debt redistributed" value={`${toLocaleStringHelper(liquidation.debtRedistributed)} ${ctx.assetType ?? "BOLD"}`} />
            )}
            <Stat label="Coll to SP" value={`${formatColl(liquidation.collSentToSP)} ${ctx.collateralType} (${formatUsd(liquidation.collSentToSP * liquidation.price)})`} />
            {liquidation.collRedistributed > 0 && (
              <Stat label="Coll redistributed" value={`${formatColl(liquidation.collRedistributed)} ${ctx.collateralType}`} />
            )}
            {liquidation.collSurplus > 0 && (
              <Stat label="Surplus returned" value={`${formatColl(liquidation.collSurplus)} ${ctx.collateralType} (${formatUsd(liquidation.collSurplus * liquidation.price)})`} className="text-green-400" />
            )}
            <Stat label="Price" value={formatUsd(liquidation.price)} />
            {liquidation.boldGasCompensation > 0 && (
              <Stat label="Gas Compensation" value={`${toLocaleStringHelper(liquidation.boldGasCompensation)} ${ctx.assetType ?? "BOLD"} + ${formatColl(liquidation.collGasCompensation)} ${ctx.collateralType}`} />
            )}
          </div>
        </div>
      )}

      {/* Redemption breakdown */}
      {redemption && (
        <div className="px-4 py-2">
          <span className="text-sm font-semibold text-amber-400">Redemption Breakdown</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {redemption.attemptedBoldAmount !== redemption.actualBoldAmount && (
              <Stat label="Attempted" value={`${toLocaleStringHelper(redemption.attemptedBoldAmount)} ${ctx.assetType ?? "BOLD"}`} />
            )}
            <Stat label={`${ctx.assetType ?? "BOLD"} redeemed`} value={`${toLocaleStringHelper(redemption.actualBoldAmount)} ${ctx.assetType ?? "BOLD"}`} />
            <Stat label="Coll taken" value={`${formatColl(redemption.ETHSent)} ${ctx.collateralType} (${formatUsd(redemption.ETHSent * redemption.price)})`} />
            {redemption.ETHFee && Number(redemption.ETHFee) > 0 && (
              <Stat label="Fee retained" value={`${formatColl(Number(redemption.ETHFee))} ${ctx.collateralType}`} className="text-green-400" />
            )}
            <Stat label="Price" value={formatUsd(redemption.price)} />
            {(() => {
              const collValue = redemption.ETHSent * redemption.price;
              const pl = redemption.actualBoldAmount - collValue;
              return Math.abs(pl) > 0.01 ? (
                <Stat label="Borrower P/L" value={`${pl > 0 ? '+' : ''}${formatUsd(Math.abs(pl))}`} className={pl > 0 ? "text-green-400" : "text-red-400"} />
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* Zombie + batch badges + historic collateral price pill */}
      {(ctx.isZombieTrove || ctx.isInBatch || collPrice > 0) && (
        <div className="flex items-center gap-2 px-4 py-2">
          {ctx.isZombieTrove && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">Zombie Trove</span>
          )}
          {ctx.isInBatch && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 font-bold">Batched</span>
          )}
          {collPrice > 0 && (
            <span
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-rb-500 bg-rb-200/60 dark:bg-rb-800/60 px-2 py-1 rounded-md"
              title={`${ctx.collateralType} price at the time of this event`}
            >
              {formatUsd(collPrice)}
              <TokenChipIcon symbol={ctx.collateralType} size={14} />
            </span>
          )}
        </div>
      )}

    </>
  );
}
