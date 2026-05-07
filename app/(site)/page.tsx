"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Wallet, Code2, ShieldAlert, Lightbulb, Activity } from "lucide-react";
import { ProtocolStats } from "@/types/api/stats";
import { LiquityLogo } from "@/components/LiquityLogo";
import { CollateralBreakdown } from "@/components/stats/CollateralBreakdown";
import { HomeHero } from "@/components/home/home-hero";

export default function Home() {
  const [searchValue, setSearchValue] = useState("");
  const [liquityStats, setLiquityStats] = useState<ProtocolStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedValue = searchValue.trim();

    if (!trimmedValue) return;

    // Detect input type (same logic as TroveListFilters)
    const isTroveId = /^\d+$/.test(trimmedValue);
    const isEns = trimmedValue.toLowerCase().endsWith(".eth");
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmedValue);

    // Only navigate if input matches a valid pattern
    if (!isTroveId && !isAddress && !isEns) {
      return;
    }

    // Build URL params
    const params = new URLSearchParams();

    if (isTroveId) {
      params.set("troveId", trimmedValue);
    } else if (isAddress) {
      params.set("ownerAddress", trimmedValue);
    } else if (isEns) {
      params.set("ownerEns", trimmedValue);
    }

    router.push(`/troves?${params.toString()}`);
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/stats");
        const result = await response.json();
        if (result.success && result.data) {
          setLiquityStats(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="bg-rb-50 dark:bg-rb-950 text-foreground min-h-screen">
      <HomeHero />

      <div className="relative overflow-x-hidden pb-12 pt-8">
        <div className="relative z-10 w-full mx-auto px-4 max-w-7xl">
          <div className="md:flex gap-8">
            {/* Content Column continued */}
            <div>
              {/* Liquity V2 Protocol Card */}
              <div className="">
                <div className="bg-rb-100 dark:bg-rb-850 rounded-xl overflow-hidden">
                  <div className="p-4 space-y-6">

                    {/* Mobile: Stacked, Desktop: Two columns */}

                    <div className="flex flex-col md:flex-row md:gap-8 md:items-center">
                      <div className="text-foreground font-medium text-md leading-relaxed md:flex-1 flex flex-col mb-6 md:mb-0">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-2xl text-foreground font-extrabold">Explore</span>
                          <svg className="w-12 h-12" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <use href="#icon-liquity" />
                          </svg>
                          <span className="text-2xl text-foreground font-extrabold">Liquity V2</span>
                        </div>
                        <p className="text-rb-700 dark:text-rb-300">
                          Liquity V2 enables users to deposit ETH, wstETH, or rETH as collateral to mint BOLD stablecoins and set their own interest rates.
                        </p>
                      </div>

                      {/* Search Box - Mobile and Desktop */}
                      <div className="md:flex-1 bg-rb-50 dark:bg-rb-900 rounded-xl p-4 transition-shadow hover:shadow-sm">
                        <p className="text-foreground font-medium mb-3">
                          View a Liquity V2 Trove on Rails:
                        </p>
                        <form onSubmit={handleSearch}>
                          <div className="relative">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-rb-500"
                            >
                              <circle cx="11" cy="11" r="8" />
                              <path d="m21 21-4.3-4.3" />
                            </svg>
                            <input
                              type="text"
                              className="w-full pl-10 pr-4 py-2 text-sm bg-rb-100 dark:bg-rb-800 text-foreground border-2 border-blue-500 dark:border-blue-500 hover:border-rb-400 dark:hover:border-rb-500 focus:border-blue-500 dark:focus:border-white focus:outline-none transition-colors placeholder-rb-500 rounded-full"
                              value={searchValue}
                              onChange={(e) => setSearchValue(e.target.value)}
                            />
                          </div>
                          <p className="text-rb-500 text-xs mt-2">Enter borrower address, ENS, or Trove ID</p>
                        </form>
                      </div>
                    </div>
                    {/* Collateral Overview */}
                    <CollateralBreakdown
                      data={liquityStats?.byCollateral || {}}
                      mode="overview"
                      loading={statsLoading}
                    />

                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="w-full pb-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="font-sans font-semibold tracking-tight leading-tight text-center text-[clamp(24px,3.5vw,38px)]">
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
      </section>

      {/* Get in touch — founding supporter */}
      <div className="bg-rb-200 dark:bg-rb-800">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <h2 className="font-semibold tracking-tight leading-tight pb-4 text-[clamp(28px,4vw,42px)] text-foreground">
            Get in touch
          </h2>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
            {/* Left: founding-supporter voice + Liquity logo */}
            <div className="md:text-left flex flex-col md:items-start flex-1">
              <p className="leading-relaxed max-w-xl mb-8 text-foreground">
                Working with a protocol team or building DeFi infrastructure?
                We partner with sponsors on <span className="font-bold">integrations</span> for the
                umbrella explorer and dedicated <span className="font-bold">custom explorers</span> —
                mono-rail subdomains scoped to a single protocol, with the same depth as the umbrella.
                {" "}<span className="text-blue-500 font-semibold">Liquity</span> is our founding supporter.
              </p>
              <a href="https://liquity.org" target="_blank" rel="noopener noreferrer" className="block mb-2">
                <LiquityLogo />
              </a>
            </div>

            {/* Right: CTAs to existing site pages */}
            <div className="flex flex-col gap-3 shrink-0">
              <a
                href="/about"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-150"
              >
                <Lightbulb className="h-5 w-5" />
                Learn about Rails
              </a>
              <a
                href="/pulse"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors duration-150"
              >
                <Activity className="h-5 w-5" />
                Check our Pulse
              </a>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
