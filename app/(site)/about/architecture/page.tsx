import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Technical Architecture",
  description:
    "The multi-layer architecture behind Rails — Sieve indexer, RabbitMQ, processors and materialized views, the chain-truth refresher, and the API and frontend that serve it.",
  openGraph: {
    title: "Technical Architecture — Rails",
    description: "How Rails processes and serves blockchain data accurately, layer by layer.",
    url: "https://rails.finance/about/architecture",
    images: ["/rails-og.png"],
  },
};

const H2 = "text-3xl font-semibold tracking-tight text-foreground";
const CARD = "rounded-xl border border-rb-200 dark:border-rb-800 bg-raised p-5";

/* System Components — the multi-layer stack. */
const COMPONENTS = [
  {
    n: 1,
    title: "Blockchain Indexer (Sieve)",
    lead: "Sieve — our in-house indexer — connects directly to Ethereum and monitors all Liquity V2 and Aave V4 contracts in real-time.",
    points: [
      "Captures Liquity V2 events across three collateral branches (WETH, wstETH, rETH) and Aave V4 spoke activity",
      "Processes Transfer, TroveOperation, TroveUpdated, Liquidation, Redemption, and Batch events, plus Aave V4 Supply, Borrow, Repay, Withdraw, and Liquidation events",
      "Reads from Ethereum through redundant RPC providers — a primary endpoint with automatic failover to a backup",
      "Fetches oracle prices from Chainlink for accurate USD valuations",
      "Routes events to the appropriate processing queues via RabbitMQ",
      "Maintains real-time synchronization with blockchain state",
    ],
  },
  {
    n: 2,
    title: "Message Queue (RabbitMQ)",
    lead: "Manages event flow and ensures reliable processing of all blockchain events.",
    points: [
      "Separate queues for different event types",
      "Guarantees event processing even during high load",
      "Enables a decoupled, scalable architecture",
    ],
  },
  {
    n: 3,
    title: "Processors & Materialized Views",
    lead: "Enrich raw events and pre-compute the heavy joins so reads stay fast.",
    points: [
      "Attach USD values and protocol-specific context to each event",
      "Write enriched history to Postgres",
      "Materialized views pre-compute positions and timelines so the API serves them cheaply",
    ],
  },
  {
    n: 4,
    title: "Chain-Truth Refresher",
    lead: "Reads current balances and risk straight from each protocol's contracts, independent of the event history.",
    points: [
      "A background worker batches reads across positions via Multicall3 on a short refresh",
      "Health factor, collateral factor, and live balances come from chain state, not inferred from events",
      "Keeps positions opened through swap aggregators — which skip a protocol's standard events — accurate on screen",
    ],
  },
  {
    n: 5,
    title: "API & Frontend",
    lead: "Stitches both data paths together and renders the result.",
    points: [
      "An Express API joins enriched history with live chain-truth state",
      "The Next.js frontend renders timelines, positions, and event detail",
      "Read-only throughout — no wallet connection, no account, no private keys",
    ],
  },
];

export default function ArchitecturePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-32 pb-16">
      <Link
        href="/about"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-rb-500 hover:text-blue-500 transition-colors mb-8"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        About
      </Link>

      <h1 className="font-sans font-semibold tracking-tight leading-tight text-foreground text-[clamp(28px,4.5vw,48px)] mb-6">
        Technical Architecture
      </h1>
      <p className="text-rb-500 text-lg leading-relaxed mb-12">
        Rails uses a multi-layer architecture to process and serve blockchain data efficiently and accurately. Two data
        paths run side by side — enriched event history and live chain-truth state — and the API stitches them together.
      </p>

      <section>
        <h2 className={`${H2} mb-4`}>System Components</h2>
        <div className="space-y-4">
          {COMPONENTS.map((c) => (
            <div key={c.n} className={CARD}>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {c.n}. {c.title}
              </h3>
              <p className="text-rb-500 leading-relaxed mb-3">{c.lead}</p>
              <ul className="space-y-2 text-foreground leading-relaxed">
                {c.points.map((p) => (
                  <li key={p} className="flex gap-3">
                    <span className="text-rb-500 shrink-0">·</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="text-foreground leading-relaxed mt-12">
        Rails is open source.{" "}
        <a
          href="https://github.com/rails-finance"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-pink-500 transition-colors"
        >
          View on GitHub →
        </a>
      </p>
    </div>
  );
}
