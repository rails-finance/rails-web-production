"use client";

// Minimum-viable LlamaLend event card.
//
// v1 surface: deliberately does NOT wire into the universal EventCard shell —
// that requires TimelineScale / SingleWallet / TimelineDisplay providers and
// the SpineColumn family. Keeping the card freestanding makes the first
// integration visible without dragging in the larger shared chrome, which is
// the actual "shape fit" question to evaluate next.
//
// What's intentionally absent vs the explorer port:
//   - Bands visualization (n1/n2 pill + price axis)
//   - Soft-liq price estimate + headroom badge
//   - Position card selector (one card per (controller, epoch) lifecycle)
//   - Economics tower (dual collateral/debt bucket chart)
//   - USD chips on flows
// Each of those is a follow-up slice. The card focuses on the bare event
// payload so we can validate the wire shape before investing in chrome.

import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import type { LlamalendContext } from "@/lib/shared/types/protocols/llamalend";

const EVENT_TYPE_TONE: Record<string, string> = {
  open: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  close: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
  borrow: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  repay: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  remove_collateral: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  liquidated: "bg-red-500/10 text-red-300 border-red-500/30",
  liquidate: "bg-red-500/10 text-red-300 border-red-500/30",
  soft_liquidated: "bg-orange-500/10 text-orange-300 border-orange-500/30",
};

function fmt(value: string | undefined, digits = 4): string {
  if (value === undefined || value === null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function shortAddr(addr: string | undefined): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export interface LlamalendEventCardProps {
  event: BaseActivityEvent & { context: { protocol: "llamalend"; data: LlamalendContext } };
}

export function LlamalendEventCard({ event }: LlamalendEventCardProps) {
  const ctx = event.context.data;
  const tone = EVENT_TYPE_TONE[ctx.eventType] ?? "bg-zinc-500/10 text-zinc-300 border-zinc-500/30";
  const collSym = ctx.collateralSymbol ?? "?";
  const borrowSym = ctx.borrowedSymbol ?? "?";
  const familyTag = ctx.family === "mint" ? "crvUSD mint" : "LlamaLend lend";

  const dateStr = new Date(event.timestamp * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article className="rounded-md border border-rb-text-100/10 bg-rb-bg-100/40 p-4 text-foreground">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${tone}`}>
            {ctx.eventType}
          </span>
          <h3 className="text-sm font-semibold">{event.actionLabel}</h3>
          <span className="text-xs text-rb-text-500">{collSym} / {borrowSym}</span>
          <span className="text-xs text-rb-text-500/70">· {familyTag}</span>
          {ctx.positionEpoch && ctx.positionEpoch > 1 ? (
            <span className="text-xs text-rb-text-500/70">· epoch {ctx.positionEpoch}</span>
          ) : null}
        </div>
        <span className="text-xs text-rb-text-500">{dateStr}</span>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-rb-text-500">Δ collateral</dt>
          <dd className="font-mono">{fmt(ctx.deltaCollateral)} <span className="text-rb-text-500">{collSym}</span></dd>
        </div>
        <div>
          <dt className="text-xs text-rb-text-500">Δ debt</dt>
          <dd className="font-mono">{fmt(ctx.deltaDebt)} <span className="text-rb-text-500">{borrowSym}</span></dd>
        </div>
        <div>
          <dt className="text-xs text-rb-text-500">collateral after</dt>
          <dd className="font-mono">{fmt(ctx.collateralAfter)} <span className="text-rb-text-500">{collSym}</span></dd>
        </div>
        <div>
          <dt className="text-xs text-rb-text-500">debt after</dt>
          <dd className="font-mono">{fmt(ctx.debtAfter)} <span className="text-rb-text-500">{borrowSym}</span></dd>
        </div>
      </dl>

      {ctx.eventType === "liquidated" ? (
        <p className="mt-2 text-xs text-rb-text-500">
          liquidator <code className="font-mono">{shortAddr(ctx.liquidator)}</code>
          {ctx.debtCleared ? <> · cleared {fmt(ctx.debtCleared)} {borrowSym}</> : null}
          {ctx.stablecoinReceived && ctx.stablecoinReceived !== "0" ? <> · residual {fmt(ctx.stablecoinReceived)} {borrowSym}</> : null}
        </p>
      ) : null}

      <footer className="mt-3 flex flex-wrap items-center gap-3 text-xs text-rb-text-500">
        <span>block {event.blockNumber.toLocaleString()}</span>
        {ctx.n1 && ctx.n2 ? <span>bands [{ctx.n1} → {ctx.n2}]</span> : null}
        <a
          href={event.etherscanUrl}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-rb-text-500/40 underline-offset-2 hover:text-foreground"
        >
          tx {shortAddr(event.txHash)}
        </a>
        <span className="ml-auto text-rb-text-500/70">controller {shortAddr(ctx.controller)}</span>
      </footer>
    </article>
  );
}
