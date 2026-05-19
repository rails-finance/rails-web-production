"use client";

// LlamaLend wallet detail.
//
// Two parallel fetches: /api/llamalend/positions for the currently-open
// (controller, positionEpoch) lifecycles (rendered as cards at the top), and
// /api/llamalend/timeline for the full event history (rendered below).
// PricesProvider wraps both so the position-card health column can resolve
// oracle prices via /api/prices.
//
// Intentionally deferred for v1: day grouping, type/date filters, transaction
// heatmap, soft-liq synthesized events (B2), bands visualization (C2),
// economics tower (C4). The page validates the full positions + timeline
// pipeline end-to-end; richer chrome lands incrementally per
// migration/llamalend-followups.md.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchLlamalendTimeline, fetchLlamalendPositions } from "@/lib/api/fetch-llamalend";
import type { LlamalendPosition } from "@/lib/api/fetch-llamalend";
import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isLlamalendEvent } from "@/lib/shared/types/event-shape";
import { LlamalendEventCard } from "@/components/protocol/llamalend/llamalend-event-card";
import { LlamalendPositionCardSelector } from "@/components/shared/llamalend-position-card-selector";
import { PricesProvider } from "@/lib/shared/prices-context";
import { TimelineDisplayProvider } from "@/components/shared/timeline-display-context";
import { SingleWalletProvider } from "@/components/shared/activity-timeline";

export default function LlamalendWalletPage() {
  return (
    <PricesProvider>
      <SingleWalletProvider value={true}>
        <TimelineDisplayProvider>
          <LlamalendWalletPageInner />
        </TimelineDisplayProvider>
      </SingleWalletProvider>
    </PricesProvider>
  );
}

function LlamalendWalletPageInner() {
  const params = useParams<{ wallet: string }>();
  const wallet = (params?.wallet ?? "").toLowerCase();

  const [events, setEvents] = useState<BaseActivityEvent[] | null>(null);
  const [positions, setPositions] = useState<LlamalendPosition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [selectedPosition, setSelectedPosition] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    setEvents(null);
    setPositions(null);
    setError(null);
    Promise.allSettled([
      fetchLlamalendTimeline({ wallet }),
      fetchLlamalendPositions({ wallet }),
    ]).then((results) => {
      if (cancelled) return;
      const [timelineR, positionsR] = results;
      if (timelineR.status === "fulfilled") {
        setEvents(timelineR.value.events);
      } else {
        const e = timelineR.reason;
        setError(e instanceof Error ? e.message : String(e));
      }
      if (positionsR.status === "fulfilled") {
        setPositions(positionsR.value.positions);
      } else {
        // Positions are non-fatal — the timeline still renders.
        setPositions([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const ordered = events
    ? [...events].sort((a, b) =>
        order === "newest" ? b.blockNumber - a.blockNumber : a.blockNumber - b.blockNumber,
      )
    : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-foreground">
      <header className="mb-6">
        <Link href="/" className="text-xs text-rb-text-500 hover:text-foreground">
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Curve LlamaLend</h1>
        <p className="mt-1 break-all text-sm text-rb-text-500">{wallet}</p>
      </header>

      {positions && positions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-rb-500">
            Open positions
          </h2>
          <div className="rounded-lg bg-rb-200/50 dark:bg-rb-900">
            <LlamalendPositionCardSelector
              positions={positions}
              selected={selectedPosition}
              onSelect={setSelectedPosition}
            />
          </div>
        </section>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-rb-text-500">
          {events === null
            ? "Loading…"
            : `${events.length} event${events.length === 1 ? "" : "s"}`}
        </p>
        <button
          type="button"
          onClick={() => setOrder((o) => (o === "newest" ? "oldest" : "newest"))}
          className="rounded border border-rb-text-100/10 px-2 py-1 text-xs text-rb-text-500 hover:text-foreground"
        >
          {order === "newest" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Failed to load: {error}
        </div>
      ) : ordered === null ? (
        <div className="text-sm text-rb-text-500">Fetching timeline…</div>
      ) : ordered.length === 0 ? (
        <div className="rounded border border-rb-text-100/10 bg-rb-bg-100/40 p-6 text-sm text-rb-text-500">
          No LlamaLend activity for this wallet.
        </div>
      ) : (
        <ol className="space-y-3">
          {ordered.map((event, idx) => {
            if (!isLlamalendEvent(event)) return null;
            return (
              <li key={event.id}>
                <LlamalendEventCard
                  event={event}
                  isFirst={idx === 0}
                  isLast={idx === ordered.length - 1}
                />
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
