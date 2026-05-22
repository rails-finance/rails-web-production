"use client";

import type { AaveV4Context } from "@/lib/shared/types/protocols/aave-v4";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import { shortAddr } from "@/lib/shared/format-event";
import { usePreferences } from "@/lib/shared/preferences-context";
import { formatRatio, ratioLabel, ratioColorClass } from "@/lib/shared/ratio-format";
import { TransitionArrow as SharedTransitionArrow } from "@/components/shared/state-transition";
import { resolvePrice } from "@/lib/aave/prices";
import { usePrices } from "@/lib/shared/prices-context";
import { useTimelineDisplay } from "@/components/shared/timeline-display-context";
import { aaveV4DisplaySymbol } from "@/lib/aave-v4/pt-tokens";

function fmt(v: string | number | undefined): string {
  if (!v) return "0";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "0";
  if (Math.abs(n) < 0.0001) return "0";
  if (Math.abs(n) >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** USD value formatter matching Liquity V2's detail-row style:
 *  `< $0.01` for sub-cent, `$0.XX` for sub-dollar, integer dollars otherwise. */
function formatUsd(value: number | undefined | null): string {
  if (value == null || isNaN(value) || value < 0.01) return "< $0.01";
  if (value < 1) return `$${value.toFixed(2)}`;
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const TransitionArrow = () => <SharedTransitionArrow size="sm" />;

export interface AaveV4EventDetailProps {
  ctx: AaveV4Context;
  txHash: string;
  wallet: string;
}

/** Render a single position row — with before→after if this asset changed,
 *  static otherwise. When a per-unit USD price is supplied (the event's
 *  primary asset), the dollar value of the AFTER balance shows as a small
 *  bordered chip between the number and the icon — mirrors Liquity V2's
 *  CollateralMetric pattern (`3.0321 [ $7,062 ] ◊`). */
function PositionRow({
  symbol,
  amount,
  before,
  isChanged,
  priceUsd,
}: {
  symbol: string;
  amount: string;
  before?: string;
  isChanged: boolean;
  priceUsd?: number;
}) {
  const { showTickerLabels } = useTimelineDisplay();
  const afterN = parseFloat(amount) || 0;
  const afterUsd = priceUsd != null && afterN > 0 ? afterN * priceUsd : undefined;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {isChanged && before != null ? (
        <>
          <span className="text-rb-500">{fmt(before)}</span>
          <TransitionArrow />
          <span className="font-bold">{fmt(amount)}</span>
        </>
      ) : (
        <span className="font-bold">{fmt(amount)}</span>
      )}
      {afterUsd != null && (
        <span className="text-xs flex font-bold items-center text-rb-500 border-l-2 border-r-2 ml-0.5 border-rb-500 rounded-sm px-1 py-0">
          {formatUsd(afterUsd)}
        </span>
      )}
      <TokenChipIcon symbol={symbol} size={16} />
      {showTickerLabels && <span className="text-xs">{aaveV4DisplaySymbol(symbol)}</span>}
    </span>
  );
}

export function AaveV4EventDetail({ ctx }: AaveV4EventDetailProps) {
  const { prefs } = usePreferences();
  const ratioMode = prefs.ratioMode;
  const prices = usePrices();
  // `token` stays the raw on-chain symbol — it threads through `allSupplies`
  // / `allDebts` rows whose `symbol` field is the chip's icon-lookup key.
  // Narrative copy uses the augmented display form via `tokenLabel`.
  const token = ctx.reserveSymbol ?? "???";
  const tokenLabel = aaveV4DisplaySymbol(ctx.reserveSymbol) || "???";
  const isLiq = ctx.eventType === "liquidation";
  const isToggle = ctx.eventType === "collateral_toggle";

  const isSupplySide = ctx.eventType === "supply" || ctx.eventType === "withdraw";
  const isDebtSide = ctx.eventType === "borrow" || ctx.eventType === "repay";

  const supplyBeforeVal = parseFloat(ctx.supplyBefore ?? "0");
  const supplyAfterVal = parseFloat(ctx.supplyAfter ?? "0");
  const debtBeforeVal = parseFloat(ctx.debtBefore ?? "0");
  const debtAfterVal = parseFloat(ctx.debtAfter ?? "0");
  const hasOldSupply = (supplyBeforeVal > 0.0001 || supplyAfterVal > 0.0001);
  const hasOldDebt = (debtBeforeVal > 0.0001 || debtAfterVal > 0.0001);
  const baseSupplies = ctx.allSupplies?.length
    ? ctx.allSupplies
    : (isSupplySide || isLiq) && hasOldSupply
      ? [{ symbol: isLiq ? (ctx.collateralSymbol ?? token) : token, amount: ctx.supplyAfter ?? "0" }]
      : [];
  const baseDebts = ctx.allDebts?.length
    ? ctx.allDebts
    : (isDebtSide || isLiq) && hasOldDebt
      ? [{ symbol: token, amount: ctx.debtAfter ?? "0" }]
      : [];

  const supplyChangeSym = isLiq ? ctx.collateralSymbol : token;
  const supplyZeroOut = (isSupplySide || isLiq) && supplyChangeSym && supplyAfterVal <= 0.0001 && supplyBeforeVal > 0.0001
    && !baseSupplies.some(s => s.symbol === supplyChangeSym);
  const supplies = supplyZeroOut
    ? [...baseSupplies, { symbol: supplyChangeSym!, amount: ctx.supplyAfter ?? "0" }]
    : baseSupplies;

  const debtZeroOut = (isDebtSide || isLiq) && debtAfterVal <= 0.0001 && debtBeforeVal > 0.0001
    && !baseDebts.some(d => d.symbol === token);
  const debts = debtZeroOut
    ? [...baseDebts, { symbol: token, amount: ctx.debtAfter ?? "0" }]
    : baseDebts;
  const hasSupplies = supplies.length > 0;
  const hasDebts = debts.length > 0;

  const supplyBefore = ctx.supplyBefore;
  const debtBefore = ctx.debtBefore;

  // Without prices, totals come out 0 and the ratio panel hides. v1 ships
  // without live pricing — `usePrices()` is a stub returning {}.
  const getPrice = (sym: string) => resolvePrice(sym, prices) ?? 0;
  const totalSupplyUsd = supplies.reduce((s, p) => s + parseFloat(p.amount) * getPrice(p.symbol), 0);
  const totalDebtUsd = debts.reduce((s, p) => s + parseFloat(p.amount) * getPrice(p.symbol), 0);
  const collRatio = totalDebtUsd > 0 ? totalSupplyUsd / totalDebtUsd : 0;
  const showRatio = hasSupplies && hasDebts && totalDebtUsd > 0.01;

  return (
    <>
      {/* Collateral toggle status */}
      {isToggle && (
        <div className="px-5 py-2 text-sm">
          <span className={`font-bold ${ctx.enabled ? "text-green-400" : ""}`}>
            {ctx.enabled ? "Enabled as collateral" : "Disabled as collateral"}
          </span>
        </div>
      )}

      {/* Liquidation breakdown */}
      {isLiq && (
        <div className="grid grid-cols-2 gap-2 px-5 py-2 text-sm">
          {ctx.debtToCover && (
            <div className="flex flex-col">
              <span className="text-rb-500 text-xs font-semibold">Debt Covered</span>
              <span className="font-bold text-red-400">{fmt(ctx.debtToCover)} {tokenLabel}</span>
            </div>
          )}
          {ctx.liquidatedCollateralAmount && ctx.collateralSymbol && (
            <div className="flex flex-col">
              <span className="text-rb-500 text-xs font-semibold">Collateral Seized</span>
              <span className="font-bold text-red-400">{fmt(ctx.liquidatedCollateralAmount)} {ctx.collateralSymbol}</span>
            </div>
          )}
          {ctx.liquidator && (
            <div className="flex flex-col col-span-2">
              <span className="">Liquidator</span>
              <span className="font-mono  text-xs">{shortAddr(ctx.liquidator)}</span>
            </div>
          )}
        </div>
      )}

      {/* Full position snapshot — supply, debt, and collateral ratio */}
      {(hasSupplies || hasDebts) && (
        <div className="px-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {hasSupplies && (
              <div>
                <div className="text-rb-500 text-xs font-semibold mb-1.5">Collateral</div>
                <div className="flex flex-col gap-1">
                  {supplies.map(s => {
                    // The changed asset is the supply side's primary asset for
                    // supply/withdraw, or the collateral asset for liquidations.
                    const isThisChanged = (isSupplySide || isLiq) && s.symbol === (isLiq ? ctx.collateralSymbol : token);
                    // Prefer the per-row price (server enriches every snapshot
                    // item with its historic USD price). Fall back to the
                    // event's primary price on the changed row so older clients
                    // / older payloads without per-row prices still render.
                    const priceUsd = s.price?.usd ?? (
                      !isThisChanged ? undefined
                        : isLiq ? ctx.collateralPrice?.usd
                        : ctx.price?.usd
                    );
                    return (
                      <PositionRow
                        key={s.symbol}
                        symbol={s.symbol}
                        amount={s.amount}
                        before={isThisChanged ? supplyBefore : undefined}
                        isChanged={isThisChanged}
                        priceUsd={priceUsd}
                      />
                    );
                  })}
                </div>
              </div>
            )}
            {hasDebts && (
              <div>
                <div className="text-rb-500 text-xs font-semibold mb-1.5">Debt</div>
                <div className="flex flex-col gap-1">
                  {debts.map(d => {
                    const isThisChanged = (isDebtSide || isLiq) && d.symbol === token;
                    const priceUsd = d.price?.usd ?? (
                      !isThisChanged ? undefined
                        : isLiq ? ctx.debtPrice?.usd
                        : ctx.price?.usd
                    );
                    return (
                      <PositionRow
                        key={d.symbol}
                        symbol={d.symbol}
                        amount={d.amount}
                        before={isThisChanged ? debtBefore : undefined}
                        isChanged={isThisChanged}
                        priceUsd={priceUsd}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {(showRatio || ctx.supplyAPR || ctx.borrowAPR) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3 pt-3 border-t border-rb-200/40 dark:border-rb-800/40">
              {showRatio && (
                <div>
                  <div className="text-rb-500 text-xs font-semibold mb-1">{ratioLabel(ratioMode)}</div>
                  <div className={`text-sm font-bold ${ratioColorClass(collRatio * 100, { danger: 120, warn: 150, warnClass: "text-amber-400", safeClass: "" })}`}>
                    {formatRatio(collRatio * 100, ratioMode, 0)}
                  </div>
                </div>
              )}
              {(ctx.supplyAPR || ctx.borrowAPR) && (
                <div>
                  <div className="text-rb-500 text-xs font-semibold mb-1">{ctx.supplyAPR ? "Supply Rate" : "Borrow Rate"}</div>
                  <div className="text-sm font-bold">
                    {((parseFloat(ctx.supplyAPR ?? ctx.borrowAPR ?? "0")) * 100).toFixed(2)}%
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Asset-price footer pill — single per-unit price for the event's
          primary asset, mirroring Liquity V2's `$X,XXX ◊` chip. The pill is
          source-aware via its tooltip; the ≈ prefix on stablecoin sources is
          carried through so the user can tell pinned-$1 apart from market. */}
      {ctx.price && ctx.price.usd > 0 && ctx.reserveSymbol && (
        <div className="flex items-center gap-2 px-5 py-2">
          <span
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-rb-500 bg-rb-200/60 dark:bg-rb-800/60 px-2 py-1 rounded-md"
            title={`${aaveV4DisplaySymbol(ctx.reserveSymbol)} price at the time of this event (${
              ctx.price.source === "chainlink" ? "Chainlink feed"
              : ctx.price.source === "chainlink-eth-derived" ? "Chainlink ETH/USD × on-chain exchange rate"
              : ctx.price.source === "iaave-oracle" ? "IAaveOracle"
              : ctx.price.source === "stablecoin" ? "stablecoin, pinned to $1"
              : "approximation"
            })`}
          >
            {ctx.price.source === "stablecoin" ? "≈" : ""}{formatUsd(ctx.price.usd)}
            <TokenChipIcon symbol={ctx.reserveSymbol} size={14} />
          </span>
        </div>
      )}
    </>
  );
}
