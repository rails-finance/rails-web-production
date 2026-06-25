import type { Metadata } from "next";

interface Props {
  params: Promise<{
    collateralType: string;
    troveId: string;
  }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const { collateralType, troveId } = resolvedParams;

  const collateralDisplay = collateralType === "WETH" ? "ETH" : collateralType;

  // Truncate troveId for display (first 8 chars + ...)
  const truncatedTroveId = troveId.length > 8 ? `${troveId.substring(0, 8)}…` : troveId;

  return {
    title: `Liquity V2 ${collateralDisplay}/BOLD Trove ${truncatedTroveId}`,
    description: `View detailed transaction timeline and analytics for Liquity V2 Trove ${troveId} with ${collateralDisplay} collateral. Track operations, interest rates, and collateral ratios.`,
    openGraph: {
      title: `Liquity V2 ${collateralDisplay}/BOLD Trove ${truncatedTroveId}`,
      description: `View detailed transaction timeline and analytics for Trove ${troveId} with ${collateralDisplay} collateral.`,
      url: `https://rails.finance/liquity-v2/trove/${collateralType}/${troveId}`,
      type: "website",
      // No trove-specific share image: reuse the Explore Liquity V2 card. This
      // must be set explicitly — a defined openGraph block shadows the parent's
      // images rather than merging them in.
      images: ["/og/explore-liquity-v2.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `Liquity V2 ${collateralDisplay}/BOLD ${truncatedTroveId}`,
      description: `View detailed transaction timeline and analytics for Trove ${troveId} with ${collateralDisplay} collateral.`,
      images: ["/og/explore-liquity-v2.png"],
    },
  };
}

export default function TroveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
