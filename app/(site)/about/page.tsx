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

/* Shared type scale — kept literal so Tailwind never tree-shakes the classes,
 * and so every section pulls from the same small set instead of re-inventing
 * sizes/weights/colours per block.
 *   H2   — section heading
 *   H3   — sub-heading / card title
 *   LEAD — intro / framing paragraph (one notch up from body)
 *   LINK — inline text link
 * Body copy uses the global `.body-text` utility (see globals.css). */
const H2 = "text-3xl font-semibold tracking-tight text-foreground";
const H3 = "text-lg font-semibold text-foreground";
const LEAD = "text-base md:text-lg font-normal leading-relaxed text-rb-500";
const LINK = "text-blue-500 hover:text-blue-600 transition-colors";

/** Roadmap stages, rendered as a vertical timeline. Live integrations (Liquity
 *  V2, Aave V4) carry a coloured node; planned stages stay quiet. Class strings
 *  are literal so Tailwind keeps them. */
const ROADMAP = [
  {
    n: 1,
    title: "Liquity V2 Support",
    status: "Completed",
    body: "Full coverage of Liquity V2 — trove tracking across WETH, wstETH, and rETH, batch-manager attribution, event timelines, and per-trove economics.",
    circle: "bg-green-500",
    badge: "bg-green-600 text-green-50",
  },
  {
    n: 2,
    title: "Aave V4 Support",
    status: "New",
    body: "Multi-spoke lending coverage — per-spoke health factor, liquidation price, and rate exposure, all read from current on-chain state.",
    circle: "bg-blue-500",
    badge: "bg-teal-600 text-white",
  },
  {
    n: 3,
    title: "Multi-Protocol Intelligence",
    status: "Planned",
    body: "More protocols, each with its own dedicated explorer — Morpho, Compound, Sky, the Liquity V2 forks, and beyond. Rails grows one rail at a time.",
    circle: "bg-violet-500",
    badge: "bg-rb-300 text-rb-700 dark:bg-rb-800 dark:text-rb-200",
  },
  {
    n: 4,
    title: "Modularisation",
    status: "Planned",
    body: "Rails evolves into portable, composable surfaces — event cards, position cards, timelines — that protocol teams can embed directly into their own UIs.",
    circle: "bg-orange-400",
    badge: "bg-rb-300 text-rb-700 dark:bg-rb-800 dark:text-rb-200",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Lead */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pt-32 pb-14">
        <h1 className="font-sans font-semibold tracking-tight leading-tight text-foreground text-[clamp(28px,4.5vw,48px)] md:whitespace-nowrap">
          Dedicated, read-only explorers for DeFi
        </h1>
      </section>

      {/* Roadmap — its own background band, echoing the home feature spotlight.
          Two columns on desktop: a narrow intro/CTA rail beside the timeline. */}
      <div className="bg-gradient-to-b from-rb-100 to-rb-200 dark:from-rb-900 dark:to-rb-800">
        <section className="max-w-7xl mx-auto px-4 md:px-6 py-16">
          <div className="grid gap-10 md:grid-cols-3 md:gap-16">
            {/* Intro rail */}
            <div className="md:col-span-1 self-start">
              <h2 className={`${H2} mb-4`}>The definitive DeFi support platform</h2>
              <p className={`${LEAD} mb-4`}>
                DeFi is too complex to navigate confidently — the data is on-chain, but it isn't legible. Rails
                translates that activity into clear, verifiable timelines, positions, and event detail, with no wallet
                connection, account, or permission.
              </p>
              <p className={LEAD}>
                Our mission is to make DeFi understandable and accessible for everyone — one dedicated, sponsor-anchored
                explorer at a time.
              </p>
            </div>

            {/* Timeline */}
            <ol className="md:col-span-2">
              {ROADMAP.map((c, i) => {
                const isLast = i === ROADMAP.length - 1;
                return (
                  <li key={c.n} className="flex gap-4 sm:gap-6">
                    {/* Spine: numbered node + connector down to the next stage */}
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className={`z-10 flex h-9 w-9 items-center justify-center rounded-full text-white font-bold ${c.circle}`}
                      >
                        {c.n}
                      </div>
                      {!isLast && <div className="mt-1 w-px flex-1 bg-rb-300 dark:bg-rb-700" />}
                    </div>

                    {/* Content */}
                    <div className={isLast ? "pt-1" : "pt-1 pb-8"}>
                      <div className="flex items-center gap-3 mb-1.5">
                        <h3 className={H3}>{c.title}</h3>
                        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded ${c.badge}`}>{c.status}</span>
                      </div>
                      <p className="body-text">{c.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-16">
        {/* Team Section */}
        <div className="mb-12">
          <h2 className={`${H2} mb-6`}>Team</h2>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Miles */}
            <div className="bg-raised rounded-lg p-6">
              <div className="flex items-center mb-4">
                <img
                  src="/about-team-milesessex.jpg"
                  alt="Miles"
                  className="w-16 h-16 rounded-full mr-4 object-cover"
                />
                <div>
                  <h3 className={H3}>Miles</h3>
                  <p className="body-text">Designer</p>
                  <a href="https://x.com/milesessex" target="_blank" rel="noopener noreferrer" className={LINK}>
                    @milesessex
                  </a>
                </div>
              </div>
              <p className="body-text">
                Graphic UX designer with 20+ years experience. Focused on creating intuitive interfaces for complex
                financial data.
              </p>
            </div>
            {/* Slava */}
            <div className="bg-raised rounded-lg p-6">
              <div className="flex items-center mb-4">
                <img src="/about-team-slvdev.jpg" alt="Slava" className="w-16 h-16 rounded-full mr-4 object-cover" />
                <div>
                  <h3 className={H3}>Slava</h3>
                  <p className="body-text">Developer</p>
                  <a href="https://x.com/slvdev" target="_blank" rel="noopener noreferrer" className={LINK}>
                    @slvdev
                  </a>
                </div>
              </div>
              <p className="body-text">
                Web3 developer with expertise in Rust and Solidity. Focused on building infrastructure that makes DeFi
                protocols accessible and understandable.
              </p>
            </div>
          </div>
        </div>

        {/* Supporters Section */}
        <div className="mb-12">
          <h2 className={`${H2} mb-6`}>Our Supporters</h2>
          <div className="bg-raised rounded-lg p-6">
            <div className="mb-4">
              <a href="https://liquity.org" target="_blank" rel="noopener noreferrer" aria-label="Liquity">
                <LiquityLogo className="h-9 w-auto" />
              </a>
            </div>
            <p className="body-text">
              Liquity has been instrumental in getting Rails off the ground, providing a grant to kickstart our
              development. Their support enables us to build critical infrastructure for the Liquity ecosystem and
              beyond. Thank you to Liquity!
            </p>
          </div>
        </div>

        {/* Contact Section */}
        <div className="mb-12">
          <h2 className={`${H2} mb-6`}>Connect With Us</h2>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-raised rounded-lg p-6 shadow hover:lg:shadow-lg">
              <h3 className={`${H3} mb-4`}>General Inquiries</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-3 text-rb-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                  <a href="https://t.me/railsfinance" className={LINK} target="_blank" rel="noopener noreferrer">
                    railsfinance
                  </a>
                </div>
                <p className="body-text">
                  We'd love to hear from you! Whether you have questions, feedback, or just want to say hello.
                </p>
              </div>
            </div>

            <div className="bg-fuchsia-400 dark:bg-fuchsia-500 rounded-lg p-6 shadow hover:lg:shadow-lg">
              <h3 className="text-lg font-semibold text-white mb-4">Support Rails</h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <a
                    href="https://etherscan.io/name-lookup-search?id=donate.rails.eth"
                    className="rounded-full bg-fuchsia-600 dark:bg-fuchsia-700 hover:bg-fuchsia-700/50 dark:hover:bg-fuchsia-800/50 transition-all duration-300 p-2 px-4 text-2xl font-extrabold text-white"
                    target="_blank"
                  >
                    donate<span className="hidden lg:inline">.rails.eth</span>
                  </a>
                </div>
                <p className="text-sm font-normal leading-relaxed text-white">
                  Help us continue building tools for the DeFi community{" "}
                  <span className="lg:hidden">
                    by donating to <span className="underline font-semibold">donate.rails.eth</span>
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
