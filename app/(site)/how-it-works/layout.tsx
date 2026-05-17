import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How Rails Works",
  description:
    "Rails is a platform that produces mono-rails — dedicated, read-only explorers, one per protocol. The truth principle, the wallet-as-session model, and what's under the hood.",
  openGraph: {
    title: "How Rails Works",
    description:
      "Rails is a platform that produces mono-rails — dedicated, read-only explorers, one per protocol.",
    url: "https://rails.finance/how-it-works",
  },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
