// Aave V4 hub landing (/aave-v4/hubs/[hub]) — a canonical, shareable,
// OG-bearing entry point that renders the discovery listing pre-filtered to one
// hub. It is NOT a distinct data view: it seeds the shared AaveV4Listing with
// `hubs=[key]`, and the moment the user touches a filter the listing hands off
// to the canonical query-param form (/aave-v4?hubs=…). The per-hub Open Graph
// image lives in the sibling opengraph-image.tsx.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AaveV4Listing } from "@/components/aave-v4/AaveV4Listing";
import { HUB_LABEL, HUB_PURPOSE } from "@/lib/aave-v4/hub-view";
import { hubFromSlug, slugifyHub } from "@/lib/aave-v4/hub-slug";

export async function generateMetadata({ params }: { params: Promise<{ hub: string }> }): Promise<Metadata> {
  const { hub } = await params;
  const key = hubFromSlug(hub);
  if (!key) return { title: "Hub not found" };

  const label = HUB_LABEL[key];
  const title = `Rails | ${label} Hub`;
  const description = `${HUB_PURPOSE[key]} Explore live positions in the ${label} hub on Aave V4.`;
  const url = `https://rails.finance/aave-v4/hubs/${slugifyHub(key)}`;

  return {
    // Absolute — the root "Rails | %s" template only cascades one level (to the
    // aave-v4 layout), so this grandchild sets the full title itself.
    title: { absolute: title },
    description,
    alternates: { canonical: `/aave-v4/hubs/${slugifyHub(key)}` },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function AaveV4HubLandingPage({ params }: { params: Promise<{ hub: string }> }) {
  const { hub } = await params;
  const key = hubFromSlug(hub);
  if (!key) notFound();

  const label = HUB_LABEL[key];

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
          / {label}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold text-foreground">{label} Hub</h1>
          <Link href="/aave-v4/hubs" className="text-[13px] text-blue-500 hover:underline">
            Compare all hubs
          </Link>
        </div>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-rb-500">{HUB_PURPOSE[key]}</p>
      </div>

      <AaveV4Listing seed={{ hubs: [key] }} />
    </>
  );
}
