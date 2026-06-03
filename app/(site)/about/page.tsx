import { LiquityLogo } from "@/components/LiquityLogo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Rails",
  description:
    "Rails builds dedicated, read-only explorers for DeFi protocols — one protocol at a time. Built by a two-person team with support from Liquity. The team, the roadmap, the supporters.",
  openGraph: {
    title: "About Rails",
    description: "Dedicated explorers for DeFi protocols. The team, the roadmap, the supporters.",
    url: "https://rails.finance/about",
  },
};

/** Roadmap stages. Live integrations (Liquity V2, Aave V4) carry a coloured
 *  border; planned stages are quiet. Aave V4 is badged NEW — it's the most
 *  recent rail to ship. Class strings are literal so Tailwind keeps them. */
const ROADMAP = [
  {
    n: 1,
    title: "Liquity V2 Support",
    status: "Completed",
    body: "Full coverage of Liquity V2 — trove tracking across WETH, wstETH, and rETH, batch-manager attribution, event timelines, and per-trove economics.",
    circle: "bg-green-500",
    card: "border-2 border-green-600",
    badge: "bg-green-600 text-green-50",
  },
  {
    n: 2,
    title: "Aave V4 Support",
    status: "New",
    body: "Multi-spoke lending coverage — per-spoke health factor, liquidation price, and rate exposure, all read from current on-chain state.",
    circle: "bg-blue-500",
    card: "border-2 border-blue-600",
    badge: "bg-blue-600 text-white",
  },
  {
    n: 3,
    title: "Multi-Protocol Intelligence",
    status: "Planned",
    body: "More protocols, each with its own dedicated explorer — Morpho, Compound, Sky, the Liquity V2 forks, and beyond. Rails grows one rail at a time.",
    circle: "bg-violet-500",
    card: "border border-rb-300 dark:border-rb-800",
    badge: "bg-rb-300 text-rb-700 dark:bg-rb-800 dark:text-rb-200",
  },
  {
    n: 4,
    title: "Modularisation",
    status: "Planned",
    body: "Rails evolves into portable, composable surfaces — event cards, position cards, timelines — that protocol teams can embed directly into their own UIs.",
    circle: "bg-orange-400",
    card: "border border-rb-300 dark:border-rb-800",
    badge: "bg-rb-300 text-rb-700 dark:bg-rb-800 dark:text-rb-200",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Lead */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pt-32 pb-14">
        <p className="text-xl leading-relaxed text-foreground max-w-3xl">
          DeFi is too complex for most people to navigate confidently. The information is on-chain, but it's not
          legible. <span className="font-bold">Rails</span> builds dedicated, read-only explorers for DeFi protocols —
          one protocol at a time — that translate on-chain activity into clear, verifiable timelines, positions, and
          event detail. No wallet connection, no account, no permission.
        </p>
      </section>

      {/* Roadmap — its own background band, echoing the home feature spotlight */}
      <div className="bg-gradient-to-b from-rb-100 to-rb-200 dark:from-rb-900 dark:to-rb-800">
        <section className="max-w-7xl mx-auto px-4 md:px-6 py-16">
          <h2 className="font-sans font-semibold tracking-tight leading-tight text-[clamp(26px,3.5vw,40px)] text-foreground mb-3">
            The definitive DeFi support platform
          </h2>
          <p className="text-lg leading-relaxed text-foreground max-w-2xl mb-10">
            <span className="font-bold">Our mission</span> is to make DeFi more understandable and accessible for
            everyone — one dedicated, sponsor-anchored explorer at a time.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            {ROADMAP.map((c) => (
              <div key={c.n} className={`rounded-xl bg-rb-50 dark:bg-rb-950 p-6 flex flex-col ${c.card}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-white font-bold ${c.circle}`}
                    >
                      {c.n}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{c.title}</h3>
                  </div>
                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded ${c.badge}`}>{c.status}</span>
                </div>
                <p className="text-sm leading-relaxed text-rb-500">{c.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-16">
        {/* Team Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-semibold mb-6 text-foreground">Team</h2>

          {/* Miles */}
          <div className="grid md:grid-cols-2 gap-8  mb-8">
            <div className="bg-rb-100 dark:bg-rb-800 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <img
                  src="/about-team-milesessex.jpg"
                  alt="Miles"
                  className="w-16 h-16 rounded-full mr-4 object-cover"
                />
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Miles</h3>
                  <p className="text-rb-500">Designer</p>
                  <a
                    href="https://x.com/milesessex"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    @milesessex
                  </a>
                </div>
              </div>
              <p className="text-foreground">
                Graphic UX designer with 20+ years experience. Focused on creating intuitive interfaces for complex
                financial data.
              </p>
            </div>
            {/* Slava */}
            <div className="bg-rb-100 dark:bg-rb-800 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <img src="/about-team-slvdev.jpg" alt="Slava" className="w-16 h-16 rounded-full mr-4 object-cover" />
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Slava</h3>
                  <p className="text-rb-500">Developer</p>
                  <a
                    href="https://x.com/slvdev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    @slvdev
                  </a>
                </div>
              </div>
              <p className="text-foreground">
                Web3 developer with expertise in Rust and Solidity. Focused on building infrastructure that makes DeFi
                protocols accessible and understandable.
              </p>
            </div>
          </div>
        </div>

        {/* Supporters Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-semibold mb-6 text-foreground">Our Supporters</h2>
          <div className="bg-rb-100 dark:bg-rb-800 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-1">
                <div className="flex items-center mb-4 h-full">
                  <a href="https://liquity.org" target="_blank" rel="noopener noreferrer" className="h-full">
                    <LiquityLogo className="h-full w-auto" />
                  </a>
                </div>
                <p className="text-foreground mb-3">
                  Liquity has been instrumental in getting Rails off the ground, providing a grant to kickstart our
                  development. Their support enables us to build critical infrastructure for the Liquity ecosystem and
                  beyond. Thank you to Liquity!
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Contact Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-semibold mb-6 text-foreground">Connect With Us</h2>

          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="bg-rb-100 dark:bg-rb-800 rounded-lg p-6 shadow hover:lg:shadow-lg">
              <h3 className="text-xl font-semibold text-foreground mb-4">General Inquiries</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 text-rb-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <a
                    href="https://x.com/rails_finance"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    target="_blank"
                  >
                    @rails_finance
                  </a>
                </div>
                <p className="text-rb-500 text-sm">
                  We'd love to hear from you! Whether you have questions, feedback, or just want to say hello.
                </p>
              </div>
            </div>

            <div className="bg-rb-100 dark:bg-rb-800 rounded-lg p-6 shadow hover:lg:shadow-lg">
              <h3 className="text-xl font-semibold text-foreground mb-4">Our code</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 text-rb-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  <a
                    href="https://github.com/rails-finance"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    target="_blank"
                  >
                    GitHub
                  </a>
                </div>
                <p className="text-rb-500 text-sm">Help us continue building tools for the DeFi community</p>
              </div>
            </div>

            <div className="bg-fuchsia-400 dark:bg-fuchsia-500 rounded-lg p-6 shadow hover:lg:shadow-lg">
              <h3 className="text-xl font-extrabold text-white mb-4">Support Rails</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <a
                    href="https://etherscan.io/name-lookup-search?id=donate.rails.eth"
                    className=" rounded-full bg-fuchsia-600 dark:bg-fuchsia-700 hover:bg-fuchsia-700/50 dark:hover:bg-fuchsia-800/50 transition-all duration-300 p-2 px-4 text-3xl font-extrabold text-white  hover:text-white"
                    target="_blank"
                  >
                    donate<span className="hidden lg:inline">.rails.eth</span>
                  </a>
                </div>
                <p className="text-white ">
                  Help us continue building tools for the DeFi community{" "}
                  <span className="lg:hidden">
                    by donating to <span className="underline font-extrabold">donate.rails.eth</span>
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
