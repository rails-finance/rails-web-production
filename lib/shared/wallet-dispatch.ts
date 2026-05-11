// ============================================================================
// WALLET-SEARCH DISPATCH
// ============================================================================
//
// Resolves a free-text wallet search (0x address or ENS) into a target URL
// across the mono-rails. Fires both protocols' position endpoints in parallel
// and routes by hit count:
//   0 protocols → /wallet/[slug] (umbrella shows empty state)
//   1 protocol  → that protocol's /[protocol]/[wallet] page
//   2+ protocols → /wallet/[slug] (umbrella renders both)
//
// ENS handling: ENS resolves server-side via each API's ownerEns/wallet
// filters (both accept it). For protocols whose wallet route requires a 0x
// form (Aave V4), we extract the resolved address from the first returned
// row. If neither API returns rows and the input was ENS, we still navigate
// to the umbrella with the ENS as the slug — the umbrella's slug accepts
// either form and renders an empty state.
//
// Trove-ID searches are NOT routed through this dispatcher; they bypass it
// and go straight to /liquity-v2?troveId=X.

import type { TrovesResponse } from "@/types/api/trove";
import type { AaveV4SpokePositionsResponse } from "@/lib/api/fetch-aave-v4-spoke-positions";

export type DispatchProtocol = "liquity-v2-troves" | "aave-v4";

export interface DispatchResult {
  /** Where to send the user. */
  url: string;
  /** Protocols with non-empty position rows. Empty if no hits anywhere. */
  protocols: DispatchProtocol[];
  /** Resolved lowercase 0x address. Null only when input was ENS that
   *  returned zero hits across both protocols. */
  resolvedAddress: string | null;
  /** Original ENS form if input was ENS, else null. */
  ensName: string | null;
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const LOWER_ADDRESS_RE = /^0x[a-f0-9]{40}$/;

/** Dispatches a wallet/ENS search. Returns null only if input is unparseable
 *  (not an address, not an ENS, not a trove ID). Trove IDs aren't this
 *  function's concern — caller handles them. */
export async function dispatchWalletSearch(input: string): Promise<DispatchResult | null> {
  const trimmed = input.trim();
  const isAddress = ADDRESS_RE.test(trimmed);
  const isEns = trimmed.toLowerCase().endsWith(".eth");
  if (!isAddress && !isEns) return null;

  const lowered = trimmed.toLowerCase();
  const trovesQuery = isAddress
    ? `ownerAddress=${lowered}`
    : `ownerEns=${encodeURIComponent(trimmed)}`;
  const aaveQuery = isAddress
    ? `wallet=${lowered}`
    : `ownerEns=${encodeURIComponent(trimmed)}`;

  const [trovesSettled, aaveSettled] = await Promise.allSettled([
    fetch(`/api/troves?${trovesQuery}&limit=5`),
    fetch(`/api/aave-v4/spoke-positions?${aaveQuery}&limit=5`),
  ]);

  let trovesHit = false;
  let aaveHit = false;
  let resolvedAddress: string | null = isAddress ? lowered : null;

  if (trovesSettled.status === "fulfilled" && trovesSettled.value.ok) {
    try {
      const data = (await trovesSettled.value.json()) as TrovesResponse;
      trovesHit = !!data?.data?.length;
      if (!resolvedAddress && trovesHit) {
        const first = data.data[0];
        const o = (first.owner ?? first.lastOwner)?.toLowerCase();
        if (o && LOWER_ADDRESS_RE.test(o)) resolvedAddress = o;
      }
    } catch {
      /* swallow — protocol absence is the right semantic */
    }
  }

  if (aaveSettled.status === "fulfilled" && aaveSettled.value.ok) {
    try {
      const data = (await aaveSettled.value.json()) as AaveV4SpokePositionsResponse;
      aaveHit = !!data?.rows?.length;
      if (!resolvedAddress && aaveHit) {
        const w = data.rows[0].wallet?.toLowerCase();
        if (w && LOWER_ADDRESS_RE.test(w)) resolvedAddress = w;
      }
    } catch {
      /* swallow */
    }
  }

  const protocols: DispatchProtocol[] = [];
  if (trovesHit) protocols.push("liquity-v2-troves");
  if (aaveHit) protocols.push("aave-v4");

  const slug = resolvedAddress ?? trimmed;
  const ensName = isEns ? trimmed : null;

  let url: string;
  if (protocols.length === 1 && protocols[0] === "liquity-v2-troves") {
    url = `/liquity-v2/${encodeURIComponent(slug)}`;
  } else if (protocols.length === 1 && protocols[0] === "aave-v4") {
    // Aave wallet page validates a 0x form. If somehow only Aave hit and the
    // wallet field wasn't an address, fall through to the umbrella, which
    // accepts ENS slugs.
    url = resolvedAddress
      ? `/aave-v4/${resolvedAddress}`
      : `/wallet/${encodeURIComponent(slug)}`;
  } else {
    // 0 or 2+ protocols both land on the umbrella. Empty state handled there.
    url = `/wallet/${encodeURIComponent(slug)}`;
  }

  return { url, protocols, resolvedAddress, ensName };
}
