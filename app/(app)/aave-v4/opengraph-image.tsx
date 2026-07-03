import { OG_SIZE, renderExploreOg } from "@/lib/og/explore-og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const runtime = "nodejs";
export const alt = "Explore Aave V4 on Rails";

export default function Image() {
  return renderExploreOg({ icon: ["icons", "protocols", "aave-v4.png"], protocol: "Aave V4" });
}
