"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import type { SpineTokenRow } from "@/components/shared/spine-column";
import { simulateTrove } from "@/lib/liquity/utils/simulate";
import { useTroveSimulator } from "@/lib/liquity/use-simulator";
import { usePreferences } from "@/lib/shared/preferences-context";
import { formatRatio, ratioLabel, ratioColorClass } from "@/lib/shared/ratio-format";
import { TransitionArrow, StateMetric } from "@/components/shared/state-transition";
import { DeltaArrow, EditableNumber, SimSlider } from "@/components/shared/simulator-inputs";
import {
  SimulatorCardShell,
  type SimulatorActionChip,
} from "@/components/shared/simulator-card-shell";

const crColor = (cr: number) => ratioColorClass(cr);

export interface TroveSimSnapshot {
  coll: number;
  debt: number;
  /** Annual interest rate in **percent units** (0.9 = 0.9% APR) — matches the
   *  convention rails-server-mig's API uses (decoded as decimals=16, leaving
   *  the value already in percent). See lib/liquity/utils/interest-calculator.ts. */
  annualInterestRate: number;
  collateralType: string;
  stablecoinSymbol: string;
}

export interface LiquitySimulatorCardProps {
  /** Trove ID — published with edits so the economics chart can match. */
  troveId: string;
  current: TroveSimSnapshot;
  currentPrice: number;
  avatar?: React.ReactNode;
  onClose?: () => void;
}

