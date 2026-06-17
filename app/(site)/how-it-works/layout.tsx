import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How Rails Works",
  description:
    "Rails is a specialized analytics platform that makes DeFi activity easy to understand. An overview of what Rails does and the Rails approach, plus the technical architecture behind it.",
  openGraph: {
    title: "How Rails Works",
    description: "Rails is a specialized analytics platform that makes DeFi activity easy to understand.",
    url: "https://rails.finance/how-it-works",
  },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
