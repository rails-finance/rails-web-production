// Serialize an Aave V4 spoke position's current state + activity timeline into a
// plain-Markdown snapshot, suitable for pasting into an LLM ("here's my
// position — am I at risk?"). Like the Liquity export, the point is that Rails
// has already done the drift-resistant computation (health factor, liquidation
// price/buffer, borrowing power) from chain-truth balances, so the markdown
// carries those computed numbers rather than leaving an LLM to guess them.
//
// This is a PURE function of the data already in scope on the spoke detail page
// — it does no fetching. The headline numbers are read straight off the
// AaveSpokeCardInfo the card renders, and the liquidation buffer reuses the
// shared `liquidationBuffer` helper, so the export agrees with the on-page card,
// runway, and explanation number-for-number.
//
// Numbers are emitted at full precision (no compact "60K" notation) because an
// LLM reasons better over exact values than over rounded display strings.
//
// Aave numeric fields arrive over the wire as STRINGS to preserve precision;
// we parseFloat only here at serialization time (the render boundary), never at
// the data boundary.

import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isAaveV4Event } from "@/lib/shared/types/event-shape";
import { type PriceEntry, resolvePrice } from "@/lib/aave/prices";
import { liquidationBuffer, type AaveSpokeCardInfo, type ReserveStats } from "@/lib/aave-v4/spoke-cards";
import { actionLabel, getEventActionKey } from "@/lib/shared/event-filter-helpers";

export interface AaveV4SpokeMarkdownArgs {
  spokeName: string;
  wallet: string;
  /** The (chain-patched) card the page renders for this spoke. */
  card: AaveSpokeCardInfo;
  /** Per-reserve economics for the spoke — current balances + lifetime totals. */
  reserves: ReserveStats[];
  /** Live prices, for resolving per-asset USD at serialization time. */
  prices: Record<string, PriceEntry | number>;
  /** Chronologically sorted (oldest → newest), spoke-scoped event list. */
  events: BaseActivityEvent[];
  /** When the snapshot was taken (copy time). Passed in so the serializer stays
   *  pure — `new Date()` makes the output non-deterministic to test. */
  generatedAt: Date;
}

// ── Local formatters (full precision, no compact notation) ──

function num(n: number, maxDecimals = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
}

/** Token amount — a few more decimals than money. */
function amt(n: number): string {
  return num(n, 4);
}

function usd(n: number): string {
  return "$" + num(n, 2);
}

