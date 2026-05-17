import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-16">
      <h1 className="font-sans font-semibold tracking-tight leading-tight text-[clamp(28px,4vw,42px)] mb-3">
        How Rails works
      </h1>
      <p className="text-rb-500 text-lg leading-relaxed mb-12">
        Rails is a platform that produces mono-rails — dedicated, read-only
        explorers, one per protocol. The platform sits above them; the rails
        do the work.
      </p>

      <section className="mb-12">
        <h2 className="text-xl font-semibold tracking-tight mb-3 text-foreground">
          What a mono-rail is
        </h2>
        <p className="text-foreground leading-relaxed mb-4">
          One protocol, one explorer. A mono-rail shows the protocol's events
          and positions for any wallet that ever touched it — open and close
          actions, adjustments, liquidations, redemptions — each rendered as
          a self-contained event card with the values, asset flow, and
          plain-language context you'd ask a support agent for.
        </p>
        <p className="text-foreground leading-relaxed">
          Live today:{" "}
          <Link href="/liquity-v2" className="underline hover:text-blue-500 transition-colors">
            Liquity V2
          </Link>{" "}
          and{" "}
          <Link href="/aave-v4" className="underline hover:text-blue-500 transition-colors">
            Aave V4
          </Link>
          . Each is sponsor-anchored — the protocol team is the integration
          partner, not a bystander.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold tracking-tight mb-3 text-foreground">
          The wallet is the session
        </h2>
        <p className="text-foreground leading-relaxed mb-4">
          Search for an address or ENS name and Rails routes you to the right
          rail — or the cross-rail view if you have positions across multiple
          protocols. The wallet you're tracking stays in the header as you
          move between rails; it behaves like a session, not a per-page
          parameter.
        </p>
        <p className="text-foreground leading-relaxed">
          Sessions live in your browser's local storage. Rails never receives
          or stores them. There's no account, no sign-in, no wallet
          connection.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold tracking-tight mb-3 text-foreground">
          The truth principle
        </h2>
        <p className="text-foreground leading-relaxed mb-4">
          Every value Rails renders is derived from on-chain state. Health
          factor, liquidation price, rate exposure — all computed from current
          reserve and position data with the inputs visible. No estimates,
          no hypotheticals.
        </p>
        <p className="text-foreground leading-relaxed mb-4">
          Simulators were removed from the v1 surfaces: a slider that asks
          "what if ETH drops 20%?" is easy to ship and easy to mislead with.
          If hypotheticals come back, they'll be on a separate, clearly
          labelled surface — not woven into the position view.
        </p>
        <p className="text-foreground leading-relaxed">
          USD prices come from a resolution chain (Chainlink on-chain feeds
          first, then a cached price history, then a public price API as
          fallback). The source for any number is verifiable.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold tracking-tight mb-3 text-foreground">
          What's under the hood
        </h2>
        <p className="text-foreground leading-relaxed mb-4">
          A small pipeline: an indexer reads protocol events from Ethereum,
          processors enrich them with USD values and protocol-specific
          context, an API serves the result, and the Rails frontend renders
          it. Materialized views pre-compute the heavy joins so reads are
          cheap.
        </p>
        <p className="text-foreground leading-relaxed">
          Rails is open source.{" "}
          <a
            href="https://github.com/rails-finance"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-blue-500 transition-colors"
          >
            View on GitHub →
          </a>
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight mb-3 text-foreground">
          What Rails is not
        </h2>
        <ul className="space-y-2 text-foreground leading-relaxed">
          <li className="flex gap-3">
            <span className="text-rb-500 shrink-0">·</span>
            <span>
              Not a portfolio tracker. We don't aggregate positions for the
              sake of a P/L line; each rail stays scoped to its protocol.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-rb-500 shrink-0">·</span>
            <span>
              Not a block explorer. We don't show every transaction — we show
              the protocol-meaningful events with context that a block
              explorer wouldn't.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-rb-500 shrink-0">·</span>
            <span>
              Not an arbiter of which assets or protocols are trustworthy.
              We surface the trust assumptions we rely on (price feeds,
              issuers, custody models) and let you read them.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
