import Link from "next/link";
import { LiquityLogo } from "@/components/LiquityLogo";
import { Check } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Rails",
  description:
    "Rails builds dedicated, read-only explorers for DeFi protocols. What Rails does, the approach behind it, the roadmap, the team, and the supporters.",
  openGraph: {
    title: "About Rails",
    description: "Dedicated explorers for DeFi protocols. What Rails does, the roadmap, the team, the supporters.",
    url: "https://rails.finance/about",
    images: ["/rails-og.png"],
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

/* Key Features — the at-a-glance capability list shown in its own section. */
const KEY_FEATURES = [
  "Real-time tracking of Liquity V2 troves and Aave V4 positions",
  "Rich transaction timelines with detailed explanations",
  "Ownership history and transfer tracking",
];

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
    body: "We're continuing to expand Rails across the bluechip DeFi ecosystem",
    circle: "bg-rb-500",
    tick: true,
    tickClass: "text-rb-100 dark:text-rb-800",
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

      {/* What Rails Does — gradient band, the prime explainer after the lead. */}
      <div className="bg-gradient-to-b from-rb-100 to-rb-200 dark:from-rb-900 dark:to-rb-800">
        <section className="max-w-3xl mx-auto px-4 md:px-6 py-16">
          <h2 className={`${H2} mb-4`}>What Rails Does</h2>
          <p className={`${LEAD} mb-4`}>
            We believe decentralised finance represents the future of finance, but it's currently too hard for most
            people to understand and navigate safely.
          </p>
          <p className={LEAD}>
            Rails is a specialised analytics platform that fixes that. Rails takes raw Ethereum L1 data from{" "}
            <Link href="/liquity-v2" className="text-blue-500 hover:underline transition-colors">
              Liquity V2
            </Link>{" "}
            and{" "}
            <Link href="/aave-v4" className="text-blue-500 hover:underline transition-colors">
              Aave V4
            </Link>{" "}
            and turns it into clear, plain-language explanations — self-service support that keeps you informed and
            confident in your DeFi activity.
          </p>
        </section>
      </div>

      {/* Key Features — at-a-glance capability list + a quiet path to the
          dev-facing architecture page. No background band. */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-16">
        <section>
          <h2 className={`${H2} mb-4`}>Key Features</h2>
          <ul className="space-y-2">
            {KEY_FEATURES.map((f) => (
              <li key={f} className={`${LEAD} flex gap-3`}>
                <span className="text-rb-500 shrink-0">·</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <p className="body-text mt-6">
            Curious how it's built?{" "}
            <Link href="/about/architecture" className="text-blue-500 hover:underline transition-colors">
              Read the technical architecture →
            </Link>
          </p>
        </section>
      </div>

      {/* Roadmap — its own background band, echoing the home feature spotlight.
          Two columns on desktop: a narrow intro/CTA rail beside the timeline. */}
      <div className="bg-gradient-to-b from-rb-100 to-rb-200 dark:from-rb-900 dark:to-rb-800">
        <section className="max-w-3xl mx-auto px-4 md:px-6 py-16">
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            {/* Intro rail */}
            <div className="self-start">
              <h2 className={`${H2} mb-3`}>Roadmap</h2>
              <p className={LEAD}>A short-term view of where Rails is headed next.</p>
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
