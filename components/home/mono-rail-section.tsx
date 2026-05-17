"use client";

/**
 * Mono-rail directory — the home page's primary CTA grid. Rails is a
 * platform that produces mono-rails; each card here points at a live rail.
 *
 * When a wallet is active in the header, each card's link carries the wallet
 * through: clicking "Aave V4" with 0xABC selected lands on /aave-v4/0xABC,
 * not /aave-v4 discovery. Mirrors ProtocolMenu — wallet behaves like a
 * session that follows you between rails.
 *
 * Wired rails get an internal `href`; rails not yet built render as static
 * placeholders to signal what's queued without making a promise we can't
 * keep. When a third protocol comes online, add a card with its `href`.
 */

import Link from "next/link";
import { useWalletContext } from "@/components/nav/wallet-context";

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
    href: "/aave-v4",
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
            The <span className="text-blue-500">Rails</span>
          </h2>
          <p className="text-sm text-rb-500 max-w-xl mx-auto leading-relaxed">
            Each rail is a dedicated explorer for one protocol — sponsor-anchored,
            on-chain-verifiable, and built around the events and positions that
            protocol's holders actually need to read.
          </p>
        </div>

        <MonoRailGrid />
      </div>
    </section>
  );
}

function MonoRailGrid() {
  const { addresses } = useWalletContext();
  const activeWallet = addresses[0]?.toLowerCase();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {MONO_RAILS.map((f) => (
        <MonoRailCard key={f.id} rail={f} activeWallet={activeWallet} />
      ))}
    </div>
  );
}

function MonoRailCard({ rail, activeWallet }: { rail: MonoRail; activeWallet?: string }) {
  const href = rail.href && activeWallet ? `${rail.href}/${activeWallet}` : rail.href;
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

  if (href) {
    return (
      <Link
        href={href}
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
