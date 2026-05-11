// ============================================================================
// FETCH AAVE V4
// ============================================================================
//
// Thin typed clients over /api/aave-v4/timeline and /api/aave-v4/positions.
// Both go via the Next route handlers (which attach the bearer token and
// forward to the rails-server-mig Express endpoints). Server components can
// pass `baseUrl` to call the same Next routes from SSR.
//
// Wire-format contracts:
//   /timeline → BaseActivityEvent[] with AaveV4Context attached. Match the
//     rails-server-mig api/src/routes/aaveV4.ts TimelineResponse type.
//   /positions → flat list of (spoke, reserve) rows; one entry per non-zero
//     supply/debt pair from mv_aave_v4_positions.

import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";

export interface FetchAaveV4TimelineResult {
  wallet: string;
  events: BaseActivityEvent[];
  totalEvents: number;
}

export interface AaveV4Position {
  spoke: string;
  spokeName: string;
  reserveId: string;
  reserveSymbol: string;
  reserveAddress: string;
  reserveDecimals: number;
  /** Human-readable supply balance. */
  supply: string;
  /** Human-readable debt balance. */
  debt: string;
  lastActivityAt: number;
  lastBlockNumber: number;
  lastTxHash: string | null;
}

export interface FetchAaveV4PositionsResult {
  wallet: string;
  positions: AaveV4Position[];
}

export interface FetchAaveV4Params {
  wallet: string;
  /** SSR override — server components calling the Next API route directly
   *  need an absolute origin since `fetch` in node has no implicit base. */
  baseUrl?: string;
}

export async function fetchAaveV4Timeline(
  { wallet, baseUrl = "" }: FetchAaveV4Params,
): Promise<FetchAaveV4TimelineResult> {
  const url = `${baseUrl}/api/aave-v4/timeline?wallet=${encodeURIComponent(wallet)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`fetchAaveV4Timeline failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as FetchAaveV4TimelineResult;
}

export async function fetchAaveV4Positions(
  { wallet, baseUrl = "" }: FetchAaveV4Params,
): Promise<FetchAaveV4PositionsResult> {
  const url = `${baseUrl}/api/aave-v4/positions?wallet=${encodeURIComponent(wallet)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`fetchAaveV4Positions failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as FetchAaveV4PositionsResult;
}
