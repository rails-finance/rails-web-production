"use client";

// Plain-English narration for each LlamaLend event type. Mirrors
// AaveV4EventExplainer's structure. The teaser (first bullet) is returned
// separately so the universal EventCard can show it inline on the detail
// panel before the full list expands.

import type { LlamalendContext } from "@/lib/shared/types/protocols/llamalend";
import { ExplainerList } from "@/components/shared/explainer-list";
import { shortAddr } from "@/lib/shared/format-event";

function fmt(v: string | number | undefined): string {
  if (v == null) return "0";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "0";
  if (Math.abs(n) >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function familyLabel(ctx: LlamalendContext): string {
  return ctx.family === "mint" ? "Curve crvUSD mint market" : "Curve LlamaLend market";
}

export function buildLlamalendExplainerItems(ctx: LlamalendContext): string[] {
  const items: string[] = [];
  const market = familyLabel(ctx);
  const collSym = ctx.collateralSymbol ?? "collateral";
  const debtSym = ctx.borrowedSymbol ?? "crvUSD";
  const collAfter = parseFloat(ctx.collateralAfter ?? "0");
  const debtAfter = parseFloat(ctx.debtAfter ?? "0");
  const collDelta = Math.abs(parseFloat(ctx.deltaCollateral ?? "0") || 0);
  const debtDelta = Math.abs(parseFloat(ctx.deltaDebt ?? "0") || 0);

  switch (ctx.eventType) {
    case "open":
      items.push(`Opened a new ${market} position by depositing ${fmt(collDelta)} ${collSym} and borrowing ${fmt(debtDelta)} ${debtSym}.`);
      items.push(`The collateral is distributed across LLAMMA bands [${ctx.n1 ?? "?"} → ${ctx.n2 ?? "?"}] — if the oracle price falls into this range the position enters soft-liquidation, with bands sold for ${debtSym} band-by-band.`);
      items.push(`Continuous monetary-policy interest accrues on the ${debtSym} debt; band parameters are immutable for the life of this position.`);
      break;

    case "close":
      items.push(`Fully closed the ${market} position by repaying ${fmt(debtDelta)} ${debtSym} and withdrawing remaining collateral.`);
      items.push(`The position's epoch increments — any reopen on this controller creates a fresh position card with new bands.`);
      break;

    case "borrow":
      items.push(`Borrowed ${fmt(debtDelta)} ${debtSym} against existing ${collSym} collateral on ${market}.`);
      if (collDelta > 0.0001) items.push(`Added ${fmt(collDelta)} ${collSym} of collateral in the same transaction.`);
      if (debtAfter > 0) items.push(`Outstanding ${debtSym} debt is now ${fmt(debtAfter)}.`);
      items.push(`Bands shifted to [${ctx.n1 ?? "?"} → ${ctx.n2 ?? "?"}] after this borrow — additional debt narrows the safe range.`);
      break;

    case "repay":
      items.push(`Repaid ${fmt(debtDelta)} ${debtSym} to the ${market} position.`);
      if (debtAfter > 0) items.push(`Remaining debt: ${fmt(debtAfter)} ${debtSym}. The band range relaxes as the LTV improves.`);
      break;

    case "remove_collateral":
      items.push(`Withdrew ${fmt(collDelta)} ${collSym} from the ${market} position.`);
      if (collAfter > 0) items.push(`Remaining collateral: ${fmt(collAfter)} ${collSym}.`);
      items.push(`Bands shifted to [${ctx.n1 ?? "?"} → ${ctx.n2 ?? "?"}] — withdrawing collateral compresses the band range upward, raising the soft-liq trigger price.`);
      break;

    case "liquidate":
    case "liquidated":
      items.push(`Position was hard-liquidated on ${market} — the oracle traversed the entire band range, exhausting the LLAMMA's gradual sell-off.`);
      if (ctx.debtCleared) items.push(`${fmt(ctx.debtCleared)} ${debtSym} of debt was cleared by the liquidator.`);
      if (ctx.collateralReceived && parseFloat(ctx.collateralReceived) > 0)
        items.push(`${fmt(ctx.collateralReceived)} ${collSym} was returned to the wallet after debt repayment.`);
      if (ctx.stablecoinReceived && parseFloat(ctx.stablecoinReceived) > 0)
        items.push(`${fmt(ctx.stablecoinReceived)} ${debtSym} of residual stablecoin was returned.`);
      if (ctx.liquidator) items.push(`Liquidator: ${shortAddr(ctx.liquidator)}.`);
      items.push(`Unlike Aave-style atomic liquidations, LlamaLend's hard-liq only fires after soft-liquidation has already sold off the bands — so collateral loss is typically partial, not total.`);
      break;

    case "soft_liquidated":
      items.push(`The oracle moved into this position's band range on ${market}, triggering LLAMMA soft-liquidation — some ${collSym} bands were swapped for ${debtSym} automatically.`);
      if (ctx.liquidationCount && ctx.liquidationCount > 1)
        items.push(`${ctx.liquidationCount} soft-liq exchanges occurred during this window.`);
      items.push(`Soft-liq is reversible: if the oracle recovers above the band range, ${debtSym} swaps back into ${collSym} on subsequent ticks.`);
      break;

    default:
      items.push(`Curve LlamaLend ${ctx.eventType} event on the ${collSym}/${debtSym} market.`);
  }

  return items;
}

export function getLlamalendExplainerTeaser(ctx: LlamalendContext): string {
  const items = buildLlamalendExplainerItems(ctx);
  return items[0] ?? "";
}

export interface LlamalendEventExplainerProps {
  ctx: LlamalendContext;
  /** When true, drop the first bullet — the universal EventCard surfaces it
   *  as the teaser line above the expanded bullet list. */
  skipFirst?: boolean;
}

export function LlamalendEventExplainer({ ctx, skipFirst }: LlamalendEventExplainerProps) {
  const items = buildLlamalendExplainerItems(ctx);
  return <ExplainerList items={skipFirst ? items.slice(1) : items} />;
}
