/**
 * Feature spotlight — the product tour of "what Rails actually is", in the
 * order a user moves through it: see a position's summary (Position card),
 * check its risk (Economics), read its history (Timeline). Truth principle:
 * every illustrated value is current-state and on-chain-verifiable — no
 * estimates, no hypotheticals.
 *
 * Each `slide` keys an abstract skeleton illustration (FeatureSkeleton in
 * ./feature-skeletons) rather than a screenshot — a no-numbers representation
 * of that view's *shape*. Theme-agnostic (rb-* tokens), crisp at any size, and
 * never goes stale when the real UI changes.
 *
 * Copy is ownership-neutral ("a position", never "your") — Rails is an explorer;
 * most views are of someone else's wallet, not the reader's own.
 *
 * Presentation: the three views are a slider — one slide at a time, navigated
 * by the indicator pills below — so the tour reads as three framed moments
 * rather than a long vertical stack. The pills are teal (color-grammar §4c:
 * teal = utility / in-place interaction — they switch the slide in place, they
 * don't navigate).
 */

"use client";

import { useState } from "react";
import { FeatureSkeleton } from "./feature-skeletons";

const FEATURES = [
  {
    name: "Position status",
    heading: "A position's status, at a glance",
    description:
      "Supply, debt, health factor, liquidation price, and net interest earned — one card, computed from current on-chain state.",
    slide: "position-card",
  },
  {
    name: "Economics",
    heading: "The economics, visualised",
    description:
      "Lifetime flows — peak supply and debt, interest paid and earned, and rate exposure — every figure traceable to on-chain events. No estimates, no hypotheticals.",
    slide: "economics",
  },
  {
    name: "History",
    heading: "The full history, event by event",
    description: "A chronological feed of every event, with asset flow and plain-language context.",
    slide: "timeline",
  },
] as const;

export function FeatureSpotlight() {
  const [active, setActive] = useState(0);

  return (
    <div>
      {/* Slider viewport: one slide wide, the track slides by whole slides. */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {FEATURES.map((f) => (
            <div key={f.name} className="w-full shrink-0">
              <FeatureCard {...f} />
            </div>
          ))}
        </div>
      </div>

      {/* Indicator pills — also the control; the active pill stretches out and
          fills teal (color-grammar §4c). Wide hit targets, not hairline dots. */}
      <div className="flex justify-center gap-2.5 pt-2 pb-4">
        {FEATURES.map((f, i) => (
          <button
            key={f.name}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Show ${f.name}`}
            aria-current={i === active}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              i === active
                ? "w-10 bg-teal-500 dark:bg-teal-400"
                : "w-5 bg-teal-500/25 hover:bg-teal-500/50 dark:bg-teal-400/25 dark:hover:bg-teal-400/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

type FeatureCardProps = {
  heading: string;
  name: string;
  description: string;
  slide: string;
};

function FeatureCard({ heading, name, description, slide }: FeatureCardProps) {
  const label = `${heading} — ${name} view in Rails`;
  return (
    <div className="relative">
      <div className="relative grid grid-cols-1 md:grid-cols-2 md:items-center">
        <div className="relative flex flex-col px-0 py-6 sm:px-0 sm:py-6 md:justify-center md:py-8 md:pr-8">
          <span className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] marketing">{name}</span>
          <h3 className="font-sans text-[37px] font-semibold leading-tight tracking-tight mb-4">{heading}</h3>
          <p className="body-text">{description}</p>
        </div>

        <div className="relative flex items-center justify-center py-6 md:py-8">
          {/* Abstract skeleton stand-in for the real view — see header note. */}
          <div className="w-full max-w-[600px] aspect-[12/5]">
            <FeatureSkeleton slide={slide} label={label} />
          </div>
        </div>
      </div>
    </div>
  );
}
