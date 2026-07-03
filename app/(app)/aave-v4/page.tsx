"use client";

// Aave V4 landing — visual analog of /liquity-v2. Discovery list of every
// (wallet, spoke) open position from mv_aave_v4_spoke_positions. The listing
// body lives in the shared AaveV4Listing component (also used, seeded, by the
// hub landing pages under /aave-v4/hubs/[hub]).

import { AaveV4Listing } from "@/components/aave-v4/AaveV4Listing";

export default function AaveV4LandingPage() {
  return <AaveV4Listing />;
}
