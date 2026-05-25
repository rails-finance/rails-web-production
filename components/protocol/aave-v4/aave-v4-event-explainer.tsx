"use client";

import type { AaveV4Context } from "@/lib/shared/types/protocols/aave-v4";
import { ExplainerList } from "@/components/shared/explainer-list";
import { shortAddr } from "@/lib/shared/format-event";
import { aaveV4DisplaySymbol } from "@/lib/aave-v4/pt-tokens";

function fmt(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!isFinite(n)) return "0";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  // Sub-unit: scale decimals so BTC-family / wei-fractional amounts don't underflow to "0".
  const decimals = Math.min(8, Math.ceil(-Math.log10(abs)) + 2);
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

export interface AaveV4EventExplainerProps {
  ctx: AaveV4Context;
}

export function AaveV4EventExplainer({ ctx }: AaveV4EventExplainerProps) {
  const amount = ctx.amount ? fmt(ctx.amount) : "0";
  const token = aaveV4DisplaySymbol(ctx.reserveSymbol) || "???";
  const market = ctx.spokeName ?? "unknown";
  const supplyAfter = ctx.supplyAfter ? parseFloat(ctx.supplyAfter) : 0;
  const debtAfter = ctx.debtAfter ? parseFloat(ctx.debtAfter) : 0;

  const items: string[] = [];

  switch (ctx.eventType) {
    case "supply":
      if (ctx.alsoToggledCollateral) {
        items.push(`Supplied ${amount} ${token} to the Aave V4 ${market} market and enabled it as collateral in the same transaction.`);
        items.push(`This ${token} now earns variable interest from borrowers and backs borrows — it can be seized in a liquidation.`);
      } else {
        items.push(`Supplied ${amount} ${token} to the Aave V4 ${market} market.`);
        items.push(`This ${token} earns variable interest from borrowers and can be enabled as collateral to back borrows.`);
      }
      if (ctx.supplyAPR) items.push(`Effective supply rate at this point: ${(parseFloat(ctx.supplyAPR) * 100).toFixed(2)}% APR.`);
      if (supplyAfter > 0) items.push(`Running supply balance in this reserve is now ${fmt(supplyAfter)} ${token}.`);
      items.push(`Aave V4 isolates this supply to the ${market} market — it is not shared with other markets, limiting contagion risk.`);
      break;

    case "withdraw":
      items.push(`Withdrew ${amount} ${token} from Aave V4 ${market} market back to the wallet.`);
      if (supplyAfter > 0) {
        items.push(`Remaining supply balance: ${fmt(supplyAfter)} ${token}.`);
      } else {
        items.push(`This fully exits the ${token} supply position on the ${market} market.`);
      }
      items.push(`Withdrawals reduce available collateral. If this asset was enabled as collateral, the health factor may have decreased.`);
      break;

    case "borrow":
      items.push(`Borrowed ${amount} ${token} from Aave V4 ${market} market.`);
      items.push(`This creates a variable-rate debt position. Interest accrues continuously and must be repaid to avoid liquidation.`);
      if (ctx.borrowAPR) items.push(`Effective borrow rate at this point: ${(parseFloat(ctx.borrowAPR) * 100).toFixed(2)}% APR.`);
      if (debtAfter > 0) items.push(`Outstanding ${token} debt is now ${fmt(debtAfter)} ${token}.`);
      items.push(`If the health factor drops below 1.0 (collateral value insufficient to cover debt), the position can be partially liquidated.`);
      break;

    case "repay":
      items.push(`Repaid ${amount} ${token} of debt to Aave V4 ${market} market.`);
      if (ctx.borrowAPR) items.push(`Effective borrow rate at this point: ${(parseFloat(ctx.borrowAPR) * 100).toFixed(2)}% APR.`);
      if (debtAfter > 0) {
        items.push(`Remaining debt: ${fmt(debtAfter)} ${token}. This improves the health factor.`);
      } else {
        items.push(`This fully repays the ${token} debt on the ${market} market.`);
      }
      break;

    case "liquidation": {
      items.push(`This position was liquidated on Aave V4 ${market} market — the health factor dropped below 1.0.`);
      if (ctx.debtToCover) items.push(`${fmt(ctx.debtToCover)} ${token} of debt was repaid by the liquidator.`);
      if (ctx.liquidatedCollateralAmount && ctx.collateralSymbol)
        items.push(`${fmt(ctx.liquidatedCollateralAmount)} ${ctx.collateralSymbol} collateral was seized (includes liquidation penalty).`);
      if (ctx.liquidator) items.push(`Liquidator: ${shortAddr(ctx.liquidator)}.`);
      items.push(`To avoid future liquidations, maintain a health factor well above 1.0 by keeping debt low relative to collateral.`);
      break;
    }

    case "collateral_toggle":
      if (ctx.enabled) {
        items.push(`Enabled ${token} as collateral on Aave V4 ${market} market.`);
        items.push(`This asset now backs borrows — it increases borrowing capacity but means it can be seized in a liquidation.`);
      } else {
        items.push(`Disabled ${token} as collateral on Aave V4 ${market} market.`);
        items.push(`This asset no longer backs borrows and cannot be liquidated, but borrowing capacity is reduced.`);
      }
      break;

    default:
      items.push(`Aave V4 ${token} event on ${market} market.`);
  }

  return <ExplainerList items={items} />;
}
