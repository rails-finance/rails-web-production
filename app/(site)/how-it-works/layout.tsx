import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How Rails Works",
  description:
    "Rails builds dedicated, read-only explorers for DeFi protocols — one protocol at a time. The truth principle, the wallet-as-session model, and what's under the hood.",
  openGraph: {
    title: "How Rails Works",
    description: "Rails builds dedicated, read-only explorers for DeFi protocols — one protocol at a time.",
    url: "https://rails.finance/how-it-works",
  },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
