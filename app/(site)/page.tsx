"use client";

import { GraduationCap, Wallet, Code2, ShieldAlert } from "lucide-react";
import { HomeHero } from "@/components/home/home-hero";
import { FeatureSpotlight } from "@/components/home/feature-spotlight";
import { MonoRailSection } from "@/components/home/mono-rail-section";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* ═══ HERO ═══ */}
      <HomeHero />

      {/* ═══ THE RAILS — promoted to the lead position; each rail is the
          product, not a flavour of an umbrella. ═══ */}
      <MonoRailSection />

      {/* ═══ FEATURE SPOTLIGHT — Position card + Economics + Timeline ═══ */}
      <div className="bg-raised overflow-hidden">
        <section className="max-w-7xl mx-auto px-4 py-4">
          <FeatureSpotlight />
        </section>
      </div>

      {/* ═══ WHO IS RAILS FOR ═══ */}
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="mb-6">
            <h2 className="font-sans font-semibold tracking-tight leading-tight mb-10 text-[clamp(24px,3.5vw,38px)]">
              <span className="text-pink-500">DeFi</span> for everyone
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-5">
                <GraduationCap className="h-[18px] w-[18px] text-pink-500 shrink-0" aria-hidden="true" />
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-pink-500">The DeFi Curious</p>
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight leading-snug mb-3.5 text-foreground">
                Learn by example
              </h3>
              <p className="body-text flex-1 mb-6">
                Browse real protocol activity to see how DeFi works in practice. No capital required — just explore the
                ecosystem, follow live events, and build your intuition before you commit.
              </p>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-5">
                <Wallet className="h-[18px] w-[18px] text-emerald-500 shrink-0" aria-hidden="true" />
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-emerald-500">The Active DeFi User</p>
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight leading-snug mb-3.5 text-foreground">
                Stay on top of positions
              </h3>
              <p className="body-text flex-1 mb-6">
                Monitor collateral ratios, redemption exposure, yield earned, and liquidation risk — all translated into
                plain language. Know exactly where you stand, without reading a transaction trace.
              </p>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-5">
                <Code2 className="h-[18px] w-[18px] text-blue-500 shrink-0" aria-hidden="true" />
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-blue-500">DeFi Teams</p>
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight leading-snug mb-3.5 text-foreground">
                Support your community
              </h3>
              <p className="body-text flex-1 mb-6">
                Give your users a dedicated, verifiable window into their positions. A Rails integration means your
                protocol gets full coverage — and your community gets answers, not confusion.
              </p>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-5">
                <ShieldAlert className="h-[18px] w-[18px] text-red-500 shrink-0" aria-hidden="true" />
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-red-500">Crisis Support</p>
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight leading-snug mb-3.5 text-foreground">
                When frontends fail
              </h3>
              <p className="body-text flex-1 mb-6">
                DNS hijacks. Frontend outages. Contract exploits. When your usual interface goes dark, Rails gives you
                read-only access to your positions — no wallet connection, no permissions, no exposure.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ GET IN TOUCH ═══ */}
      <GetInTouch />
    </div>
  );
}

/** Founding-supporter voice + Telegram QR — ported verbatim from the
 *  rails-explorer umbrella, with the LiquityLogo source pointed at the
 *  rails-web-mig component (which renders the same mark + wordmark). */
function GetInTouch() {
  return (
    <div className="bg-raised">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="font-semibold tracking-tight leading-tight pb-4 text-[clamp(28px,4vw,42px)]">Get in touch</h2>

        <div className="flex flex-col md:flex-row items-start justify-between gap-10">
          <div className="flex flex-col flex-1">
            <p className="text-base md:text-lg font-normal leading-relaxed text-rb-500 max-w-md">
              Working with a protocol team or building DeFi infrastructure? Rails partners with sponsors to launch{" "}
              <span className="font-bold">dedicated explorers</span> — with the activity, position, and event detail
              your community can verify on-chain.
            </p>
            <p className="body-text max-w-md mt-4">
              Contact us on Telegram at{" "}
              <a
                href="https://t.me/railsfinance"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-500 hover:text-pink-600 transition-colors"
              >
                railsfinance
              </a>
              .
            </p>
          </div>

          <div className="flex shrink-0 md:-mt-16">
            <div
              className="relative overflow-hidden rounded-2xl w-[280px] sm:w-[300px]"
              style={{
                background: "linear-gradient(135deg, #0c1a3a 0%, #0a1228 100%)",
                height: 340,
                boxShadow: "0 20px 50px rgba(0,0,0,0.35), 0 0 80px rgba(59,130,246,0.06)",
              }}
            >
              <div className="absolute top-4 left-5 flex items-center gap-0.5 text-blue-400/30">
                <svg width="28" height="28" viewBox="0 0 200 200" fill="none">
                  <path
                    fill="currentColor"
                    d="M79.763 159.671L111.637 159.671L52.168 41.625L20.295 41.625L79.763 159.671Z"
                  />
                  <path
                    fill="currentColor"
                    d="M98.578 97.056L130.451 97.056L105.044 47.853L73.171 47.853L98.578 97.056Z"
                  />
                  <path
                    fill="currentColor"
                    d="M148.892 142.388L180.766 142.388L155.359 93.185L123.486 93.185L148.892 142.388Z"
                  />
                </svg>
                <span className="font-sans font-semibold tracking-wide text-blue-400/30">Rails</span>
              </div>
              <span className="absolute top-5 right-5 font-sans text-[13px] font-bold tracking-[0.3em] uppercase text-blue-400/30">
                Telegram
              </span>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 pt-4"
                style={{ color: "#cbd5e1" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/telegram-qr.svg"
                  alt="Rails Finance Telegram QR"
                  width={200}
                  height={200}
                  className="invert"
                />
                <a
                  href="https://t.me/railsfinance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-pink-400 hover:text-pink-500 items-center gap-1.5 text-xs font-medium transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                  railsfinance
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
