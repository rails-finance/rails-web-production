"use client";

import type { ReactNode } from "react";
import type { AaveV4Context } from "@/lib/shared/types/protocols/aave-v4";
import { ExplainerList } from "@/components/shared/explainer-list";
import { LearnMore } from "@/components/shared/learn-more-modal";
import {
  aaveV4LiquidationContent,
  aaveV4SupplyContent,
  aaveV4BorrowContent,
  aaveV4CollateralToggleContent,
  aaveV4EventFallbackContent,
} from "@/lib/shared/learn-more-content";
import { shortAddr } from "@/lib/shared/format-event";
import { aaveV4DisplaySymbol } from "@/lib/aave-v4/pt-tokens";
import { effectiveBorrowAPR } from "@/lib/aave-v4/borrow-rate";

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

// HIGHLIGHT RULE (codified — mirrors the Liquity `V` helper): wrap a value in
// <H> (bold + foreground) ONLY when that same value is also surfaced on the
// card's header or details grid; prose and any unreferenced figure stays in
// the muted body tone, so a bold figure always maps to one the reader can find
// above it.
function H({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
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
  // True per-block on-chain borrow rate (falls back to the MV's inferred value);
  // keep this consistent with the rate card + header chip.
  const borrowAPR = effectiveBorrowAPR(ctx);

  const items: ReactNode[] = [];

  switch (ctx.eventType) {
    case "supply":
      if (ctx.alsoToggledCollateral) {
        items.push(
          <span>
            Supplied{" "}
            <H>
              {amount} {token}
            </H>{" "}
            to the Aave V4 <H>{market}</H> market and enabled it as collateral in the same transaction.
          </span>,
        );
        items.push(
          <span>
            This {token} now earns variable interest from borrowers and backs borrows — it can be seized in a
            liquidation.
          </span>,
        );
      } else {
        items.push(
          <span>
            Supplied{" "}
            <H>
              {amount} {token}
            </H>{" "}
            to the Aave V4 <H>{market}</H> market.
          </span>,
        );
        items.push(
          <span>
            This {token} earns variable interest from borrowers and can be enabled as collateral to back borrows.
          </span>,
        );
      }
      if (supplyAfter > 0)
        items.push(
          <span>
            Running supply balance in this reserve is now{" "}
            <H>
              {fmt(supplyAfter)} {token}
            </H>
            .
          </span>,
        );
      items.push(
        <span>
          Aave V4 isolates this supply to the <H>{market}</H> market — it is not shared with other markets, limiting
          contagion risk.
        </span>,
      );
      break;

    case "withdraw":
      items.push(
        <span>
          Withdrew{" "}
          <H>
            {amount} {token}
          </H>{" "}
          from Aave V4 <H>{market}</H> market back to the wallet.
        </span>,
      );
      if (supplyAfter > 0) {
        items.push(
          <span>
            Remaining supply balance:{" "}
            <H>
              {fmt(supplyAfter)} {token}
            </H>
            .
          </span>,
        );
      } else {
        items.push(
          <span>
            This fully exits the {token} supply position on the <H>{market}</H> market.
          </span>,
        );
      }
      items.push(
        <span>
          Withdrawals reduce available collateral. If this asset was enabled as collateral, the health factor may have
          decreased.
        </span>,
      );
      break;

    case "borrow":
      items.push(
        <span>
          Borrowed{" "}
          <H>
            {amount} {token}
          </H>{" "}
          from Aave V4 <H>{market}</H> market.
        </span>,
      );
      items.push(
        <span>
          This creates a variable-rate debt position. Interest accrues continuously and must be repaid to avoid
          liquidation.
        </span>,
      );
      if (borrowAPR)
        items.push(
          <span>
            Effective borrow rate at this point: <H>{(parseFloat(borrowAPR) * 100).toFixed(2)}% APR</H>.
          </span>,
        );
      if (debtAfter > 0)
        items.push(
          <span>
            Outstanding {token} debt is now{" "}
            <H>
              {fmt(debtAfter)} {token}
            </H>
            .
          </span>,
        );
      items.push(
        <span>
          If the health factor drops below 1.0 (collateral value insufficient to cover debt), the position can be
          partially liquidated.
        </span>,
      );
      break;

    case "repay":
      items.push(
        <span>
          Repaid{" "}
          <H>
            {amount} {token}
          </H>{" "}
          of debt to Aave V4 <H>{market}</H> market.
        </span>,
      );
      if (borrowAPR)
        items.push(
          <span>
            Effective borrow rate at this point: <H>{(parseFloat(borrowAPR) * 100).toFixed(2)}% APR</H>.
          </span>,
        );
      if (debtAfter > 0) {
        items.push(
          <span>
            Remaining debt:{" "}
            <H>
              {fmt(debtAfter)} {token}
            </H>
            . This improves the health factor.
          </span>,
        );
      } else {
        items.push(
          <span>
            This fully repays the {token} debt on the <H>{market}</H> market.
          </span>,
        );
      }
      break;

    case "liquidation": {
      items.push(
        <span>
          This position was liquidated on Aave V4 <H>{market}</H> market — the health factor dropped below 1.0.
        </span>,
      );
      if (ctx.debtToCover)
        items.push(
          <span>
            <H>
              {fmt(ctx.debtToCover)} {token}
            </H>{" "}
            of debt was repaid by the liquidator.
          </span>,
        );
      if (ctx.liquidatedCollateralAmount && ctx.collateralSymbol)
        items.push(
          <span>
            <H>
              {fmt(ctx.liquidatedCollateralAmount)} {ctx.collateralSymbol}
            </H>{" "}
            collateral was seized (includes liquidation penalty).
          </span>,
        );
      if (ctx.liquidator)
        items.push(
          <span>
            Cleared by a third-party liquidator (typically an automated bot) that repaid the debt in exchange for the
            discounted collateral:{" "}
            <a
              href={`https://etherscan.io/address/${ctx.liquidator}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline font-mono"
            >
              {shortAddr(ctx.liquidator)} ↗
            </a>
          </span>,
        );
      items.push(
        <span>
          To avoid future liquidations, maintain a health factor well above 1.0 by keeping debt low relative to
          collateral.
        </span>,
      );
      break;
    }

    case "collateral_toggle":
      if (ctx.enabled) {
        items.push(
          <span>
            Enabled <H>{token}</H> as collateral on Aave V4 <H>{market}</H> market.
          </span>,
        );
        items.push(
          <span>
            This asset now backs borrows — it increases borrowing capacity but means it can be seized in a liquidation.
          </span>,
        );
      } else {
        items.push(
          <span>
            Disabled <H>{token}</H> as collateral on Aave V4 <H>{market}</H> market.
          </span>,
        );
        items.push(
          <span>This asset no longer backs borrows and cannot be liquidated, but borrowing capacity is reduced.</span>,
        );
      }
      break;

    default:
      items.push(
        <span>
          Aave V4 <H>{token}</H> event on <H>{market}</H> market.
        </span>,
      );
  }

  // Never-empty floor: every event type maps to a mechanic modal; the default
  // falls back to the generic Aave V4 explainer.
  const learnMore = (() => {
    switch (ctx.eventType) {
      case "liquidation":
        return aaveV4LiquidationContent(ctx.spokeName);
      case "supply":
      case "withdraw":
        return aaveV4SupplyContent();
      case "borrow":
      case "repay":
        return aaveV4BorrowContent();
      case "collateral_toggle":
        return aaveV4CollateralToggleContent();
      default:
        return aaveV4EventFallbackContent();
    }
  })();

  return <ExplainerList items={items}>{learnMore && <LearnMore content={learnMore} />}</ExplainerList>;
}
