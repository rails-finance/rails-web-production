"use client";

// LlamaLend wallet detail — v1 minimum slice.
//
// Fetches /api/llamalend/timeline and renders a chronological list of cards.
// Intentionally lean: no spoke selector, no positions endpoint, no filters,
// no day grouping, no economics tower. The aim of this page is to validate
// the wire shape end-to-end and surface the next pain points (visual chrome
// fit, position-lifecycle grouping, soft-liq synthesis on the API side).

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchLlamalendTimeline } from "@/lib/api/fetch-llamalend";
import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isLlamalendEvent } from "@/lib/shared/types/event-shape";
import { LlamalendEventCard } from "@/components/protocol/llamalend/llamalend-event-card";

export default function LlamalendWalletPage() {
  const params = useParams<{ wallet: string }>();
  const wallet = (params?.wallet ?? "").toLowerCase();

  const [events, setEvents] = useState<BaseActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    setEvents(null);
    setError(null);
    fetchLlamalendTimeline({ wallet })
      .then((r) => {
        if (cancelled) return;
        setEvents(r.events);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
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
          {ordered.map((event) => {
            if (!isLlamalendEvent(event)) return null;
            return (
              <li key={event.id}>
                <LlamalendEventCard event={event} />
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
