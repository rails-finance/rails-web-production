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
