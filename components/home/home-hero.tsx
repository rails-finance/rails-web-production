"use client";

import { useEffect } from "react";

/**
 * Home hero — ported from rails-explorer's umbrella HomeHero, adapted for the
 * single-protocol Liquity V2 surface. Animation runs once per session via the
 * `data-hero-seen` flag set on <html> by the inline blocking script in
 * app/layout.tsx (matching CSS in globals.css disables the keyframes once
 * flipped). Doing the gate purely in CSS keeps SSR markup identical to
 * post-hydration markup so there's no flicker.
 *
 * The search + CTA previously rendered here moved out: the search now lives
 * on /liquity-v2 alongside the stats panel, and entry to the protocol
 * surface goes through the mono-rail card and the header app-switcher.
 */
export function HomeHero() {
  useEffect(() => {
    try {
      sessionStorage.setItem("rails-hero-seen", "1");
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <section className="flex flex-col items-center text-center pt-16 pb-0 overflow-hidden relative">
      <div className="absolute top-22 left-1/2 -translate-x-1/2 w-[500px] h-[220px] bg-blue-500/[0.07] rounded-full blur-[80px] pointer-events-none" />
      <h1
        className="relative font-semibold leading-none tracking-tighter mb-2 text-5xl sm:text-7xl lg:text-8xl animate-hero-fade-up"
        style={{ animationDelay: "0.2s" }}
      >
        Destination <span className="text-blue-500">DeFi</span>
      </h1>
      <p
        className="relative font-sans font-light text-rb-500 tracking-tight mb-2 text-xl sm:text-2xl lg:text-3xl animate-hero-fade-up"
        style={{ animationDelay: "0.3s" }}
      >
        Explore DeFi on Ethereum.
      </p>

      {/* Track lines graphic — inline retro stripes (verbatim from rails-explorer) */}
      <div className="w-full mt-8 -mb-4 h-[330px] overflow-hidden flex justify-center">
        <svg
          viewBox="0 0 1100 300"
          xmlns="http://www.w3.org/2000/svg"
          className="min-w-[1100px] h-auto"
          style={{
            maskImage:
              "linear-gradient(to bottom, black 0%, black 75%, transparent 100%), linear-gradient(to right, transparent 0%, black 260px, black calc(100% - 260px), transparent 100%)",
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
          }}
        >
          <defs>
            <clipPath id="green-right">
              <rect x="370" y="0" width="700" height="500" />
            </clipPath>
            <clipPath id="green-mirror-left">
              <rect x="0" y="0" width="640" height="500" />
            </clipPath>
          </defs>

          {/* Blue group */}
          {[0, 1, 2, 3, 4].map((i) => {
            const r = 60 + i * 12;
            const colors = ["#89C7F0", "#4FAEEA", "#4090D1", "#3270B8", "#2F56A8"];
            const d = `M0,${222 - r} L565,${222 - r} A${r},${r} 0 0,1 ${565 + r},222 L${565 + r},377`;
            return (
              <g key={`bg${i}`}>
                <path fill="none" strokeWidth="12" strokeLinecap="round" opacity="0.5" stroke="var(--background)" d={d} />
                <path fill="none" strokeWidth="7" strokeLinecap="round" opacity="0.5" stroke="var(--background)" d={d} />
                <path
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  stroke={colors[i]}
                  d={d}
                  pathLength="1"
                  className="hero-track-line"
                  style={{ ["--hero-line-delay" as string]: `${1.6 + i * 0.15}s` }}
                />
              </g>
            );
          })}

          {/* Green group (left leg) */}
          {[0, 1, 2, 3, 4].map((i) => {
            const r = 60 + i * 12;
            const colors = ["#D5E38D", "#C0D651", "#71A450", "#79A950", "#507D49"];
            const d = `M0,${432 - i * 12} L195,${432 - i * 12} A${110 - i * 12},${110 - i * 12} 0 0,0 ${365 - r},322 L${365 - r},297 A${r},${r} 0 0,1 365,${297 - r} L375,${297 - r} A${r},${r} 0 0,1 ${375 + r},297 L${375 + r},537`;
            return (
              <g key={`gg${i}`}>
                <path fill="none" strokeWidth="12" strokeLinecap="round" opacity="0.5" stroke="var(--background)" d={d} />
                <path fill="none" strokeWidth="7" strokeLinecap="round" opacity="0.5" stroke="var(--background)" d={d} />
                <path
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  stroke={colors[i]}
                  d={d}
                  pathLength="1"
                  className="hero-track-line"
                  style={{ ["--hero-line-delay" as string]: `${1.6 + i * 0.15}s` }}
                />
              </g>
            );
          })}

          {/* Green group (right leg, clipped, in front of blue) */}
          <g clipPath="url(#green-right)">
            {[0, 1, 2, 3, 4].map((i) => {
              const r = 60 + i * 12;
              const colors = ["#D5E38D", "#C0D651", "#71A450", "#79A950", "#507D49"];
              const d = `M0,${432 - i * 12} L195,${432 - i * 12} A${110 - i * 12},${110 - i * 12} 0 0,0 ${365 - r},322 L${365 - r},297 A${r},${r} 0 0,1 365,${297 - r} L375,${297 - r} A${r},${r} 0 0,1 ${375 + r},297 L${375 + r},537`;
              return (
                <g key={`grg${i}`}>
                  <path fill="none" strokeWidth="12" strokeLinecap="round" opacity="0.5" stroke="var(--background)" d={d} />
                  <path fill="none" strokeWidth="7" strokeLinecap="round" opacity="0.5" stroke="var(--background)" d={d} />
                  <path
                    fill="none"
                    strokeWidth="7"
                    strokeLinecap="round"
                    stroke={colors[i]}
                    d={d}
                    pathLength="1"
                    className="hero-track-line"
                    style={{ ["--hero-line-delay" as string]: `${1.6 + i * 0.15}s` }}
                  />
                </g>
              );
            })}
          </g>

          {/* Red mirrored group (right side) */}
          {[0, 1, 2, 3, 4].map((i) => {
            const r = 60 + i * 12;
            const colors = ["#F8D94C", "#EDC64A", "#E0773D", "#D64033", "#A72D22"];
            const d = `M1400,${252 - i * 12} L815,${252 - i * 12} A${110 - i * 12},${110 - i * 12} 0 0,1 ${645 + r},142 L${645 + r},117 A${r},${r} 0 0,0 645,${117 - r} L635,${117 - r} A${r},${r} 0 0,0 ${635 - r},117 L${635 - r},357`;
            return (
              <g key={`rmg${i}`}>
                <path fill="none" strokeWidth="12" strokeLinecap="round" opacity="0.5" stroke="var(--background)" d={d} />
                <path fill="none" strokeWidth="7" strokeLinecap="round" opacity="0.5" stroke="var(--background)" d={d} />
                <path
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  stroke={colors[i]}
                  d={d}
                  pathLength="1"
                  className="hero-track-line"
                  style={{ ["--hero-line-delay" as string]: `${i * 0.15}s` }}
                />
              </g>
            );
          })}

          {/* Red mirrored (left leg, clipped) */}
          <g clipPath="url(#green-mirror-left)">
            {[0, 1, 2, 3, 4].map((i) => {
              const r = 60 + i * 12;
              const colors = ["#F8D94C", "#EDC64A", "#E0773D", "#D64033", "#A72D22"];
              const d = `M1400,${252 - i * 12} L815,${252 - i * 12} A${110 - i * 12},${110 - i * 12} 0 0,1 ${645 + r},142 L${645 + r},117 A${r},${r} 0 0,0 645,${117 - r} L635,${117 - r} A${r},${r} 0 0,0 ${635 - r},117 L${635 - r},357`;
              return (
                <g key={`rmlg${i}`}>
                  <path fill="none" strokeWidth="12" strokeLinecap="round" opacity="0.5" stroke="var(--background)" d={d} />
                  <path fill="none" strokeWidth="7" strokeLinecap="round" opacity="0.5" stroke="var(--background)" d={d} />
                  <path
                    fill="none"
                    strokeWidth="7"
                    strokeLinecap="round"
                    stroke={colors[i]}
                    d={d}
                    pathLength="1"
                    className="hero-track-line"
                    style={{ ["--hero-line-delay" as string]: `${i * 0.15}s` }}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}
