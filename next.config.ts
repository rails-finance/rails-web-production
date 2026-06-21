import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 15.5.7 dev: webpack reports framer-motion's server vendor chunk as
  // compiled but never writes `.next/server/vendor-chunks/framer-motion@….js`,
  // so any route that SSRs a framer-motion component 500s with
  // "Cannot find module './vendor-chunks/framer-motion…'". Transpiling it bundles
  // framer-motion into each route's own chunks instead of the vendor-chunk split,
  // sidestepping the unwritten-chunk bug. (Drop once on a Next that emits it.)
  transpilePackages: ["framer-motion"],
  async redirects() {
    return [
      // Legacy explorer paths — collapsed to a single hop to the new canonical
      // /liquity-v2/trove/... rather than chaining through the intermediate
      // /trove/... URL.
      {
        source: "/explorer/trove/:troveId/:branch(ETH)",
        destination: "/liquity-v2/trove/WETH/:troveId",
        permanent: true,
      },
      {
        source: "/explorer/trove/:troveId/:branch",
        destination: "/liquity-v2/trove/:branch/:troveId",
        permanent: true,
      },
      {
        source: "/explorer",
        destination: "/",
        permanent: true,
      },
      // Mono-rails move: /trove/[c]/[id] now lives under /liquity-v2/trove/...
      {
        source: "/trove/:collateralType/:troveId",
        destination: "/liquity-v2/trove/:collateralType/:troveId",
        permanent: true,
      },
      // Wallet view is the filtered listing, not a dedicated route. Anyone
      // landing on /liquity-v2/[wallet] (legacy bookmarks, the wallet pill
      // before this change) gets sent to /liquity-v2 with the appropriate
      // filter query param. We match two shapes — 0x address or .eth ENS —
      // so the trove subtree (/liquity-v2/trove/...) and other future
      // children aren't caught by the redirect. Anything else 404s, which
      // is fine: only addresses and ENS names ever lived at this depth.
      {
        source: "/liquity-v2/:slug(0x[0-9a-fA-F]{40})",
        destination: "/liquity-v2?ownerAddress=:slug",
        permanent: true,
      },
      {
        source: "/liquity-v2/:slug([^/]+\\.eth)",
        destination: "/liquity-v2?ownerEns=:slug",
        permanent: true,
      },
      // Aave V4: same pattern, but the listing's wallet param is `wallet`.
      // The /aave-v4/spoke/[spoke]/[wallet] detail tree is deeper (three
      // extra segments) so it doesn't collide with these single-segment
      // matchers.
      {
        source: "/aave-v4/:slug(0x[0-9a-fA-F]{40})",
        destination: "/aave-v4?wallet=:slug",
        permanent: true,
      },
      {
        source: "/aave-v4/:slug([^/]+\\.eth)",
        destination: "/aave-v4?ownerEns=:slug",
        permanent: true,
      },
      // "How It Works" folded into About: the Overview content now lives on
      // /about and the Technical Architecture tab became /about/architecture.
      // Preserve inbound bookmarks by sending the old page to /about.
      {
        source: "/how-it-works",
        destination: "/about",
        permanent: true,
      },
      // The cross-protocol /wallet/[address] umbrella is gone — each rail
      // stands alone. Preserve inbound bookmarks by sending stale links to
      // the platform home, which surfaces the protocol cards.
      {
        source: "/wallet/:slug*",
        destination: "/",
        permanent: true,
      },
      // Aave V4 spoke URLs moved from `/aave-v4/spoke/Display%20Name/[wallet]`
      // to a kebab-case slug. The legacy → slug 308 is handled in
      // `middleware.ts` rather than here because Next's `redirects` matcher is
      // case-insensitive — a `source: "/aave-v4/spoke/Main/:wallet"` rule
      // would also catch the canonical lowercase `main` and self-loop. The
      // middleware does explicit case-sensitive slug detection.
    ];
  },
};

export default nextConfig;
