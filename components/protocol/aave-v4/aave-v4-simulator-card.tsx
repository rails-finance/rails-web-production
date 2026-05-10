"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock, ToggleLeft, ToggleRight, X } from "lucide-react";
import { simulateAaveV4Position } from "@/lib/aave-v4/utils/simulate";
import {
  useAaveV4Simulator,
  type AaveV4SimBase,
  type AaveV4SimAddedSupply,
  type AaveV4SimAddedDebt,
} from "@/lib/aave-v4/use-simulator";
import { getAaveV4Catalog } from "@/lib/aave-v4/asset-catalog";
import { isStable } from "@/lib/aave-v4/liquidation-thresholds";
import { resolvePrice } from "@/lib/aave/prices";
import { usePrices } from "@/lib/shared/prices-context";
import { AssetPicker } from "@/components/shared/asset-picker";
import { DeltaArrow, EditableNumber, SimSlider } from "@/components/shared/simulator-inputs";
import { SimulatorCardShell, type SimulatorActionChip } from "@/components/shared/simulator-card-shell";
import { StateMetric, TransitionArrow } from "@/components/shared/state-transition";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { InfoIconButton } from "@/components/shared/info-icon-button";
import { ExplainerList } from "@/components/shared/explainer-list";
import { useTimelineDisplay } from "@/components/shared/timeline-display-context";
import type { CatalogAsset } from "@/lib/protocols/asset-catalog";
import type { SpineTokenRow } from "@/components/shared/spine-column";

export interface AaveV4SimulatorCardProps {
  spokeKey: string;
  base: AaveV4SimBase;
  avatar?: React.ReactNode;
  onClose?: () => void;
}

