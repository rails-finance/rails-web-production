"use client";

import { GraduationCap, Wallet, Code2, ShieldAlert } from "lucide-react";
import { LiquityLogo } from "@/components/LiquityLogo";
import { HomeHero } from "@/components/home/home-hero";
import { DemoSlider } from "@/components/home/demo-slider";
import { MonoRailSection } from "@/components/home/mono-rail-section";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* ═══ HERO ═══ */}
      <HomeHero />

      {/* ═══ THE RAILS — promoted to the lead position; each rail is the
          product, not a flavour of an umbrella. ═══ */}
      <MonoRailSection />

      {/* ═══ FEATURE SPOTLIGHT — Economics + Timeline ═══ */}
      <div className="bg-gradient-to-b from-rb-100 to-rb-200 dark:from-rb-900 dark:to-rb-800 overflow-hidden">
        <section className="max-w-7xl mx-auto px-4 py-4">
          <DemoSlider />
        </section>
      </div>

      {/* ═══ WHO IS RAILS FOR ═══ */}
      <div className="bg-rb-50 dark:bg-rb-900">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center mb-6">
            <h2 className="font-sans font-semibold tracking-tight leading-tight mb-10 text-center text-[clamp(24px,3.5vw,38px)]">
              <span className="text-pink-500">DeFi</span> for everyone
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-rb-300 dark:bg-rb-800 rounded-xl overflow-hidden">
            <div className="bg-rb-100/90 dark:bg-rb-950/90 p-8 flex flex-col hover:bg-rb-100 dark:hover:bg-rb-950 transition-colors">
              <div className="flex items-center gap-2 mb-5">
                <GraduationCap className="h-[18px] w-[18px] text-pink-500 shrink-0" aria-hidden="true" />
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-pink-500">The DeFi Curious</p>
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight leading-snug mb-3.5 text-foreground">Learn by example</h3>
              <p className="text-[13px] leading-relaxed font-light flex-1 mb-6">
                Browse real protocol activity to see how DeFi works in practice. No capital required — just explore the ecosystem, follow live events, and build your intuition before you commit.
              </p>
            </div>
            <div className="bg-rb-100/90 dark:bg-rb-950/90 p-8 flex flex-col hover:bg-rb-100 dark:hover:bg-rb-950 transition-colors">
              <div className="flex items-center gap-2 mb-5">
                <Wallet className="h-[18px] w-[18px] text-emerald-500 shrink-0" aria-hidden="true" />
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-emerald-500">The Active DeFi User</p>
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight leading-snug mb-3.5 text-foreground">Stay on top of positions</h3>
              <p className="text-[13px] leading-relaxed font-light flex-1 mb-6">
                Monitor collateral ratios, redemption exposure, yield earned, and liquidation risk — all translated into plain language. Know exactly where you stand, without reading a transaction trace.
              </p>
            </div>
            <div className="bg-rb-100/90 dark:bg-rb-950/90 p-8 flex flex-col hover:bg-rb-100 dark:hover:bg-rb-950 transition-colors">
              <div className="flex items-center gap-2 mb-5">
                <Code2 className="h-[18px] w-[18px] text-blue-500 shrink-0" aria-hidden="true" />
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-blue-500">DeFi Teams</p>
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight leading-snug mb-3.5 text-foreground">Support your community</h3>
              <p className="text-[13px] leading-relaxed font-light flex-1 mb-6">
                Give your users a dedicated, verifiable window into their positions. A Rails integration means your protocol gets full coverage — and your community gets answers, not confusion.
              </p>
            </div>
            <div className="bg-rb-100/90 dark:bg-rb-950/90 p-8 flex flex-col hover:bg-rb-100 dark:hover:bg-rb-950 transition-colors">
              <div className="flex items-center gap-2 mb-5">
                <ShieldAlert className="h-[18px] w-[18px] text-red-500 shrink-0" aria-hidden="true" />
                <p className="text-xs font-medium tracking-[0.12em] uppercase text-red-500">Crisis Support</p>
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight leading-snug mb-3.5 text-foreground">When frontends fail</h3>
              <p className="text-[13px] leading-relaxed font-light flex-1 mb-6">
                DNS hijacks. Frontend outages. Contract exploits. When your usual interface goes dark, Rails gives you read-only access to your positions — no wallet connection, no permissions, no exposure.
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
    <div className="bg-rb-200 dark:bg-rb-800">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="font-semibold tracking-tight leading-tight pb-4 text-[clamp(28px,4vw,42px)]">
          Get in touch
        </h2>

        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10">
          <div className="md:text-left flex flex-col md:items-start flex-1">
            <p className="leading-relaxed max-w-md mb-8">
              Working with a protocol team or building DeFi infrastructure?
              Rails partners with sponsors to launch <span className="font-bold">mono-rails</span> —
              dedicated explorers scoped to a single protocol, with the
              activity, position, and event depth a self-service support
              surface needs. <span className="text-blue-500">Liquity</span> is our founding supporter.
            </p>
            <div className="mb-8">
              <a href="https://liquity.org" target="_blank" rel="noopener noreferrer" className="block">
                <LiquityLogo />
              </a>
            </div>
          </div>

          <div className="flex items-end shrink-0 md:mb-[-64px]">
            <div
              className="relative rounded-2xl md:rounded-b-none overflow-hidden w-[280px] sm:w-[300px]"
              style={{
                background: "linear-gradient(135deg, #0c1a3a 0%, #0a1228 100%)",
                height: 340,
                boxShadow:
                  "0 -10px 40px rgba(0,0,0,0.4), 0 0 80px rgba(59,130,246,0.06)",
              }}
            >
              <div className="absolute top-4 left-5 flex items-center gap-0.5 text-blue-400/30">
                <svg width="28" height="28" viewBox="0 0 200 200" fill="none">
                  <path fill="currentColor" d="M79.763 159.671L111.637 159.671L52.168 41.625L20.295 41.625L79.763 159.671Z" />
                  <path fill="currentColor" d="M98.578 97.056L130.451 97.056L105.044 47.853L73.171 47.853L98.578 97.056Z" />
                  <path fill="currentColor" d="M148.892 142.388L180.766 142.388L155.359 93.185L123.486 93.185L148.892 142.388Z" />
                </svg>
                <span className="font-sans font-semibold tracking-wide text-blue-400/30">Rails</span>
              </div>
              <span className="absolute top-5 right-5 font-sans text-[13px] font-bold tracking-[0.3em] uppercase text-blue-400/30">
                Telegram
              </span>
              <svg
                className="absolute pointer-events-none"
                style={{ left: -80, top: -80, width: "120%", height: "120%" }}
                viewBox="0 0 300 340"
                fill="none"
              >
                <path
                  d="M150 30 L168 150 L290 170 L168 190 L150 310 L132 190 L10 170 L132 150 Z"
                  fill="#3B82F6"
                  fillOpacity="0.05"
                />
              </svg>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 pt-4"
                style={{ color: "#cbd5e1" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/telegram-qr.svg" alt="Rails Finance Telegram QR" width={200} height={200} />
                <a
                  href="https://t.me/railsfinance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex text-blue-400 hover:text-blue-500 items-center gap-1.5 text-xs font-medium transition-colors"
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
