/**
 * Mono-rail showcase — ported from rails-explorer's umbrella with external
 * https://host links removed (rails-web-mig is itself a mono-rail; outbound
 * navigation to sibling subdomains is reserved for a later pass).
 *
 * Liquity V2 is the only card with an internal `href` (the new /liquity-v2
 * landing page); the others stay static placeholders until those mono-rails
 * exist as routes.
 */

import Link from "next/link";

type MonoRail = {
  id: string;
  label: string;
  tags: string[];
  desc: string;
  href?: string;
};

const MONO_RAILS: MonoRail[] = [
  {
    id: "liquity",
    label: "Liquity V2",
    tags: ["Borrow"],
    desc: "Borrow the BOLD stablecoin with user-set interest rates",
    href: "/liquity-v2",
  },
  {
    id: "aave-v4",
    label: "Aave V4",
    tags: ["Lend", "Borrow"],
    desc: "Multi-spoke lending with unified liquidity across asset classes",
  },
  {
    id: "llamalend",
    label: "LlamaLend V1",
    tags: ["Lend", "Borrow"],
    desc: "Curve CDP markets with band-based soft liquidation via LLAMMA",
  },
];

export function MonoRailSection() {
  return (
    <section className="bg-rb-200 dark:bg-rb-800">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="font-sans font-semibold tracking-tight leading-tight mb-3 text-[clamp(24px,3.5vw,38px)]">
            <span className="text-blue-500">Mono</span> Rails
          </h2>
          <p className="text-sm text-rb-500 max-w-xl mx-auto leading-relaxed">
            A mono-rail is Rails distilled to a single protocol — sponsor-branded,
            scoped, and free of cross-protocol noise.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MONO_RAILS.map((f) => (
            <MonoRailCard key={f.id} rail={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MonoRailCard({ rail }: { rail: MonoRail }) {
  const inner = (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/icons/protocols/${rail.id}.png`}
        alt=""
        width={64}
        height={64}
        style={{ borderRadius: "20%" }}
      />
      <div>
        <span className="text-2xl font-semibold">{rail.label}</span>
        <div className="flex gap-1 mt-1">
          {rail.tags.map((t) => (
            <span
              key={t}
              className="text-xs px-1.5 py-0.5 rounded bg-rb-100 dark:bg-rb-700"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const desc = (
    <p className="text-sm font-light text-rb-500 leading-relaxed flex-1">
      {rail.desc}
    </p>
  );

  if (rail.href) {
    return (
      <Link
        href={rail.href}
        className="p-5 flex flex-col gap-3 border border-transparent hover:border-blue-500/40 hover:bg-rb-100/40 dark:hover:bg-rb-700/40 rounded-3xl transition-colors"
      >
        {inner}
        {desc}
      </Link>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-3 border border-transparent rounded-3xl">
      {inner}
      {desc}
    </div>
  );
}
