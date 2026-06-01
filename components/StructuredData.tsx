export function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Rails",
    applicationCategory: "FinanceApplication",
    description: "Dedicated, on-chain-verifiable explorers for DeFi protocols. Live now: Liquity V2 and Aave V4.",
    url: "https://rails.finance",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    provider: {
      "@type": "Organization",
      name: "Rails",
      url: "https://rails.finance",
      sameAs: ["https://x.com/rails_finance", "https://youtube.com/@rails_finance"],
    },
    featureList: [
      "Dedicated explorers for DeFi protocols",
      "On-chain-verifiable positions and balances",
      "Plain-language event timelines",
      "Liquity V2 trove coverage across WETH, wstETH, rETH",
      "Aave V4 multi-spoke lending coverage",
      "Real-time protocol statistics",
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />;
}
