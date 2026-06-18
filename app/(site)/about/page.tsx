import { LiquityLogo } from "@/components/LiquityLogo";
import { Check } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Rails",
  description:
    "Rails builds dedicated, read-only explorers for DeFi protocols. Built by a two-person team with support from Liquity. The team, the roadmap, the supporters.",
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
const LINK = "text-pink-500 hover:text-pink-600 transition-colors";

/** Roadmap stages, rendered as a vertical timeline. Shipped stages (Liquity V2,
 *  Aave V4) carry a tick; the planned stage is an empty grey node. Class
 *  strings are literal so Tailwind keeps them. */
const ROADMAP = [
  {
    n: 1,
    title: "Liquity V2 Explorer",
    body: "Full coverage of Liquity V2 — trove tracking across WETH, wstETH, and rETH, batch-manager attribution, event timelines, and per-trove economics.",
    circle: "bg-green-500",
    tick: true,
  },
  {
    n: 2,
    title: "Aave V4 Explorer",
    body: "Multi-spoke lending coverage — per-spoke health factor, liquidation price, and rate exposure, all read from current on-chain state.",
    circle: "bg-green-500",
    tick: true,
  },
  {
    n: 3,
    title: "Multi-Protocol Explorers",
    body: "More protocols, each with its own dedicated explorer — expanding across the bluechip DeFi ecosystem and beyond.",
    circle: "bg-rb-500",
    tick: true,
    tickClass: "text-green-300/60",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Lead */}
      <section className="max-w-3xl mx-auto px-4 md:px-6 pt-32 pb-14">
        <h1 className="font-sans font-semibold tracking-tight leading-tight text-foreground text-[clamp(28px,4.5vw,48px)]">
          Dedicated, read-only explorers for DeFi support
        </h1>
      </section>

      {/* Roadmap — its own background band, echoing the home feature spotlight.
          Two columns on desktop: a narrow intro/CTA rail beside the timeline. */}
      <div className="bg-gradient-to-b from-rb-100 to-rb-200 dark:from-rb-900 dark:to-rb-800">
        <section className="max-w-3xl mx-auto px-4 md:px-6 py-16">
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            {/* Intro rail */}
            <div className="self-start">
              <p className={`${LEAD} mb-4`}>
                We believe that decentralised finance (DeFi) represents the future of finance, but it's currently too
                complex for most users to understand and navigate safely. <span className="font-semibold">Rails</span>{" "}
                provides clear, intuitive explanations
                of DeFi transactions and protocol events, empowering users with self-service support that keeps them
                informed and confident in their DeFi activity.
              </p>
            </div>

            {/* Timeline */}
            <ol>
              {ROADMAP.map((c, i) => {
                const isLast = i === ROADMAP.length - 1;
                return (
                  <li key={c.n} className="flex gap-4 sm:gap-6">
                    {/* Spine: numbered node + connector down to the next stage */}
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        className={`z-10 flex h-9 w-9 items-center justify-center rounded-full text-white ${c.circle}`}
                      >
                        {c.tick && (
                          <Check
                            className={`h-5 w-5 ${"tickClass" in c ? c.tickClass : ""}`}
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      {!isLast && <div className="mt-1 w-px flex-1 bg-rb-300 dark:bg-rb-700" />}
                    </div>

                    {/* Content */}
                    <div className={isLast ? "pt-1" : "pt-1 pb-8"}>
                      <h3 className={`${H3} mb-1.5`}>{c.title}</h3>
                      <p className="body-text">{c.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-16">
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
      </div>
    </div>
  );
}
