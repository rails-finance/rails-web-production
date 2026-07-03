import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Aave V4",
  description:
    "Explore Aave V4 wallet activity across all 11 spokes — supply, borrow, liquidations, and collateral toggles per market with full position context.",
  openGraph: {
    title: "Rails | Explore Aave V4",
    description:
      "Explore Aave V4 wallet activity across all 11 spokes — supply, borrow, liquidations, and collateral toggles per market.",
    url: "https://rails.finance/aave-v4",
    type: "website",
    // og:image comes from the dynamic `opengraph-image` route (this segment +
    // spoke/[…]/ + hubs/[hub]/). Leaving `images` unset keeps the file
    // convention as the single, unambiguous source of the og:image tag.
  },
  twitter: {
    card: "summary_large_image",
    title: "Rails | Explore Aave V4",
    description: "Explore Aave V4 wallet activity across all 11 spokes.",
  },
};

export default function AaveV4Layout({ children }: { children: React.ReactNode }) {
  return children;
}
