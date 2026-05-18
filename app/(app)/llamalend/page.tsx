"use client";

// LlamaLend discovery — v1 minimal stub.
//
// A real discovery page would list active markets + top borrowers per market,
// analogous to /liquity-v2 (active troves) and /aave-v4 (active spokes). That
// requires a server-side positions/markets endpoint we haven't built yet —
// the markets exist in llamalend_markets / crvusd_markets but the per-wallet
// position aggregation is a transformer pass over llamalend_user_state we've
// deferred.
//
// For now the page nudges the user to the cross-protocol search in the header.

import Link from "next/link";

export default function LlamalendDiscoveryPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-foreground">
      <header className="mb-8">
        <Link href="/" className="text-xs text-rb-text-500 hover:text-foreground">
          ← Home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Curve LlamaLend</h1>
        <p className="mt-2 text-sm text-rb-text-500">
          Band-based CDP markets across two families — LlamaLend lend markets
          and crvUSD mint markets — with soft liquidation via LLAMMA.
        </p>
      </header>

      <section className="rounded-md border border-rb-text-100/10 bg-rb-bg-100/40 p-6">
        <h2 className="text-base font-semibold">Look up a wallet</h2>
        <p className="mt-2 text-sm text-rb-text-500">
          Discovery listings (active markets, top borrowers) aren't wired up
          yet. Use the wallet search in the header to view any wallet's
          LlamaLend activity. Example:{" "}
          <Link
            href="/llamalend/0x6e3b2eabf254b41e53a327ea6c868d232cfdeeba"
            className="underline decoration-rb-text-500/40 underline-offset-2 hover:text-foreground"
          >
            an active WETH borrower
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
