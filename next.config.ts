import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
      // Wallet-as-entry-point: /liquity-v2?ownerAddress=X and ?ownerEns=X
      // now route to the canonical /liquity-v2/[wallet] page. Other listing
      // query params (status, sortBy, etc.) are unaffected.
      {
        source: "/liquity-v2",
        has: [{ type: "query", key: "ownerAddress", value: "(?<addr>.+)" }],
        destination: "/liquity-v2/:addr",
        permanent: true,
      },
      {
        source: "/liquity-v2",
        has: [{ type: "query", key: "ownerEns", value: "(?<ens>.+)" }],
        destination: "/liquity-v2/:ens",
        permanent: true,
      },
      // Same wallet-as-entry-point pattern for Aave V4. The /aave-v4 listing
      // is open-position-only (backed by mv_aave_v4_spoke_positions); when a
      // wallet is supplied, we want the per-wallet view which surfaces both
      // current and historical activity (incl. closed positions).
      {
        source: "/aave-v4",
        has: [{ type: "query", key: "wallet", value: "(?<addr>.+)" }],
        destination: "/aave-v4/:addr",
        permanent: true,
      },
      {
        source: "/aave-v4",
        has: [{ type: "query", key: "ownerEns", value: "(?<ens>.+)" }],
        destination: "/aave-v4/:ens",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