function fmtNum(n: number, decimals = 2): string {
  if (!isFinite(n)) return "0";
  if (Math.abs(n) < 0.01 && n !== 0) return n.toExponential(1);
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function fmtUsd(v: number): string {
  if (v < 0.01) return "< $0.01";
  if (v < 1) return `$${v.toFixed(2)}`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function hfLabel(hf: number | null): string {
  if (hf == null) return "∞";
  if (hf >= 100) return "∞";
  return hf.toFixed(2);
}

function hfColor(hf: number | null): string {
  if (hf == null || hf >= 2) return "text-emerald-400";
  if (hf >= 1.5) return "text-emerald-300";
  if (hf >= 1.2) return "text-amber-400";
  if (hf >= 1) return "text-red-400";
  return "text-red-500";
}

function hfStatus(hf: number | null): string {
  if (hf == null || hf >= 2) return "Safe";
  if (hf >= 1.5) return "Healthy";
  if (hf >= 1.2) return "Warning";
  if (hf >= 1) return "Danger";
  return "Liquidating";
}

export function AaveV4SimulatorCard({ spokeKey, base, avatar, onClose }: AaveV4SimulatorCardProps) {
  const simulator = useAaveV4Simulator();
  const prices = usePrices();
  const catalog = useMemo(() => getAaveV4Catalog(spokeKey), [spokeKey]);
  const { showTickerLabels, showUsdValues } = useTimelineDisplay();

  // Local slider state — one entry per supply / debt / non-stable price.
  // Amount and price arrays track base order so we can look up by index.
  const [supplyAmounts, setSupplyAmounts] = useState<number[]>(() => base.supplies.map(s => s.amount));
  const [debtAmounts, setDebtAmounts] = useState<number[]>(() => base.debts.map(d => d.amount));
  const [collPrices, setCollPrices] = useState<number[]>(() => base.supplies.map(s => s.price));
  const [collFlags, setCollFlags] = useState<boolean[]>(() => base.supplies.map(s => s.collateralEnabled));
  // Added rows — assets the user picked from the catalog that aren't part of
  // the on-chain position. Reset whenever the spoke (and therefore the catalog
  // scope) changes.
  const [addedSupplies, setAddedSupplies] = useState<AaveV4SimAddedSupply[]>([]);
  const [addedDebts, setAddedDebts] = useState<AaveV4SimAddedDebt[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);

  // Best-effort starting price for a freshly-added leg. Prefers prices already
  // in the position (cross-section reuse — same asset on supply and debt),
  // falls back to the global price context, then to $1 for stables / unknowns.
  const startingPrice = useCallback((asset: CatalogAsset): number => {
    const sym = asset.symbol;
    const fromBaseSupply = base.supplies.find(s => s.symbol === sym)?.price;
    if (fromBaseSupply && fromBaseSupply > 0) return fromBaseSupply;
    const fromBaseDebt = base.debts.find(d => d.symbol === sym)?.price;
    if (fromBaseDebt && fromBaseDebt > 0) return fromBaseDebt;
    const fromContext = resolvePrice(sym, prices);
    if (fromContext != null && fromContext > 0) return fromContext;
    return isStable(sym) ? 1 : 1;
  }, [base, prices]);

  // When the underlying on-chain state changes (spoke switch, new event, price
  // update), reset the sliders. Key off a string of primitive values so we
  // only reset when something *actually* changed — using `base` directly would
  // refire every render because the parent rebuilds `simBase` inline.
  const baseKey = useMemo(
    () => [spokeKey, ...base.supplies.map(s => `${s.symbol}:${s.amount}:${s.price}:${s.lt}:${s.collateralEnabled}`), ...base.debts.map(d => `${d.symbol}:${d.amount}:${d.price}`)].join("|"),
    [spokeKey, base],
  );
  // Hold `base` in a ref so the effects below can read it without listing it
  // as a dep (listing an unstable object identity would loop).
  const baseRef = useRef(base);
  useEffect(() => { baseRef.current = base; });
  useEffect(() => {
    const b = baseRef.current;
    setSupplyAmounts(b.supplies.map(s => s.amount));
    setDebtAmounts(b.debts.map(d => d.amount));
    setCollPrices(b.supplies.map(s => s.price));
    setCollFlags(b.supplies.map(s => s.collateralEnabled));
    setAddedSupplies([]);
    setAddedDebts([]);
  }, [baseKey]);

  const reset = useCallback(() => {
    setSupplyAmounts(base.supplies.map(s => s.amount));
    setDebtAmounts(base.debts.map(d => d.amount));
    setCollPrices(base.supplies.map(s => s.price));
    setCollFlags(base.supplies.map(s => s.collateralEnabled));
    setAddedSupplies([]);
    setAddedDebts([]);
  }, [base]);

  // Publish edits so the economics chart can overlay the simulated state.
  // Hold `simulator` in a ref so the effect only reruns when the slider values
  // actually change — listing `simulator` directly would loop on every publish.
  // Likewise key on `baseKey` (stable string) instead of `base` (parent rebuilds
  // the object inline, so its identity flips every render).
  const simulatorRef = useRef(simulator);
  useEffect(() => { simulatorRef.current = simulator; });
  useEffect(() => {
    const b = baseRef.current;
    simulatorRef.current?.publishEdits({
      spokeKey,
      base: b,
      sim: {
        supplies: b.supplies.map((s, i) => ({
          symbol: s.symbol,
          amount: supplyAmounts[i] ?? s.amount,
          price: collPrices[i] ?? s.price,
          collateralEnabled: collFlags[i] ?? s.collateralEnabled,
        })),
        debts: b.debts.map((d, i) => ({
          symbol: d.symbol,
          amount: debtAmounts[i] ?? d.amount,
        })),
        addedSupplies,
        addedDebts,
      },
    });
  }, [spokeKey, baseKey, supplyAmounts, debtAmounts, collPrices, collFlags, addedSupplies, addedDebts]);
  useEffect(() => () => { simulatorRef.current?.publishEdits(null); }, []);

  // The price runway axes under the tower chart drive per-asset price shocks
  // through the simulator context. Watch `requestedPrices` and sync each
  // matching entry into local `collPrices` so the card's derived state (USD
  // hints, chips) reflects axis drags.
  const requestedPrices = simulator?.requestedPrices;
  useEffect(() => {
    if (!requestedPrices) return;
    setCollPrices((prev) => {
      let changed = false;
      const next = base.supplies.map((s, i) => {
        const req = requestedPrices[s.symbol];
        if (req != null && req > 0 && req !== prev[i]) {
          changed = true;
          return req;
        }
        return prev[i] ?? s.price;
      });
      return changed ? next : prev;
    });
    // Deliberately omit `base` — baseKey already guards identity changes;
    // otherwise every parent re-render rebuilds `base` and refires this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPrices, baseKey]);

  // Same axis-driven sync for picker-introduced supplies. Added rows live in
  // their own state array (no base index), so we update by symbol match.
  useEffect(() => {
    if (!requestedPrices) return;
    setAddedSupplies(prev => {
      let changed = false;
      const next = prev.map(a => {
        const req = requestedPrices[a.symbol];
        if (req != null && req > 0 && req !== a.price) {
          changed = true;
          return { ...a, price: req };
        }
        return a;
      });
      return changed ? next : prev;
    });
  }, [requestedPrices]);

  // Run the simulator twice — once on base for the "before" transition column,
  // once on current sliders + added rows for "after". Cheap enough to do inline.
  const baseResult = useMemo(
    () => simulateAaveV4Position({ supplies: base.supplies, debts: base.debts }),
    [base],
  );
  const simResult = useMemo(
    () => simulateAaveV4Position({
      supplies: [
        ...base.supplies.map((s, i) => ({
          symbol: s.symbol,
          amount: supplyAmounts[i] ?? s.amount,
          price: collPrices[i] ?? s.price,
          lt: s.lt,
          collateralEnabled: collFlags[i] ?? s.collateralEnabled,
        })),
        ...addedSupplies,
      ],
      debts: [
        ...base.debts.map((d, i) => ({
          symbol: d.symbol,
          amount: debtAmounts[i] ?? d.amount,
          price: d.price,
        })),
        ...addedDebts,
      ],
    }),
    [base, supplyAmounts, debtAmounts, collPrices, collFlags, addedSupplies, addedDebts],
  );

  // Derive action chips for the header
  const chips: SimulatorActionChip[] = [];
  const tokens: SpineTokenRow[] = [];
  base.supplies.forEach((s, i) => {
    const simAmt = supplyAmounts[i] ?? s.amount;
    const delta = simAmt - s.amount;
    if (Math.abs(delta) >= Math.max(s.amount * 1e-4, 1e-6)) {
      chips.push({
        label: delta > 0 ? "Supply" : "Withdraw",
        symbol: s.symbol,
        amount: Math.abs(delta),
      });
      const direction: "left" | "right" = delta > 0 ? "right" : "left";
      const decimals = s.amount > 1000 ? 0 : s.amount > 1 ? 4 : 6;
      const maxAbsDelta = Math.max(s.amount * 3, 1);
      tokens.push({
        symbol: s.symbol,
        direction,
        value: Math.abs(delta),
        valueDecimals: decimals,
        valueMax: maxAbsDelta,
        onValueChange: (v) => {
          // Spine value is the *absolute* delta; sign comes from `direction`.
          // Right = supply more (sim > base), left = withdraw (sim < base).
          const newSim = direction === "right"
            ? s.amount + v
            : Math.max(0, s.amount - v);
          setSupplyAmounts((arr) => arr.map((a, k) => k === i ? newSim : a));
        },
      });
    }
  });
  base.debts.forEach((d, i) => {
    const simAmt = debtAmounts[i] ?? d.amount;
    const delta = simAmt - d.amount;
    if (Math.abs(delta) >= Math.max(d.amount * 1e-4, 0.01)) {
      chips.push({
        label: delta > 0 ? "Borrow" : "Repay",
        symbol: d.symbol,
        amount: Math.abs(delta),
      });
      const direction: "left" | "right" = delta > 0 ? "left" : "right";
      const decimals = d.amount > 1000 ? 0 : 2;
      const maxAbsDelta = Math.max(d.amount * 3, 1000);
      tokens.push({
        symbol: d.symbol,
        direction,
        value: Math.abs(delta),
        valueDecimals: decimals,
        valueMax: maxAbsDelta,
        onValueChange: (v) => {
          // Spine value is the *absolute* delta; sign comes from `direction`.
          // Left = borrow more (sim > base), right = repay (sim < base).
          const newSim = direction === "left"
            ? d.amount + v
            : Math.max(0, d.amount - v);
          setDebtAmounts((arr) => arr.map((a, k) => k === i ? newSim : a));
        },
      });
    }
  });
  base.supplies.forEach((s, i) => {
    const flag = collFlags[i] ?? s.collateralEnabled;
    if (flag !== s.collateralEnabled) {
      chips.push({ label: flag ? "Enable" : "Disable", symbol: s.symbol });
    }
  });
  // Added legs always represent net new flow — fold them into the chip strip
  // and the spine token row so the header reads "Supply 1.2 WBTC" etc.
  addedSupplies.forEach(s => {
    if (s.amount > 0) {
      chips.push({ label: "Supply", symbol: s.symbol, amount: s.amount });
      const decimals = s.amount > 1000 ? 0 : s.amount > 1 ? 4 : 6;
      tokens.push({
        symbol: s.symbol,
        direction: "right",
        value: s.amount,
        valueDecimals: decimals,
        valueMax: Math.max(s.amount * 3, 1),
        onValueChange: (v) => updateAddedSupply(s.symbol, { amount: v }),
      });
    }
  });
  addedDebts.forEach(d => {
    if (d.amount > 0) {
      chips.push({ label: "Borrow", symbol: d.symbol, amount: d.amount });
      const decimals = d.amount > 1000 ? 0 : 2;
      tokens.push({
        symbol: d.symbol,
        direction: "left",
        value: d.amount,
        valueDecimals: decimals,
        valueMax: Math.max(d.amount * 3, 1000),
        onValueChange: (v) => updateAddedDebt(d.symbol, { amount: v }),
      });
    }
  });

  const hasAmountChange = chips.length > 0;
  const hasPriceChange = base.supplies.some((s, i) => (collPrices[i] ?? s.price) !== s.price);
  const hasAddedRows = addedSupplies.length > 0 || addedDebts.length > 0;
  const hasChanges = hasAmountChange || hasPriceChange || hasAddedRows;

  const underwater = simResult.underwater;

  // Symbols already represented in either base or added — used to filter the
  // picker so the same asset doesn't appear twice on the same side.
  const supplySymbolSet = useMemo(() => {
    const set = new Set<string>();
    base.supplies.forEach(s => set.add(s.symbol));
    addedSupplies.forEach(s => set.add(s.symbol));
    return set;
  }, [base.supplies, addedSupplies]);
  const debtSymbolSet = useMemo(() => {
    const set = new Set<string>();
    base.debts.forEach(d => set.add(d.symbol));
    addedDebts.forEach(d => set.add(d.symbol));
    return set;
  }, [base.debts, addedDebts]);

  const supplyOptions = catalog?.assets.filter(a => a.canSupply) ?? [];
  const borrowOptions = catalog?.assets.filter(a => a.canBorrow) ?? [];

  const handleAddSupply = (asset: CatalogAsset) => {
    setAddedSupplies(prev => [...prev, {
      symbol: asset.symbol,
      amount: 0,
      price: startingPrice(asset),
      lt: asset.lt ?? 0,
      collateralEnabled: asset.canCollateral,
    }]);
  };
  const handleAddDebt = (asset: CatalogAsset) => {
    setAddedDebts(prev => [...prev, {
      symbol: asset.symbol,
      amount: 0,
      price: startingPrice(asset),
    }]);
  };
  const removeAddedSupply = (symbol: string) =>
    setAddedSupplies(prev => prev.filter(s => s.symbol !== symbol));
  const removeAddedDebt = (symbol: string) =>
    setAddedDebts(prev => prev.filter(d => d.symbol !== symbol));
  const updateAddedSupply = (symbol: string, patch: Partial<AaveV4SimAddedSupply>) =>
    setAddedSupplies(prev => prev.map(s => s.symbol === symbol ? { ...s, ...patch } : s));
  const updateAddedDebt = (symbol: string, patch: Partial<AaveV4SimAddedDebt>) =>
    setAddedDebts(prev => prev.map(d => d.symbol === symbol ? { ...d, ...patch } : d));

  return (
    <SimulatorCardShell
      avatar={avatar}
      tokens={tokens}
      actionChips={chips}
      hasChanges={hasChanges}
      onReset={reset}
      onClose={onClose}
    >
      {/* Position rows — collateral left, debt right (mirrors the event card detail layout). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-4">
        {(base.supplies.length > 0 || catalog) && (
        <div>
          <div className="text-rb-500 text-xs font-semibold mb-2">Collateral</div>
          <div className="flex flex-col gap-3">
            {base.supplies.map((s, i) => {
              const simAmt = supplyAmounts[i] ?? s.amount;
              const simPrice = collPrices[i] ?? s.price;
              const flag = collFlags[i] ?? s.collateralEnabled;
              const maxAmt = Math.max(s.amount * 3, 1);
              const decimals = s.amount > 1000 ? 0 : s.amount > 1 ? 4 : 6;
              const simUsd = simAmt * simPrice;
              return (
                <div key={`supply-${s.symbol}-${i}`}>
                  <div className="flex items-center space-x-1 mb-1 text-sm">
                    <span className="text-rb-500">{fmtNum(s.amount, decimals)}</span>
                    <DeltaArrow base={s.amount} onChange={(v) => {
                      setSupplyAmounts((arr) => arr.map((a, k) => k === i ? v : a));
                    }} min={0} max={maxAmt} decimals={decimals} />
                    <EditableNumber value={simAmt} onChange={(v) => {
                      setSupplyAmounts((arr) => arr.map((a, k) => k === i ? v : a));
                    }} min={0} max={maxAmt} decimals={decimals} trimZeros />
                    <TokenChipIcon symbol={s.symbol} size={16} />
                    {showTickerLabels && <span className="text-xs font-semibold">{s.symbol}</span>}
                    {showUsdValues && <span className="text-xs text-rb-500 ml-1">{fmtUsd(simUsd)}</span>}
                    {s.lt > 0 ? (
                      <button
                        type="button"
                        onClick={() => setCollFlags((arr) => arr.map((f, k) => k === i ? !f : f))}
                        aria-pressed={flag}
                        title={flag
                          ? `Used as collateral — click to switch to yield-only (won't back borrows)`
                          : `Yield-only — click to enable as collateral (backs borrows, contributes to HF)`}
                        className={`ml-1 inline-flex items-center justify-center cursor-pointer transition-colors ${
                          flag ? "text-blue-400 hover:text-blue-300" : "text-rb-500 hover:text-foreground"
                        }`}
                      >
                        {flag ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                    ) : (
                      <span
                        title="Borrow-only asset — can't be used as collateral on this spoke."
                        className="ml-1 inline-flex items-center text-rb-500"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <SimSlider
                    value={simAmt}
                    onChange={(v) => setSupplyAmounts((arr) => arr.map((a, k) => k === i ? v : a))}
                    min={0}
                    max={maxAmt}
                    step={maxAmt / 1000}
                    gradient="health"
                  />
                  {/* Price runway lives under the tower chart (always visible
                      in that location, draggable in sim mode), so no per-row
                      price control here. The amount slider above is the only
                      supply-side control in the card. */}
                </div>
              );
            })}
            {addedSupplies.map(s => {
              const maxAmt = Math.max(s.amount * 3, 1);
              const decimals = s.amount > 1000 ? 0 : s.amount > 1 ? 4 : 6;
              const simUsd = s.amount * s.price;
              return (
                <div key={`added-supply-${s.symbol}`}>
                  <div className="flex items-center space-x-1 mb-1 text-sm">
                    <span className="text-rb-500">0</span>
                    <DeltaArrow base={0} onChange={v => updateAddedSupply(s.symbol, { amount: v })} min={0} max={maxAmt} decimals={decimals} />
                    <EditableNumber
                      value={s.amount}
                      onChange={v => updateAddedSupply(s.symbol, { amount: v })}
                      min={0} max={maxAmt} decimals={decimals} trimZeros
                    />
                    <TokenChipIcon symbol={s.symbol} size={16} />
                    {showTickerLabels && <span className="text-xs font-semibold">{s.symbol}</span>}
                    {showUsdValues && <span className="text-xs text-rb-500 ml-1">{fmtUsd(simUsd)}</span>}
                    <span className="text-[10px] uppercase tracking-wide text-blue-400 font-bold ml-1">added</span>
                    {s.lt > 0 ? (
                      <button
                        type="button"
                        onClick={() => updateAddedSupply(s.symbol, { collateralEnabled: !s.collateralEnabled })}
                        aria-pressed={s.collateralEnabled}
                        title={s.collateralEnabled
                          ? `Used as collateral — click to switch to yield-only (won't back borrows)`
                          : `Yield-only — click to enable as collateral (backs borrows, contributes to HF)`}
                        className={`ml-1 inline-flex items-center justify-center cursor-pointer transition-colors ${
                          s.collateralEnabled ? "text-blue-400 hover:text-blue-300" : "text-rb-500 hover:text-foreground"
                        }`}
                      >
                        {s.collateralEnabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                    ) : (
                      <span
                        title="Borrow-only asset — can't be used as collateral on this spoke."
                        className="ml-1 inline-flex items-center text-rb-500"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAddedSupply(s.symbol)}
                      title="Remove this added supply"
                      className="ml-auto p-0.5 rounded text-rb-500 hover:text-red-400 hover:bg-rb-100 dark:hover:bg-rb-900 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <SimSlider
                    value={s.amount}
                    onChange={v => updateAddedSupply(s.symbol, { amount: v })}
                    min={0}
                    max={maxAmt}
                    step={maxAmt / 1000}
                    gradient="health"
                  />
                </div>
              );
            })}
            {catalog && supplyOptions.length > supplySymbolSet.size && (
              <AssetPicker
                options={supplyOptions}
                excludeSymbols={supplySymbolSet}
                side="supply"
                onPick={handleAddSupply}
              />
            )}
          </div>
        </div>
      )}

      {(base.debts.length > 0 || catalog) && (
        <div>
          <div className="text-rb-500 text-xs font-semibold mb-2">Debt</div>
          <div className="flex flex-col gap-3">
            {base.debts.map((d, i) => {
              const simAmt = debtAmounts[i] ?? d.amount;
              const maxAmt = Math.max(d.amount * 3, 1000);
              const decimals = d.amount > 1000 ? 0 : 2;
              const simUsd = simAmt * d.price;
              return (
                <div key={`debt-${d.symbol}-${i}`}>
                  <div className="flex items-center space-x-1 mb-1 text-sm">
                    <span className="text-rb-500">{fmtNum(d.amount, decimals)}</span>
                    <DeltaArrow base={d.amount} onChange={(v) => {
                      setDebtAmounts((arr) => arr.map((a, k) => k === i ? v : a));
                    }} min={0} max={maxAmt} decimals={decimals} />
                    <EditableNumber value={simAmt} onChange={(v) => {
                      setDebtAmounts((arr) => arr.map((a, k) => k === i ? v : a));
                    }} min={0} max={maxAmt} decimals={decimals} trimZeros />
                    <TokenChipIcon symbol={d.symbol} size={16} />
                    {showTickerLabels && <span className="text-xs font-semibold">{d.symbol}</span>}
                    {showUsdValues && <span className="text-xs text-rb-500 ml-1">{fmtUsd(simUsd)}</span>}
                  </div>
                  <SimSlider
                    value={simAmt}
                    onChange={(v) => setDebtAmounts((arr) => arr.map((a, k) => k === i ? v : a))}
                    min={0}
                    max={maxAmt}
                    step={maxAmt / 1000}
                    gradient="risk"
                  />
                </div>
              );
            })}
            {addedDebts.map(d => {
              const maxAmt = Math.max(d.amount * 3, 1000);
              const decimals = d.amount > 1000 ? 0 : 2;
              const simUsd = d.amount * d.price;
              return (
                <div key={`added-debt-${d.symbol}`}>
                  <div className="flex items-center space-x-1 mb-1 text-sm">
                    <span className="text-rb-500">0</span>
                    <DeltaArrow base={0} onChange={v => updateAddedDebt(d.symbol, { amount: v })} min={0} max={maxAmt} decimals={decimals} />
                    <EditableNumber
                      value={d.amount}
                      onChange={v => updateAddedDebt(d.symbol, { amount: v })}
                      min={0} max={maxAmt} decimals={decimals} trimZeros
                    />
                    <TokenChipIcon symbol={d.symbol} size={16} />
                    {showTickerLabels && <span className="text-xs font-semibold">{d.symbol}</span>}
                    {showUsdValues && <span className="text-xs text-rb-500 ml-1">{fmtUsd(simUsd)}</span>}
                    <span className="text-[10px] uppercase tracking-wide text-blue-400 font-bold ml-1">added</span>
                    <button
                      type="button"
                      onClick={() => removeAddedDebt(d.symbol)}
                      title="Remove this added borrow"
                      className="ml-auto p-0.5 rounded text-rb-500 hover:text-red-400 hover:bg-rb-100 dark:hover:bg-rb-900 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <SimSlider
                    value={d.amount}
                    onChange={v => updateAddedDebt(d.symbol, { amount: v })}
                    min={0}
                    max={maxAmt}
                    step={maxAmt / 1000}
                    gradient="risk"
                  />
                </div>
              );
            })}
            {catalog && borrowOptions.length > debtSymbolSet.size && (
              <AssetPicker
                options={borrowOptions}
                excludeSymbols={debtSymbolSet}
                side="borrow"
                onPick={handleAddDebt}
              />
            )}
          </div>
        </div>
      )}
      </div>

      {/* Summary metrics — sit below collateral / debt, two-column layout
          mirrors the event card. Borrow Capacity sits alone in the second
          row's left column when HF + Weighted LT take row one. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-4 pt-3 border-t border-rb-200/40 dark:border-rb-800/40">
        <StateMetric label="Health Factor">
          <div className="flex items-center space-x-1 text-sm">
            <span className="text-rb-500">{hfLabel(baseResult.healthFactor)}</span>
            <TransitionArrow />
            <span className={`font-bold ${hfColor(simResult.healthFactor)}`}>
              {hfLabel(simResult.healthFactor)}
            </span>
            <span className={`ml-1 text-xs ${hfColor(simResult.healthFactor)}`}>
              {hfStatus(simResult.healthFactor)}
            </span>
          </div>
        </StateMetric>

        <StateMetric label="Weighted LT">
          <div className="flex items-center space-x-1 text-sm">
            <span className="text-rb-500">
              {baseResult.weightedLt != null ? `${(baseResult.weightedLt * 100).toFixed(1)}%` : "—"}
            </span>
            {hasChanges && baseResult.weightedLt !== simResult.weightedLt && (
              <>
                <TransitionArrow />
                <span className="font-bold text-blue-400">
                  {simResult.weightedLt != null ? `${(simResult.weightedLt * 100).toFixed(1)}%` : "—"}
                </span>
              </>
            )}
          </div>
        </StateMetric>

        <StateMetric label="Borrow Capacity">
          <div className="flex items-center space-x-1 text-sm">
            <span className="text-rb-500">
              {fmtUsd(baseResult.borrowCapacityUsd)}
            </span>
            {hasChanges && Math.abs(baseResult.borrowCapacityUsd - simResult.borrowCapacityUsd) > 1 && (
              <>
                <TransitionArrow />
                <span className={`font-bold ${simResult.borrowCapacityUsd > baseResult.borrowCapacityUsd ? "text-emerald-400" : "text-amber-400"}`}>
                  {fmtUsd(simResult.borrowCapacityUsd)}
                </span>
              </>
            )}
          </div>
        </StateMetric>
      </div>

      {/* Info row — explainer toggle. Hub/spoke is already named in the
          position card above, so the footer is just the affordance. */}
      <div className="flex items-center justify-end pt-3 mt-2 border-t border-rb-200/60 dark:border-rb-800/60">
        <InfoIconButton open={infoOpen} onClick={() => setInfoOpen((v) => !v)} />
      </div>
      {infoOpen && (
        <ExplainerList items={[
          <>
            Health factor = Σ(coll × price × <span className="font-semibold">LT</span>) ÷ Σ(debt × price).
            A position is liquidatable when HF &lt; 1.
          </>,
          <>
            Each collateral asset has its own liquidation threshold — the <span className="font-semibold">Weighted LT</span> above
            is the blend of asset LTs by collateral USD share. Toggling an asset
            off collateral drops its contribution to zero.
          </>,
          <>
            Per-asset <span className="font-semibold">Liq @</span> prices hold every other leg at its current state and
            solve for the price that puts HF at 1.
          </>,
          underwater ? (
            <span className="text-red-400 font-semibold">
              Simulated state has HF &lt; 1 — on-chain, this position would already be liquidatable.
            </span>
          ) : null,
        ].filter(Boolean) as React.ReactNode[]} />
      )}
    </SimulatorCardShell>
  );
}
