import { spokeFromSlug } from "@/lib/aave-v4/spoke-meta";
import { OG_SIZE, renderExploreOg } from "@/lib/og/explore-og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";
export const alt = "Explore an Aave V4 spoke on Rails";

export default async function Image({ params }: { params: Promise<{ hub: string; spoke: string }> }) {
  const { spoke } = await params;
  const name = spokeFromSlug(spoke) ?? decodeURIComponent(spoke);
  return renderExploreOg({ icon: ["icons", "protocols", "aave-v4.png"], protocol: "Aave V4", qualifier: name });
}