/** "2026-06-21 06:53 UTC" — unambiguous for an LLM reader. */
function fmtUtc(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (x: number) => String(x).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

function fmtUtcFromDate(d: Date): string {
  return fmtUtc(d.getTime() / 1000);
}

/** parseFloat a wire string (or number), defaulting to 0 on garbage. */
function toNum(v: string | number | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Current net balance for a reserve: chain-truth when present, else derived
 *  from lifetime flows (mirrors the economics band's fallback). */
/** "USDT (Core)" when the reserve's hub is known, else "USDT". Disambiguates
 *  two same-symbol reserves drawn from different hubs in the export. */
function fmtAssetWithHub(a: { symbol: string; hub?: "core" | "plus" | "prime" | "paxos" | null }): string {
  if (!a.hub) return a.symbol;
  return `${a.symbol} (${a.hub.charAt(0).toUpperCase()}${a.hub.slice(1)})`;
}

function netSupply(r: ReserveStats): number {
  return r.currentSupplied ?? Math.max(0, r.supplied - r.withdrawn - r.liquidatedCollateral);
}
function netDebt(r: ReserveStats): number {
  return r.currentBorrowed ?? Math.max(0, r.borrowed - r.repaid - r.liquidatedDebt);
}

export function spokeToMarkdown(args: AaveV4SpokeMarkdownArgs): string {
  const { spokeName, wallet, card, generatedAt } = args;
  const lines: string[] = [];

  // ── Header ──
  lines.push(`# Aave V4 position — ${spokeName} spoke`);
  lines.push("");
  lines.push(
    `> Point-in-time snapshot generated ${fmtUtcFromDate(generatedAt)}. ` +
      `Balances, prices, and health factor are live reads at generation time and ` +
      `drift as the market and position change. Not financial advice.`,
  );
  lines.push("");

  const statusLabel = card.isClosed ? "Closed" : "Open";
  lines.push(`- **Status:** ${statusLabel}${card.wasLiquidated ? " (has been liquidated)" : ""}`);
  lines.push(`- **Wallet:** ${wallet}`);
  lines.push(`- **Spoke:** ${spokeName} (${card.hub} hub)`);
  if (card.liquidationCount > 0) {
    lines.push(`- **Liquidations:** ${card.liquidationCount} on this spoke`);
  }
  lines.push("");

  // ── Status-specific headline block ──
  if (card.isClosed) {
    lines.push(...closedHeadlines(card));
  } else {
    lines.push(...openHeadlines(args));
  }

  // ── Lifetime ──
  lines.push("## Lifetime");
  lines.push(`- **Peak supply:** ${usd(card.peakSupplyUsd)}`);
  lines.push(`- **Peak debt:** ${usd(card.peakDebtUsd)}`);
  const opened = args.events[0]?.timestamp;
  const last = args.events[args.events.length - 1]?.timestamp;
  if (opened) lines.push(`- **Opened:** ${fmtUtc(opened)}`);
  if (last) lines.push(`- **Last activity:** ${fmtUtc(last)}`);
  lines.push(`- **Transactions:** ${card.txCount}`);
  lines.push("");

  // ── Activity timeline ──
  lines.push(...timelineTable(args.events));

  return lines.join("\n");
}

// Reads the headline numbers straight off the card so the export and the
// on-page card / runway / explanation agree number-for-number.
function openHeadlines(args: AaveV4SpokeMarkdownArgs): string[] {
  const { card, reserves, prices } = args;
  const out: string[] = [];
  out.push("## Headlines");

  // Health factor — Aave's own liquidation trigger (liquidates at 1.0).
  if (card.healthFactor != null) {
    out.push(`- **Health factor:** ${num(card.healthFactor, 2)} (Aave liquidates at 1.0)`);
  }

  // Liquidation buffer — single collateral → concrete liq price; multi → the
  // uniform collateral drop to HF=1. Reuses the shared helper (the house read:
  // never a single asset's solo price for a multi-collateral basket).
  const buf = liquidationBuffer(card);
  if (buf.liquidatable) {
    out.push(`- **Liquidation:** position is at or below a 1.0 health factor — liquidatable now.`);
  } else if (buf.single) {
    let line = `- **Liquidation price:** ${usd(buf.single.liqPrice)} / ${buf.single.symbol} (current ${usd(buf.single.currentPrice)}`;
    if (buf.dropPct != null) line += ` — a ${num(buf.dropPct, 1)}% drop reaches liquidation`;
    line += ")";
    out.push(line);
  } else if (buf.dropPct != null) {
    out.push(
      `- **Liquidation buffer:** collateral can fall ${num(buf.dropPct, 1)}% before the health factor reaches 1.0`,
    );
  }

  // Collateral — gross deposited value is the headline; the LT-weighted figure
  // that actually backs the loan + HF is stated alongside (see the house rule on
  // "Collateral" = full deposit).
  let collLine = `- **Collateral:** ${usd(card.totalSupplyUsd)} supplied`;
  if (card.weightedCollateralUsd > 0) {
    collLine += ` (${usd(card.weightedCollateralUsd)} backs the loan after the liquidation-threshold haircut`;
    collLine += card.blendedLt != null ? `, ~${num(card.blendedLt * 100, 0)}% blended LT)` : ")";
  }
  out.push(collLine);
  if (card.supplyingSymbols.length) {
    out.push(`- **Supplying:** ${card.supplyingSymbols.map(fmtAssetWithHub).join(", ")}`);
  }

  // Debt + what's borrowed.
  out.push(`- **Debt:** ${usd(card.totalDebtUsd)}`);
  if (card.borrowingSymbols.length) {
    out.push(`- **Borrowing:** ${card.borrowingSymbols.map(fmtAssetWithHub).join(", ")}`);
  }
  if (card.latestBorrowRate != null) {
    out.push(`- **Borrow rate:** ${num(card.latestBorrowRate, 2)}% APR on current debt`);
  }
  if (card.borrowingPowerUsd > 0) {
    out.push(
      `- **Borrowing power remaining:** ${usd(card.borrowingPowerUsd)} more borrowable before a 1.0 health factor`,
    );
  }
  out.push("");

  // Per-asset liquidation prices (collateral assets only — those that back debt).
  const collateralLiq = card.assetLiqPrices.filter((a) => a.liqPrice != null && a.liqPrice > 0);
  if (collateralLiq.length > 1) {
    out.push("### Collateral liquidation prices");
    for (const a of collateralLiq) {
      let line = `- **${a.symbol}:** ${usd(a.liqPrice!)} (current ${usd(a.currentPrice)}`;
      if (a.headroomPct != null) line += ` — ${num(a.headroomPct, 1)}% headroom`;
      line += ")";
      out.push(line);
    }
    out.push("");
  }

  // ── Economics ──
  const econ: string[] = [];
  const pnl = card.interestPnl;
  if (pnl?.hasData) {
    const verb = pnl.netUsd >= 0 ? "earned" : "paid";
    econ.push(`- **Net interest carry:** ${usd(Math.abs(pnl.netUsd))} ${verb} (supply interest − borrow interest)`);
    for (const a of pnl.assets) {
      const label = fmtAssetWithHub(a);
      if (a.supplyInterest > 0) {
        econ.push(`  - ${label}: +${amt(a.supplyInterest)} earned (${usd(a.supplyInterestUsd)})`);
      }
      if (a.borrowInterest > 0) {
        econ.push(`  - ${label}: −${amt(a.borrowInterest)} paid (${usd(a.borrowInterestUsd)})`);
      }
    }
    if (pnl.unattributed) {
      econ.push(
        `  - Some balance was opened via a swap aggregator / transfer-in, so its interest can't be attributed from the event record.`,
      );
    }
  }
  // Current per-asset balances (token + USD), for assets with a live position.
  const balLines: string[] = [];
  for (const r of reserves) {
    const s = netSupply(r);
    const d = netDebt(r);
    if (s <= 0.0001 && d <= 0.0001) continue;
    const price = resolvePrice(r.symbol, prices);
    const parts: string[] = [];
    if (s > 0.0001) parts.push(`${amt(s)} supplied${price != null ? ` (${usd(s * price)})` : ""}`);
    if (d > 0.0001) parts.push(`${amt(d)} borrowed${price != null ? ` (${usd(d * price)})` : ""}`);
    balLines.push(`- **${fmtAssetWithHub(r)}:** ${parts.join(", ")}`);
  }
  if (econ.length || balLines.length) {
    out.push("## Economics");
    out.push(...econ);
    if (balLines.length) {
      if (econ.length) out.push("");
      out.push("**Current balances**");
      out.push(...balLines);
    }
    out.push("");
  }

  return out;
}

function closedHeadlines(card: AaveSpokeCardInfo): string[] {
  const out: string[] = [];
  out.push("## Headlines");
  if (card.wasLiquidated) {
    out.push(
      `- This position has been **liquidated** ${card.liquidationCount} time${card.liquidationCount === 1 ? "" : "s"} on the ${card.name} spoke and currently holds no supply or debt.`,
    );
  } else {
    out.push(`- This position is **closed** — all debt was repaid and supplied collateral withdrawn.`);
  }
  out.push("");
  return out;
}

function timelineTable(events: BaseActivityEvent[]): string[] {
  const out: string[] = [];
  out.push(`## Activity timeline (${events.length} event${events.length === 1 ? "" : "s"}, oldest first)`);
  out.push("");
  if (events.length === 0) {
    out.push("_No transaction history available._");
    return out;
  }
  out.push(`| # | Date | Action | Asset | Amount | Supply after | Debt after | Borrow rate | Transaction |`);
  out.push("|---|------|--------|-------|--------|--------------|------------|-------------|-------------|");
  events.forEach((e, i) => {
    if (!isAaveV4Event(e)) return;
    const d = e.context.data;
    const label = actionLabel(getEventActionKey(e));
    // Hub belongs to the primary (reserve) side the event's ctx.hub describes; a
    // liquidation's collateral fallback carries no hub, so leave it unlabeled.
    const asset = d.reserveSymbol
      ? fmtAssetWithHub({ symbol: d.reserveSymbol, hub: d.hub })
      : (d.collateralSymbol ?? "—");
    const amount = d.amount != null ? amt(toNum(d.amount)) : "—";
    const supplyAfter = d.supplyAfter != null ? amt(toNum(d.supplyAfter)) : "—";
    const debtAfter = d.debtAfter != null ? amt(toNum(d.debtAfter)) : "—";
    // Borrow rate of the exact reserve this event acted on — matched by symbol
    // AND hub so two same-symbol reserves don't cross-read each other's rate.
    // "—" when the moved asset isn't a debt the position holds (supply/withdraw).
    const rateItem = (d.allDebts ?? []).find(
      (x) => x.symbol === d.reserveSymbol && (x.hub ?? undefined) === (d.hub ?? undefined),
    );
    const rate = rateItem?.borrowAPR != null ? `${(parseFloat(rateItem.borrowAPR) * 100).toFixed(2)}%` : "—";
    const tx = e.etherscanUrl ? `[${e.txHash.slice(0, 10)}…](${e.etherscanUrl})` : e.txHash.slice(0, 10) + "…";
    out.push(
      `| ${i + 1} | ${fmtUtc(e.timestamp)} | ${label} | ${asset} | ${amount} | ${supplyAfter} | ${debtAfter} | ${rate} | ${tx} |`,
    );
  });
  out.push("");
  return out;
}