function toLocaleStringHelper(n: number): string {
  if (Math.abs(n) < 0.01) return "0";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatColl(n: number): string {
  if (n === 0) return "0";
  return n.toFixed(4);
}

function formatUsd(v: number): string {
  if (v < 0.01) return "< $0.01";
  if (v < 1) return `$${v.toFixed(2)}`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function LiquitySimulatorCard({ troveId, current, currentPrice, avatar, onClose }: LiquitySimulatorCardProps) {
  const { prefs } = usePreferences();
  const ratioMode = prefs.ratioMode;
  const simulator = useTroveSimulator();
  // After-state for coll/debt starts at zero, signalling "imagine the trove is
  // closed, now plan your changes". Rate + price stay at the live values
  // because they are properties of the trove / market, not user actions —
  // dropping them to zero would crash the price-axis math and force the user
  // to set them before any what-if is meaningful.
  const [simCollRaw, setSimCollRaw] = useState(0);
  const [simDebtRaw, setSimDebtRaw] = useState(0);
  // simRatePct mirrors the input verbatim — the snapshot value is already in
  // percent units (e.g. 0.9 means 0.9% APR), so no scale conversion here. We
  // divide by 100 only when feeding simulateTrove (which expects a fraction).
  const [simRatePct, setSimRatePct] = useState(current.annualInterestRate);
  const [simPrice, setSimPrice] = useState(currentPrice);

  // Per-field "user has touched this" flags. Lets us keep the header pinned to
  // "What if?" until the user actually edits coll or debt — without these
  // flags the default after=0 would immediately fire "Withdraw all + Repay
  // all" chips, which reads as a decision the user hasn't made yet.
  const [collEdited, setCollEdited] = useState(false);
  const [debtEdited, setDebtEdited] = useState(false);
  const [rateEdited, setRateEdited] = useState(false);
  const [priceEdited, setPriceEdited] = useState(false);

  const setSimColl = (v: number) => { setSimCollRaw(v); setCollEdited(true); };
  const setSimDebt = (v: number) => { setSimDebtRaw(v); setDebtEdited(true); };
  const setSimRate = (v: number) => { setSimRatePct(v); setRateEdited(true); };
  const setSimPriceAndMark = (v: number) => { setSimPrice(v); setPriceEdited(true); };

  // The values that flow into the math + display. Until the user touches the
  // field, simColl/simDebt stay at zero (the "untouched" sentinel) and
  // simRatePct/simPrice stay at the live snapshot.
  const simColl = simCollRaw;
  const simDebt = simDebtRaw;

  // Oracle price is driven by the draggable tick on the liquidation-price
  // axis, not a slider inside this card. Pick up new requestedPrice values
  // from the simulator context so the card's derived state stays in sync.
  // Dragging the oracle is a user action, so it counts as a price edit.
  const requestedPrice = simulator?.requestedPrice ?? null;
  useEffect(() => {
    if (requestedPrice != null && requestedPrice > 0) setSimPriceAndMark(requestedPrice);
  }, [requestedPrice]);

  const reset = useCallback(() => {
    // Resets to the same "after = 0 for coll/debt, after = current for
    // rate/price" baseline the simulator opens in. Uses the raw setters so
    // the edited flags clear at the same time — otherwise the next render
    // would still see the field as touched and keep the chips alive.
    setSimCollRaw(0);
    setSimDebtRaw(0);
    setSimRatePct(current.annualInterestRate);
    setSimPrice(currentPrice);
    setCollEdited(false);
    setDebtEdited(false);
    setRateEdited(false);
    setPriceEdited(false);
  }, [current, currentPrice]);

  // Publish live edits — ref-guarded so the effect depends on primitives only,
  // mirroring the LlamaLend pattern (publishEdits swaps the provider value,
  // which would otherwise loop).
  const simulatorRef = useRef(simulator);
  useEffect(() => { simulatorRef.current = simulator; });
  useEffect(() => {
    // Edits are published as fractions (consumers of LiquitySimulatorEdits
    // assume 0.05 = 5%); convert from the percent-units we hold internally.
    // Unedited fields fall back to the live snapshot so downstream consumers
    // (price axis, segment builders) keep showing the real trove until the
    // user actually changes that field — the after=0 default is meaningful
    // inside the card but would read as "trove unwound" everywhere else.
    simulatorRef.current?.publishEdits({
      troveId,
      base: { coll: current.coll, debt: current.debt, rate: current.annualInterestRate / 100, price: currentPrice },
      sim: {
        coll: collEdited ? simColl : current.coll,
        debt: debtEdited ? simDebt : current.debt,
        rate: (rateEdited ? simRatePct : current.annualInterestRate) / 100,
        price: priceEdited ? simPrice : currentPrice,
      },
    });
  }, [troveId, current.coll, current.debt, current.annualInterestRate, currentPrice, simColl, simDebt, simRatePct, simPrice, collEdited, debtEdited, rateEdited, priceEdited]);
  useEffect(() => () => { simulatorRef.current?.publishEdits(null); }, []);

  const sim = useMemo(
    () => simulateTrove({ coll: simColl, debt: simDebt, rate: simRatePct / 100, price: simPrice }),
    [simColl, simDebt, simRatePct, simPrice],
  );
  const base = useMemo(
    () => simulateTrove({ coll: current.coll, debt: current.debt, rate: current.annualInterestRate / 100, price: currentPrice }),
    [current, currentPrice],
  );

  const collDelta = simColl - current.coll;
  const debtDelta = simDebt - current.debt;
  // A field is "changed" only after the user has actually touched it. The
  // default after=0 baseline for coll/debt would otherwise read as a giant
  // Withdraw + Repay every time the simulator opens.
  const hasCollChange = collEdited && Math.abs(collDelta) >= 0.0001;
  const hasDebtChange = debtEdited && Math.abs(debtDelta) >= 0.01;
  const hasRateChange = rateEdited && simRatePct !== current.annualInterestRate;
  const hasPriceChange = priceEdited && simPrice !== currentPrice;
  const hasChanges = hasCollChange || hasDebtChange || hasRateChange || hasPriceChange;

  // Ranges — match original simulator
  const collMax = Math.max(current.coll * 3, 10);
  const debtMax = Math.max(current.debt * 3, 5000);

  // Liquity V2 charges a minimum of (1 week) * annualRate on any debt increase.
  const upfrontFee = debtDelta > 0 ? (debtDelta * (simRatePct / 100) * 7) / 365 : 0;

  const chips: SimulatorActionChip[] = [];
  if (hasCollChange) {
    chips.push({
      label: collDelta > 0 ? "Add" : "Withdraw",
      symbol: current.collateralType,
      amount: Math.abs(collDelta),
    });
  }
  if (hasDebtChange) {
    chips.push({
      label: debtDelta > 0 ? "Borrow" : "Repay",
      symbol: current.stablecoinSymbol,
      amount: Math.abs(debtDelta),
    });
  }

  const tokens: SpineTokenRow[] = [];
  if (hasCollChange) {
    tokens.push({
      symbol: current.collateralType,
      direction: collDelta > 0 ? "right" : "left",
      value: Math.abs(collDelta),
    });
  }
  if (hasDebtChange) {
    tokens.push({
      symbol: current.stablecoinSymbol,
      direction: debtDelta > 0 ? "left" : "right",
      value: Math.abs(debtDelta),
    });
  }

  return (
    <SimulatorCardShell
      avatar={avatar}
      tokens={tokens}
      actionChips={chips}
      hasChanges={hasChanges}
      onReset={reset}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {/* Collateral */}
        <StateMetric label="Collateral">
          <div className="flex items-center space-x-1 mb-2">
            <span className="text-sm font-bold text-rb-500">{formatColl(current.coll)}</span>
            <DeltaArrow
              base={current.coll}
              onChange={setSimColl}
              min={0}
              max={collMax}
              decimals={4}
            />
            <EditableNumber
              value={simColl}
              decimals={4}
              onChange={setSimColl}
              min={0}
              max={collMax}
            />
            <TokenChipIcon symbol={current.collateralType} size={16} />
            <span className="text-xs flex font-bold items-center text-rb-500 border-l-2 border-r-2 ml-1 border-rb-500 rounded-sm px-1 py-0">
              {formatUsd(sim.collValueUsd)}
            </span>
          </div>
          <SimSlider
            value={simColl}
            onChange={setSimColl}
            min={0}
            max={collMax}
            step={0.01}
            gradient="health"
          />
        </StateMetric>

        {/* Debt */}
        <StateMetric label="Debt">
          <div className="flex items-center space-x-1 mb-2">
            <span className="text-sm font-bold text-rb-500">{toLocaleStringHelper(current.debt)}</span>
            <DeltaArrow
              base={current.debt}
              onChange={setSimDebt}
              min={0}
              max={debtMax}
              decimals={0}
            />
            <EditableNumber
              value={simDebt}
              decimals={0}
              onChange={setSimDebt}
              min={0}
              max={debtMax}
            />
            <TokenChipIcon symbol={current.stablecoinSymbol} size={16} />
          </div>
          <SimSlider
            value={simDebt}
            onChange={setSimDebt}
            min={0}
            max={debtMax}
            step={1}
            gradient="risk"
          />
          {upfrontFee > 0.01 && (
            <div className="text-xs  mt-1 tabular-nums">
              + {toLocaleStringHelper(upfrontFee)} fee
            </div>
          )}
        </StateMetric>

        {/* Collateral Ratio / LTV. Oracle price lives on the liquidation-price
            axis above; this cell just surfaces the derived CR transition. */}
        <StateMetric label={ratioLabel(ratioMode)}>
          <div className="flex items-center space-x-1 mb-2">
            <span className={`text-sm font-bold ${crColor(base.cr)}`}>
              {formatRatio(base.cr, ratioMode, 2)}
            </span>
            <TransitionArrow />
            <span className={`text-sm font-bold tabular-nums ${crColor(sim.cr)}`}>
              {simDebt > 0 ? formatRatio(sim.cr, ratioMode, 2) : "N/A"}
            </span>
          </div>
          {sim.liqPrice > 0 && (
            <div className="text-xs text-rb-500 tabular-nums">
              Liq. {formatUsd(sim.liqPrice)}
              {sim.liqPrice >= simPrice * 0.8 && (
                <span className="ml-1 text-yellow-400">⚠</span>
              )}
            </div>
          )}
        </StateMetric>

        {/* Interest Rate. Stored in percent units (0.9 = 0.9% APR), so no
            scale conversion before display — DeltaArrow + EditableNumber
            both read/write the same percent number. */}
        <StateMetric label="Interest Rate">
          <div className="flex items-center space-x-1 mb-2">
            <span className="text-sm font-bold text-rb-500">
              {current.annualInterestRate.toFixed(1)}<span className="ml-0.5">%</span>
            </span>
            <DeltaArrow
              base={current.annualInterestRate}
              onChange={setSimRate}
              min={0.5}
              max={25}
              decimals={1}
            />
            <EditableNumber
              value={simRatePct}
              decimals={1}
              onChange={setSimRate}
              min={0.5}
              max={25}
              className=""
            />
            <span className="text-sm ">%</span>
          </div>
          <SimSlider
            value={simRatePct}
            onChange={setSimRate}
            min={0.5}
            max={25}
            step={0.1}
            gradient="risk"
          />
          {sim.yearlyCost > 0.01 && (
            <div className="text-xs  mt-1 tabular-nums">
              {toLocaleStringHelper(sim.yearlyCost)} {current.stablecoinSymbol} / year
              <span className=""> · {toLocaleStringHelper(sim.dailyCost)} / day</span>
            </div>
          )}
        </StateMetric>
      </div>
    </SimulatorCardShell>
  );
}
