"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Home hero — ported from rails-explorer's umbrella HomeHero, adapted for the
 * single-protocol Liquity V2 surface. Animation runs once per session via the
 * `data-hero-seen` flag set on <html> by the inline blocking script in
 * app/layout.tsx (matching CSS in globals.css disables the keyframes once
 * flipped). Doing the gate purely in CSS keeps SSR markup identical to
 * post-hydration markup so there's no flicker.
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
        Explore <span className="text-blue-500">Liquity V2</span>
      </h1>
      <p
        className="relative font-sans font-light text-rb-500 tracking-tight mb-8 text-xl sm:text-2xl lg:text-3xl animate-hero-fade-up"
        style={{ animationDelay: "0.3s" }}
      >
        Trove activity on simple timelines.
      </p>

      {/* Search bar */}
      <div
        className="relative z-40 w-full max-w-lg mx-auto px-5 sm:px-0 animate-hero-fade-up"
        style={{ animationDelay: "0.4s" }}
      >
        <HeroSearchBar />
        <p className="text-[11px] text-rb-500 mt-2.5 text-center font-light">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="inline-block align-[-1px] mr-1"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m4.9 4.9 14.2 14.2" />
          </svg>
          Rails is read-only.
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="inline-block align-[-1px] mx-0.5"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          No wallet connection or login required.
        </p>
      </div>

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

/** Single-input search wired to the existing /troves filter behavior:
 *  Trove ID → ?troveId=, address → ?ownerAddress=, ENS → ?ownerEns=. */
function HeroSearchBar() {
  const [value, setValue] = useState("");
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    const isTroveId = /^\d+$/.test(trimmed);
    const isEns = trimmed.toLowerCase().endsWith(".eth");
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
    if (!isTroveId && !isAddress && !isEns) return;

    const params = new URLSearchParams();
    if (isTroveId) params.set("troveId", trimmed);
    else if (isAddress) params.set("ownerAddress", trimmed);
    else if (isEns) params.set("ownerEns", trimmed);

    router.push(`/troves?${params.toString()}`);
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-rb-500"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search address, ENS, or Trove ID…"
          className="w-full pl-11 pr-4 py-3 text-sm bg-rb-100 dark:bg-rb-900 text-foreground border border-rb-300 dark:border-rb-700 hover:border-rb-400 dark:hover:border-rb-600 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none transition-colors placeholder-rb-500 rounded-full"
          aria-label="Search address, ENS, or Trove ID"
        />
      </div>
    </form>
  );
}
