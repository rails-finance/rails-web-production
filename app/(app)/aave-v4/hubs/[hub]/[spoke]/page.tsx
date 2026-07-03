// Aave V4 hub+spoke landing (/aave-v4/hubs/[hub]/[spoke]) — a canonical,
// shareable, OG-bearing entry point that renders the discovery listing
// pre-filtered to one spoke. Like the hub page it is NOT a distinct data view:
// it seeds the shared AaveV4Listing with `spokes=[value]` (spoke-only — the
// spoke uniquely determines its hub, and adding the hub param would AND-out a
// cross-hub spoke, matching the hub-card spoke pills) and hands off to the
// canonical query form (/aave-v4?spokes=…) on first interaction. The hub in the
// path is the hierarchy + validation (the spoke must be a member of it); the
// per-spoke Open Graph image lives in the sibling opengraph-image.tsx.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AaveV4Listing } from "@/components/aave-v4/AaveV4Listing";
import { HUB_LABEL } from "@/lib/aave-v4/hub-view";
import { hubFromSlug, slugifyHub } from "@/lib/aave-v4/hub-slug";
import { spokeFromSlug, spokeValueFromSlug, slugFromSpokeValue } from "@/lib/aave-v4/spoke-meta";
import { SPOKE_HOME_HUB } from "@/lib/aave-v4/spoke-hub";
import type { HubTierKey } from "@/lib/api/fetch-aave-v4-hubs";

type Params = { hub: string; spoke: string };

/** Resolve + validate the (hub, spoke) pair: both must be known, and the spoke
 *  must be a member of the hub (its home hub). Returns the canonical pieces or
 *  null so the page/metadata can 404 in lock-step. */
function resolve(hub: string, spoke: string) {
  const hubKey = hubFromSlug(hub);
  const spokeValue = spokeValueFromSlug(spoke);
  const spokeName = spokeFromSlug(spoke);
  if (!hubKey || !spokeValue || !spokeName) return null;
  if (SPOKE_HOME_HUB[spokeValue] !== hubKey) return null;
  return { hubKey, spokeValue, spokeName };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { hub, spoke } = await params;
  const r = resolve(hub, spoke);
  if (!r) return { title: "Spoke not found" };

  const hubLabel = HUB_LABEL[r.hubKey];
  const title = `Rails | ${r.spokeName}`;
  const canonical = `/aave-v4/hubs/${slugifyHub(r.hubKey)}/${slugFromSpokeValue(r.spokeValue)}`;
  const description = `Explore live positions in the ${r.spokeName} spoke — part of Aave V4's ${hubLabel} hub.`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { title, description, url: `https://rails.finance${canonical}`, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function AaveV4HubSpokeLandingPage({ params }: { params: Promise<Params> }) {
  const { hub, spoke } = await params;
  const r = resolve(hub, spoke);
  if (!r) notFound();

  const hubLabel = HUB_LABEL[r.hubKey as HubTierKey];

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 pt-8">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-rb-500">
          <Link href="/aave-v4" className="text-blue-500 hover:underline">
            Aave V4
          </Link>{" "}
          /{" "}
          <Link href="/aave-v4/hubs" className="text-blue-500 hover:underline">
            Hubs
          </Link>{" "}
          /{" "}
          <Link href={`/aave-v4/hubs/${slugifyHub(r.hubKey)}`} className="text-blue-500 hover:underline">
            {hubLabel}
          </Link>{" "}
          / {r.spokeName}
        </div>
      </div>

      <AaveV4Listing seed={{ spokes: [r.spokeValue] }} />
    </>
  );
}
