"use client";

// Spoke-grouped Aave V4 position card.
//
// Aave V4's unit of independent position is the *spoke*, not the reserve:
// within a spoke all your supplies cross-collateralize all your borrows
// (one shared health factor); different spokes are isolated from each
// other. So the natural grouping is one card per active spoke, with the
// spoke's reserves rendered as supply / debt halves inside.
//
// USD totals are wired through PricesProvider — collateral / debt sums
// per spoke render in the header when prices have resolved. Health-factor
// math still wants on-chain getUserAccountData (Phase 10) since it depends
// on the per-reserve liquidation thresholds, but the dollar weights alone
// already give the spoke a sense of scale.

import { useMemo } from "react";
import { TokenChipIcon } from "@/components/shared/token-chip-icon";
import type { AaveV4Position } from "@/lib/api/fetch-aave-v4";
import { usePrices } from "@/lib/shared/prices-context";
import { resolvePrice } from "@/lib/aave/prices";

const ACTIVITY_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function fmtNum(v: string): string {
  const n = parseFloat(v);
  if (!isFinite(n) || n === 0) return "0";
  if (Math.abs(n) >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(n) < 0.0001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function fmtUsd(n: number): string {
  if (!isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function fmtAgo(ts: number): string {
  if (!ts) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return ACTIVITY_FORMAT.format(new Date(ts * 1000));
}

interface SpokeGroup {
  spoke: string;
  spokeName: string;
  supplies: AaveV4Position[];
  debts: AaveV4Position[];
  lastActivityAt: number;
}

function groupBySpoke(positions: AaveV4Position[]): SpokeGroup[] {
  const map = new Map<string, SpokeGroup>();
  for (const p of positions) {
    const supplyN = parseFloat(p.supply);
    const debtN = parseFloat(p.debt);
    const isSupply = supplyN > 0;
    const isDebt = debtN > 0;
    if (!isSupply && !isDebt) continue;
    let g = map.get(p.spoke);
    if (!g) {
      g = { spoke: p.spoke, spokeName: p.spokeName, supplies: [], debts: [], lastActivityAt: 0 };
      map.set(p.spoke, g);
    }
    if (isSupply) g.supplies.push(p);
    if (isDebt) g.debts.push(p);
    if (p.lastActivityAt > g.lastActivityAt) g.lastActivityAt = p.lastActivityAt;
  }
  // Sort spokes: most recently active first. Within each side, biggest amount
  // first — useful when prices arrive (USD ranking will drop in there cleanly).
  const groups = [...map.values()];
  groups.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  for (const g of groups) {
    g.supplies.sort((a, b) => parseFloat(b.supply) - parseFloat(a.supply));
    g.debts.sort((a, b) => parseFloat(b.debt) - parseFloat(a.debt));
  }
  return groups;
}

function ReserveLine({
  symbol,
  amount,
  address,
  usd,
}: {
  symbol: string;
  amount: string;
  address?: string;
  usd?: number | null;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <TokenChipIcon symbol={symbol} address={address} size={20} />
      <span className="font-bold text-sm text-foreground tabular-nums">{fmtNum(amount)}</span>
      <span className="text-xs text-rb-500">{symbol}</span>
      {usd != null && usd > 0 && (
        <span className="ml-auto text-xs text-rb-500 tabular-nums">{fmtUsd(usd)}</span>
      )}
    </div>
  );
}

function SpokeCard({
  group,
  prices,
}: {
  group: SpokeGroup;
  prices: Record<string, number>;
}) {
  const hasSupplies = group.supplies.length > 0;
  const hasDebts = group.debts.length > 0;

  // Per-row USD plus per-side totals. Rows where the price is missing (token
  // not on DefiLlama and not in the stablecoin fallback) come back as null
  // and just skip the USD column rather than rendering "$0".
  const supplyUsds = group.supplies.map((p) => {
    const px = resolvePrice(p.reserveSymbol, prices);
    if (px == null) return null;
    const n = parseFloat(p.supply);
    if (!isFinite(n) || n <= 0) return null;
    return n * px;
  });
  const debtUsds = group.debts.map((p) => {
    const px = resolvePrice(p.reserveSymbol, prices);
    if (px == null) return null;
    const n = parseFloat(p.debt);
    if (!isFinite(n) || n <= 0) return null;
    return n * px;
  });
  const collTotal = supplyUsds.reduce((acc: number, v) => acc + (v ?? 0), 0);
  const debtTotal = debtUsds.reduce((acc: number, v) => acc + (v ?? 0), 0);
  const showHeaderUsd = collTotal > 0 || debtTotal > 0;

  return (
    <div className="rounded-lg border border-rb-200 dark:border-rb-800 overflow-hidden">
      <div className="px-4 py-2.5 bg-rb-100 dark:bg-rb-900 border-b border-rb-200 dark:border-rb-800 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{group.spokeName} <span className="text-rb-500 font-normal">spoke</span></h3>
          <p className="text-xs text-rb-500">
            {group.supplies.length} supply
            {" · "}
            {group.debts.length} debt
            {showHeaderUsd && (
              <>
                {" · "}
                <span className="text-blue-500 dark:text-blue-400 tabular-nums">{fmtUsd(collTotal)}</span>
                {debtTotal > 0 ? (
                  <>
                    {" / "}
                    <span className="text-emerald-500 dark:text-emerald-400 tabular-nums">{fmtUsd(debtTotal)}</span>
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>
        {group.lastActivityAt > 0 && (
          <span className="text-xs text-rb-500">{fmtAgo(group.lastActivityAt)}</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-x-6">
        <div className="px-4 py-3 sm:border-r border-rb-200/40 dark:border-rb-800/40">
          <div className="text-rb-500 text-xs font-semibold mb-1.5">Collateral</div>
          {hasSupplies ? (
            <div className="flex flex-col">
              {group.supplies.map((p, i) => (
                <ReserveLine
                  key={`s:${p.reserveId}`}
                  symbol={p.reserveSymbol}
                  address={p.reserveAddress}
                  amount={p.supply}
                  usd={supplyUsds[i]}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-rb-500 py-1.5">—</div>
          )}
        </div>
        <div className="px-4 py-3 border-t sm:border-t-0 border-rb-200/40 dark:border-rb-800/40">
          <div className="text-rb-500 text-xs font-semibold mb-1.5">Debt</div>
          {hasDebts ? (
            <div className="flex flex-col">
              {group.debts.map((p, i) => (
                <ReserveLine
                  key={`d:${p.reserveId}`}
                  symbol={p.reserveSymbol}
                  address={p.reserveAddress}
                  amount={p.debt}
                  usd={debtUsds[i]}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-rb-500 py-1.5">—</div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface AaveV4PositionCardProps {
  positions: AaveV4Position[];
}

export function AaveV4PositionCard({ positions }: AaveV4PositionCardProps) {
  const groups = useMemo(() => groupBySpoke(positions), [positions]);
  const prices = usePrices();

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-rb-200 dark:border-rb-800 px-4 py-6 text-center">
        <p className="text-sm text-rb-500">No open positions on Aave V4.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">Open Positions</h2>
        <span className="text-xs text-rb-500">
          {groups.length} active spoke{groups.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-3">
        {groups.map((g) => (
          <SpokeCard key={g.spoke} group={g} prices={prices} />
        ))}
      </div>
    </div>
  );
}
