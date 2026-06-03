/**
 * Explorer directory — the home page's primary CTA grid. Rails builds a
 * dedicated explorer per protocol; each card here points at a live one.
 *
 * Each card links to the explorer's home (discovery listing) — never to a
 * specific wallet. Wallet "memory" lives in the protocol-page search input's
 * recent/pinned dropdown, not in the global chrome or home links.
 *
 * Wired explorers get an internal `href`; ones not yet built render as static
 * placeholders to signal what's queued without making a promise we can't
 * keep. When a third protocol comes online, add a card with its `href`.
 */

import Link from "next/link";

type MonoRail = {
  id: string;
  label: string;
  tags: string[];
  desc: string;
  href?: string;
  isNew?: boolean;
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
    href: "/aave-v4",
    isNew: true,
  },
];

export function MonoRailSection() {
  return (
    <section className="bg-rb-200 dark:bg-rb-800">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="font-sans font-semibold tracking-tight leading-tight mb-3 text-[clamp(24px,3.5vw,38px)]">
            Rails <span className="text-blue-500">Explorers</span>
          </h2>
          <p className="body-text max-w-xl mx-auto">
            Explore Liquity V2 and Aave V4 in granular detail with our dedicated explorers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MONO_RAILS.map((rail) => (
            <MonoRailCard key={rail.id} rail={rail} />
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
      <img src={`/icons/protocols/${rail.id}.png`} alt="" width={64} height={64} style={{ borderRadius: "20%" }} />
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold">{rail.label}</span>
          {rail.isNew && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-500 text-white">
              New
            </span>
          )}
        </div>
        <div className="flex gap-1 mt-1">
          {rail.tags.map((t) => (
            <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-rb-100 dark:bg-rb-700">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const desc = <p className="body-text flex-1">{rail.desc}</p>;

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
