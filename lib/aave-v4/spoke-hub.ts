// Each spoke's HOME hub — the hub whose liquidity holds the spoke's collateral,
// fixed at deployment (Aave V4 market topology; mirrors the backend's
// SPOKE_BY_KEY.hub). Keyed by the spoke slug, which is both the API's `l.spoke`
// and the listing's `?spokes=` param value.
//
// A spoke's home hub is distinct from the `hub` on any individual credit line:
// a cross-hub-credit spoke (Bluechip, Stablecoin Correlated) supplies collateral
// in its home hub but DRAWS borrows from another hub's liquidity — those borrow
// lines carry the OTHER hub's key in `l.hub`. That gap is exactly what the
// /aave-v4/hubs "Borrowed via <hub>" line surfaces (see lib/aave-v4/hub-view).

import type { HubTierKey } from "@/lib/api/fetch-aave-v4-hubs";

export const SPOKE_HOME_HUB: Record<string, HubTierKey> = {
  main: "core",
  forex: "core",
  gold: "core",
  bluechip: "prime",
  ethena_corr: "plus",
  ethena_eco: "plus",
  etherfi: "core",
  kelp: "core",
  lido: "core",
  lombard: "core",
  usdg_pendle: "paxos",
};
