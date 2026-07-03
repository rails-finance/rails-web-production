import { HUB_ORDER, type HubTierKey } from "@/lib/api/fetch-aave-v4-hubs";

// Shareable hub URL slugs for /aave-v4/hubs/[hub]. Branded — the slug follows
// the display name, so the Global Dollar hub is /aave-v4/hubs/global-dollar
// rather than its internal key (`paxos`). Core/Plus/Prime slugs equal their
// keys; only Global Dollar diverges.
export const HUB_SLUG: Record<HubTierKey, string> = {
  core: "core",
  plus: "plus",
  prime: "prime",
  paxos: "global-dollar",
};

const KEY_BY_SLUG: Record<string, HubTierKey> = Object.fromEntries(
  Object.entries(HUB_SLUG).map(([key, slug]) => [slug, key as HubTierKey]),
);

/** Resolve a URL segment to a hub key. Accepts the branded slug
 *  (`global-dollar`) or the raw key (`paxos`) as an alias; null if neither. */
export function hubFromSlug(slug: string): HubTierKey | null {
  const s = slug.toLowerCase();
  if (KEY_BY_SLUG[s]) return KEY_BY_SLUG[s];
  return (HUB_ORDER as readonly string[]).includes(s) ? (s as HubTierKey) : null;
}

export function slugifyHub(hub: HubTierKey): string {
  return HUB_SLUG[hub];
}
