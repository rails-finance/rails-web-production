// ============================================================================
// FETCH AAVE V4 SPOKE-POSITIONS
// ============================================================================
//
// Discovery list for the /aave-v4 page — the analog of Liquity's /api/troves.
// One row per (wallet, spoke) with aggregated USD totals and a server-side
// health factor. Backed by mv_aave_v4_spoke_positions in rails-server-mig.
//
// Wire shape mirrors rails-server-mig/api/src/routes/aaveV4.ts. Keep this
// file in sync with the SpokePositionRow / SpokePositionsResponse types
// there — both halves change together when filters or columns shift.

export interface AaveV4SpokePositionRow {
  wallet: string;
  spoke: string;
  spokeName: string;
  totalSupplyUsd: number | null;
  totalDebtUsd: number | null;
  weightedCollUsd: number | null;
  /** Aave-native HF = weightedCollUsd / totalDebtUsd. null when no debt. */
  healthFactor: number | null;
  supplyAssetCount: number;
  debtAssetCount: number;
  dominantSupplySymbol: string | null;
  dominantSupplyAddress: string | null;
  dominantDebtSymbol: string | null;
  dominantDebtAddress: string | null;
  lastActivityAt: number;
  lastBlockNumber: number;
  lastTxHash: string | null;
  /** Oldest price snapshot timestamp across all the position's assets. */
  oldestPriceFetchedAt: number | null;
  /** True if any non-zero balance reserve in this position lacks a price. */
  hasMissingPrice: boolean;
  ensName: string | null;
}

export interface AaveV4SpokePositionsResponse {
  rows: AaveV4SpokePositionRow[];
  total: number;
  limit: number;
  offset: number;
}

export type AaveV4SpokePositionSort =
  | "lastActivity"
  | "supplyUsd"
  | "debtUsd"
  | "healthFactor";

export interface FetchAaveV4SpokePositionsParams {
  spoke?: string;
  wallet?: string;
  ownerEns?: string;
  hasDebt?: boolean;
  noDebt?: boolean;
  healthBelow?: number;
  activeWithin?: number;
  sortBy?: AaveV4SpokePositionSort;
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
  baseUrl?: string;
}

export async function fetchAaveV4SpokePositions(
  p: FetchAaveV4SpokePositionsParams,
): Promise<AaveV4SpokePositionsResponse> {
  const qs = new URLSearchParams();
  if (p.spoke) qs.set("spoke", p.spoke);
  if (p.wallet) qs.set("wallet", p.wallet);
  if (p.ownerEns) qs.set("ownerEns", p.ownerEns);
  if (p.hasDebt) qs.set("hasDebt", "true");
  if (p.noDebt) qs.set("noDebt", "true");
  if (p.healthBelow != null) qs.set("healthBelow", String(p.healthBelow));
  if (p.activeWithin != null) qs.set("activeWithin", String(p.activeWithin));
  if (p.sortBy) qs.set("sortBy", p.sortBy);
  if (p.sortOrder) qs.set("sortOrder", p.sortOrder);
  if (p.limit != null) qs.set("limit", String(p.limit));
  if (p.offset != null) qs.set("offset", String(p.offset));

  const url = `${p.baseUrl ?? ""}/api/aave-v4/spoke-positions?${qs.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`fetchAaveV4SpokePositions failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as AaveV4SpokePositionsResponse;
}
