import { SlideAnimation } from "./slides";

/**
 * Flagship feature spotlight — Simulation + Timeline visuals. Ported from
 * rails-explorer; the 'View example' link is intentionally omitted because
 * rails-web-mig has no /address page yet (deferred).
 */

const FEATURES = [
  {
    heading: "Plan your journey",
    name: "Simulation",
    description:
      "Preview how a position behaves before you commit — stress-test scenarios and account for exactly where it stands.",
    slidePath: "/slides/slide-1-economics.svg",
  },
  {
    heading: "See where you've been",
    name: "Timeline",
    description:
      "A chronological feed of every event with asset flow and plain-language context.",
    slidePath: "/slides/slide-2-timeline.svg",
  },
] as const;

export function DemoSlider() {
  return (
    <div className="flex flex-col gap-12 md:gap-20">
      {FEATURES.map((f) => (
        <FeatureCard key={f.name} {...f} />
      ))}
    </div>
  );
}

type FeatureCardProps = {
  heading: string;
  name: string;
  description: string;
  slidePath: string;
};

function FeatureCard({ heading, name, description, slidePath }: FeatureCardProps) {
  return (
    <div className="relative">
      <div className="absolute hidden md:block rounded-tl-2xl pointer-events-none inset-y-0 left-1/2 -right-[9999px] bg-rb-100 dark:bg-rb-950 shadow-[-20px_50px_60px_10px_rgba(59,130,246,0.07)]" />
      <div className="relative grid grid-cols-1 md:grid-cols-2 md:items-center overflow-hidden">
        <div className="relative flex flex-col md:justify-center px-0 py-8 sm:py-8 sm:px-0 md:py-10 md:pr-8">
          <h3 className="font-sans text-[37px] font-semibold tracking-tight leading-tight mb-4">
            {heading} <span className="text-blue-500">— {name}</span>
          </h3>
          <p className="text-sm leading-relaxed font-light mb-5">{description}</p>

          <div
            className="mt-6 md:hidden overflow-hidden rounded-2xl"
            style={{ border: "1px solid rgba(255,255,255,0.04)" }}
          >
            <SlideAnimation slidePath={slidePath} />
          </div>
        </div>

        <div
          className="relative hidden md:flex items-center justify-center overflow-hidden"
          style={{ minHeight: 470 }}
        >
          <SlideAnimation slidePath={slidePath} />
        </div>
      </div>
    </div>
  );
}
