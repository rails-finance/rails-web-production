// ============================================================================
// Activity-timeline → CSV serializer
// ============================================================================
//
// Turns a BaseActivityEvent[] (the same array the detail pages already render)
// into an RFC-4180 CSV string. Columns are a shared core (date / tx / action /
// flows / gas) plus a protocol-specific block appended only when events of that
// protocol are present, so a single-rail export (the only kind we wire up today)
// stays narrow and a hypothetical mixed export still round-trips every field.
//
// Aave V4 numeric fields ship over the wire as strings to preserve precision —
// we pass them through verbatim rather than parseFloat-ing at the boundary
// (see lib/shared/types/event-shape.ts).

import type { AssetFlow, BaseActivityEvent } from "./types/event-shape";
import { isAaveV4Event, isLiquityEvent } from "./types/event-shape";

type Column = {
  header: string;
  get: (e: BaseActivityEvent) => string | number | undefined | null;
};

/** RFC-4180 field escaping: wrap in quotes and double any embedded quote when
 *  the value contains a comma, quote, or newline. */
function escapeCsv(value: string | number | undefined | null): string {
  if (value == null) return "";
  const s = typeof value === "number" ? String(value) : value;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isoDate(ts: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toISOString();
}

/** Flatten an event's token movements into one cell. Leading the entry with the
 *  symbol (a letter) rather than the +/- sign keeps spreadsheets from parsing
 *  the cell as a formula. */
function summarizeFlows(flows: AssetFlow[] | undefined): string {
  if (!flows || flows.length === 0) return "";
  return flows
    .map((f) => {
      const sign = f.direction === "in" ? "+" : "-";
      const usd = f.valueUsd != null ? ` ($${f.valueUsd.toFixed(2)})` : "";
      return `${f.tokenSymbol} ${sign}${f.amountFormatted}${usd}`;
    })
    .join("; ");
}

const CORE_COLUMNS: Column[] = [
  { header: "Date (UTC)", get: (e) => isoDate(e.timestamp) },
  { header: "Block", get: (e) => e.blockNumber },
  { header: "Action", get: (e) => e.actionLabel },
  { header: "Wallet", get: (e) => e.wallet },
  { header: "Token Flows", get: (e) => summarizeFlows(e.flows) },
  { header: "Gas (ETH)", get: (e) => e.gas?.gasCostEth ?? "" },
  { header: "Gas (USD)", get: (e) => e.gas?.gasCostUsd ?? "" },
  { header: "Tx Hash", get: (e) => e.txHash },
  { header: "Etherscan", get: (e) => e.etherscanUrl },
];

const LIQUITY_COLUMNS: Column[] = [
  { header: "Collateral", get: (e) => (isLiquityEvent(e) ? e.context.data.collateralType : "") },
  { header: "Trove ID", get: (e) => (isLiquityEvent(e) ? e.context.data.troveId : "") },
  { header: "Operation", get: (e) => (isLiquityEvent(e) ? e.context.data.operation : "") },
  { header: "Coll Price (USD)", get: (e) => (isLiquityEvent(e) ? e.context.data.collateralPrice : "") },
  { header: "Debt Before", get: (e) => (isLiquityEvent(e) ? e.context.data.stateBefore.debt : "") },
  { header: "Debt After", get: (e) => (isLiquityEvent(e) ? e.context.data.stateAfter.debt : "") },
  { header: "Coll Before", get: (e) => (isLiquityEvent(e) ? e.context.data.stateBefore.coll : "") },
  { header: "Coll After", get: (e) => (isLiquityEvent(e) ? e.context.data.stateAfter.coll : "") },
  {
    header: "Interest Rate Before",
    get: (e) => (isLiquityEvent(e) ? e.context.data.stateBefore.annualInterestRate : ""),
  },
  {
    header: "Interest Rate After",
    get: (e) => (isLiquityEvent(e) ? e.context.data.stateAfter.annualInterestRate : ""),
  },
  { header: "Coll Ratio After", get: (e) => (isLiquityEvent(e) ? e.context.data.stateAfter.collateralRatio : "") },
];

const AAVE_COLUMNS: Column[] = [
  { header: "Spoke", get: (e) => (isAaveV4Event(e) ? (e.context.data.spokeName ?? "Main") : "") },
  { header: "Event Type", get: (e) => (isAaveV4Event(e) ? e.context.data.eventType : "") },
  { header: "Reserve", get: (e) => (isAaveV4Event(e) ? (e.context.data.reserveSymbol ?? "") : "") },
  { header: "Amount", get: (e) => (isAaveV4Event(e) ? (e.context.data.amount ?? "") : "") },
  { header: "Price (USD)", get: (e) => (isAaveV4Event(e) ? (e.context.data.price?.usd ?? "") : "") },
  { header: "Supply Before", get: (e) => (isAaveV4Event(e) ? (e.context.data.supplyBefore ?? "") : "") },
  { header: "Supply After", get: (e) => (isAaveV4Event(e) ? (e.context.data.supplyAfter ?? "") : "") },
  { header: "Debt Before", get: (e) => (isAaveV4Event(e) ? (e.context.data.debtBefore ?? "") : "") },
  { header: "Debt After", get: (e) => (isAaveV4Event(e) ? (e.context.data.debtAfter ?? "") : "") },
  { header: "Supply APR", get: (e) => (isAaveV4Event(e) ? (e.context.data.supplyAPR ?? "") : "") },
  { header: "Borrow APR", get: (e) => (isAaveV4Event(e) ? (e.context.data.borrowAPR ?? "") : "") },
  // Liquidation-only fields — empty on every other Aave row.
  { header: "Liq Collateral", get: (e) => (isAaveV4Event(e) ? (e.context.data.collateralSymbol ?? "") : "") },
  { header: "Liq Debt Covered", get: (e) => (isAaveV4Event(e) ? (e.context.data.debtToCover ?? "") : "") },
  {
    header: "Liq Collateral Seized",
    get: (e) => (isAaveV4Event(e) ? (e.context.data.liquidatedCollateralAmount ?? "") : ""),
  },
];

/** Serialize an activity timeline to a CSV string (CRLF line endings, header
 *  row first). Protocol-specific columns are appended only for protocols that
 *  appear in `events`. */
export function eventsToCsv(events: BaseActivityEvent[]): string {
  const columns: Column[] = [
    ...CORE_COLUMNS,
    ...(events.some(isLiquityEvent) ? LIQUITY_COLUMNS : []),
    ...(events.some(isAaveV4Event) ? AAVE_COLUMNS : []),
  ];
  const header = columns.map((c) => escapeCsv(c.header)).join(",");
  const rows = events.map((e) => columns.map((c) => escapeCsv(c.get(e))).join(","));
  return [header, ...rows].join("\r\n");
}
