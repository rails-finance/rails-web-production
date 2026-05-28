// ============================================================================
// FETCH AAVE V4 ASSET-UNIVERSE
// ============================================================================
//
// Distinct token symbols seen across every open (wallet, spoke) position in
// mv_aave_v4_spoke_positions. Feeds the Supplying / Borrowing multi-select
// filters on /aave-v4. Data-driven on purpose — new spokes or reserves
// surface without a frontend config bump. Reserves whose symbol couldn't be
// resolved are returned as the "???" sentinel and the listing filter treats
// that as a first-class option.

/** One entry per distinct symbol seen on any open position. `asSupply` /
 *  `asDebt` hint whether the symbol has ever appeared on each side — purely
 *  advisory for the UI (e.g. dimming "never seen here" rows in the borrow
 *  pill). The server still permits any combination; the filter just may
 *  return zero rows. */
export interface AaveV4AssetUniverseEntry {
  symbol: string;
  asSupply: boolean;
  asDebt: boolean;
}

export interface AaveV4AssetUniverseResponse {
  assets: AaveV4AssetUniverseEntry[];
}

export interface FetchAaveV4AssetUniverseParams {
  baseUrl?: string;
}

export async function fetchAaveV4AssetUniverse(
  p: FetchAaveV4AssetUniverseParams = {},
): Promise<AaveV4AssetUniverseResponse> {
  const url = `${p.baseUrl ?? ""}/api/aave-v4/asset-universe`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `fetchAaveV4AssetUniverse failed: ${res.status} ${res.statusText}`,
    );
  }
  return (await res.json()) as AaveV4AssetUniverseResponse;
}
