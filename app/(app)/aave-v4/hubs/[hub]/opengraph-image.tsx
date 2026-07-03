import { HUB_LABEL } from "@/lib/aave-v4/hub-view";
import { hubFromSlug } from "@/lib/aave-v4/hub-slug";
import { OG_SIZE, renderExploreOg } from "@/lib/og/explore-og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";
export const alt = "Explore an Aave V4 hub on Rails";

export default async function Image({ params }: { params: Promise<{ hub: string }> }) {
  const { hub } = await params;
  const key = hubFromSlug(hub);
  const label = key ? HUB_LABEL[key] : hub;
  return renderExploreOg({
    icon: ["icons", "protocols", "aave-v4.png"],
    protocol: "Aave V4",
    qualifier: `${label} Hub`,
  });
}
