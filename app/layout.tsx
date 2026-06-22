import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";
import { IconSymbols } from "@/components/icons/iconSymbols";
import { HeaderBar } from "@/components/nav/header-bar";
import { WalletContextProvider } from "@/components/nav/wallet-context";
import { ThemeScript } from "@/components/ThemeScript";
import { StructuredData } from "@/components/StructuredData";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  // `optional` skips the FOUT swap — first paint either has Inter (if it
  // arrived inside the 100ms block window) or the metric-adjusted fallback.
  display: "optional",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#12151E" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://rails.finance"),
  title: {
    default: "Rails - DeFi Protocol Explorers",
    template: "Rails | %s",
  },
  description:
    "Rails builds dedicated explorers for DeFi protocols — on-chain-verifiable positions, timelines, and event detail. Live now: Liquity V2 and Aave V4, with more bluechip protocols on the way.",
  keywords: [
    "DeFi",
    "Ethereum",
    "Liquity V2",
    "Aave V4",
    "Trove",
    "BOLD",
    "Stablecoin",
    "Transaction Analysis",
    "Lending Protocol",
    "Protocol Explorer",
  ],
  authors: [{ name: "Rails", url: "https://rails.finance" }],
  creator: "Rails",
  publisher: "Rails",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://rails.finance",
    title: "Rails - DeFi Protocol Explorers",
    description:
      "Dedicated explorers for DeFi protocols — on-chain-verifiable positions, timelines, and event detail. Live now: Liquity V2 and Aave V4.",
    siteName: "Rails",
    images: [
      {
        url: "/rails-og.png",
        width: 1200,
        height: 630,
        alt: "Rails - DeFi Protocol Explorers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rails - DeFi Protocol Explorers",
    description:
      "Dedicated explorers for DeFi protocols — on-chain-verifiable positions, timelines, and event detail. Live now: Liquity V2 and Aave V4.",
    images: ["/rails-og.png"],
    creator: "@rails_finance",
    site: "@rails_finance",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://rails.finance",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#12151E" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <ThemeScript />
        {/* Hero "already-seen" flag — flipped before first paint so CSS in
            globals.css can disable the home-hero animation on subsequent
            visits without a hydration flicker. Persists across tabs/sessions
            via localStorage so the animation plays once per browser, not
            once per tab. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('rails-hero-seen'))document.documentElement.dataset.heroSeen='1'}catch(e){}})()",
          }}
        />
        <StructuredData />
      </head>
      <body
        className={`${inter.className} ${inter.variable} antialiased bg-background text-foreground min-h-screen overflow-x-hidden min-w-[320px]`}
      >
        <IconSymbols />
        <Providers>
          <WalletContextProvider>
            <HeaderBar />
            {children}
          </WalletContextProvider>
        </Providers>
      </body>
    </html>
  );
}
