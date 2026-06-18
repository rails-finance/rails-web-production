"use client";

import Link from "next/link";
import { useState } from "react";

const TABS = ["Overview", "Technical Architecture"] as const;
type Tab = (typeof TABS)[number];

/* Key Features — the at-a-glance capability list shown in the Overview box. */
const KEY_FEATURES = [
  "Real-time tracking of Liquity V2 troves and Aave V4 positions",
  "Rich transaction timelines with detailed explanations",
  "Ownership history and transfer tracking",
  "Comprehensive protocol analytics and statistics",
  "Multi-collateral and multi-asset support (ETH, wstETH, rETH, and Aave V4 reserves)",
];

/* The Rails Approach — the four processing stages, Overview tab. */
const APPROACH = [
  {
    n: 1,
    title: "Data Collection",
    body: "We continuously monitor the Ethereum blockchain for Liquity V2 and Aave V4 events. Every transaction, state change, and protocol interaction is captured in real-time.",
  },
  {
    n: 2,
    title: "Context Enrichment",
    body: "Raw blockchain events are enriched with transaction context. We analyze why transfers happened, what operations triggered them, and how they affect protocol state.",
  },
  {
    n: 3,
    title: "Analysis",
    body: "Multi-step operations are decoded into something legible. Health factor, liquidation price, and rate exposure are computed from current on-chain state, with the inputs visible.",
  },
  {
    n: 4,
    title: "Presentation",
    body: "The result is rendered as intuitive timelines, position views, and plain-language explanations — each event a self-contained card.",
  },
];

/* System Components — the multi-layer stack, Technical Architecture tab. */
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

const CARD = "rounded-xl border border-rb-200 dark:border-rb-800 bg-raised p-5";
const SECTION_H = "text-2xl font-semibold tracking-tight text-foreground mb-4";

export default function HowItWorksPage() {
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-16">
      <h1 className="font-sans font-semibold tracking-tight leading-tight text-[clamp(28px,4vw,42px)] mb-6">
        How Rails Works
      </h1>

      {/* Tab toggle */}
      <div className="inline-flex gap-1 rounded-lg bg-sunken p-1 mb-12">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-[var(--marketing)] text-white" : "text-rb-500 hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <>
          <section className="mb-12">
            <h2 className={SECTION_H}>What Rails Does</h2>
            <p className="text-rb-500 text-lg leading-relaxed mb-6">
              Rails is a specialized analytics platform that makes DeFi activity easy to understand. We take complex
              blockchain data from protocols like{" "}
              <Link href="/liquity-v2" className="underline hover:text-blue-500 transition-colors">
                Liquity V2
              </Link>{" "}
              and{" "}
              <Link href="/aave-v4" className="underline hover:text-blue-500 transition-colors">
                Aave V4
              </Link>{" "}
              and transform it into clear, actionable insights.
            </p>

            <div className={CARD}>
              <h3 className="text-base font-semibold marketing mb-3">Key Features</h3>
              <ul className="space-y-2 text-foreground leading-relaxed">
                {KEY_FEATURES.map((f) => (
                  <li key={f} className="flex gap-3">
                    <span className="marketing shrink-0">·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className={SECTION_H}>The Rails Approach</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {APPROACH.map((s) => (
                <div key={s.n} className={CARD}>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {s.n}. {s.title}
                  </h3>
                  <p className="text-rb-500 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="mb-12">
            <h2 className={SECTION_H}>Technical Architecture</h2>
            <p className="text-rb-500 text-lg leading-relaxed">
              Rails uses a sophisticated multi-layer architecture to process and serve blockchain data efficiently and
              accurately.
            </p>
          </section>

          <section>
            <h2 className={SECTION_H}>System Components</h2>
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
        </>
      )}
    </div>
  );
}
