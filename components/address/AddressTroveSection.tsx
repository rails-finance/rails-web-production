"use client";

import { useEffect, useMemo, useState } from "react";
import { TroveSummary } from "@/types/api/trove";
import { OraclePricesData } from "@/types/api/oracle";
import { TroveListingCard } from "@/components/troves/TroveListingCard";
import { fetchTroveTimeline } from "@/lib/api/fetch-timeline";
import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";
import { isLiquityEvent } from "@/lib/shared/types/event-shape";
import { LiquityEventCard } from "@/components/protocol/liquity/liquity-event-card";
import { TimelineDisplayProvider } from "@/components/shared/timeline-display-context";
import { LiquityTroveBarsProvider } from "@/lib/liquity/use-trove-bars";

interface AddressTroveSectionProps {
  trove: TroveSummary;
  prices?: OraclePricesData | null;
}

export function AddressTroveSection({ trove, prices }: AddressTroveSectionProps) {
  const [events, setEvents] = useState<BaseActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTroveTimeline({
      collateralType: trove.collateralType,
      troveId: trove.id,
      limit: 500,
    })
      .then((result) => {
        if (cancelled) return;
        setEvents(result?.events ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load timeline");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trove.collateralType, trove.id]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.blockNumber - b.blockNumber || a.timestamp - b.timestamp),
    [events],
  );

  return (
    <section className="space-y-3">
      <TroveListingCard trove={trove} prices={prices} />

      {loading ? (
        <div className="space-y-2 pl-4">
          <div className="h-16 bg-rb-200 dark:bg-rb-800 rounded-lg animate-pulse" />
          <div className="h-16 bg-rb-200/75 dark:bg-rb-800/75 rounded-lg animate-pulse" />
          <div className="h-16 bg-rb-200/50 dark:bg-rb-800/50 rounded-lg animate-pulse" />
        </div>
      ) : error ? (
        <div className="pl-4 text-sm text-red-500">Failed to load timeline: {error}</div>
      ) : sortedEvents.length === 0 ? (
        <div className="pl-4 text-sm text-rb-500">No transaction history available</div>
      ) : (
        <TimelineDisplayProvider>
          <LiquityTroveBarsProvider events={sortedEvents}>
            <div className="space-y-2 pl-4 border-l-2 border-rb-200 dark:border-rb-800">
              {sortedEvents.map((event, idx) => {
                if (!isLiquityEvent(event)) return null;
                const previousEvent = idx > 0 ? sortedEvents[idx - 1] : undefined;
                return (
                  <LiquityEventCard
                    key={event.id}
                    event={event}
                    addressDisplay="hidden"
                    isFirst={idx === 0}
                    isLast={idx === sortedEvents.length - 1}
                    previousEvent={previousEvent}
                  />
                );
              })}
            </div>
          </LiquityTroveBarsProvider>
        </TimelineDisplayProvider>
      )}
    </section>
  );
}
