// ============================================================================
// FETCH LLAMALEND
// ============================================================================
//
// Thin typed client over /api/llamalend/timeline. Mirrors fetch-aave-v4.ts.
// Server components must pass `baseUrl` because Node's fetch has no implicit
// origin; client components pass relative URLs.

import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";

export interface FetchLlamalendTimelineResult {
  wallet: string;
  events: BaseActivityEvent[];
  totalEvents: number;
}

export interface FetchLlamalendParams {
  wallet: string;
  baseUrl?: string;
}

export async function fetchLlamalendTimeline(
  { wallet, baseUrl = "" }: FetchLlamalendParams,
): Promise<FetchLlamalendTimelineResult> {
  const url = `${baseUrl}/api/llamalend/timeline?wallet=${encodeURIComponent(wallet)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`fetchLlamalendTimeline failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as FetchLlamalendTimelineResult;
}
